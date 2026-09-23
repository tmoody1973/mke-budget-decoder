// Budget text search for the chat (docs/06): meaning-based (Voyage embeddings over the Summary's
// passages) and keyword (Postgres full text) results merged by reciprocal rank fusion, so a loosely
// worded question and an exact term both find their page. Without VOYAGE_API_KEY it uses keywords only.
// Only narrative passages: table and chart cards are pointers for the pipeline, not budget text.
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as s from './schema'
import type { Cite } from './schema'

type Db = NodePgDatabase<typeof s>
export type Passage = { id: string; heading: string | null; context: string; text: string; cite: Cite }

const RRF_K = 60 // standard fusion constant; larger flattens the difference between ranks

export async function embedQuery(text: string): Promise<string | null> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) return null
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: [text], model: 'voyage-4', input_type: 'query' }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null // fall back to keywords rather than fail the answer
  const body = (await res.json()) as { data: { embedding: number[] }[] }
  return `[${body.data[0].embedding.join(',')}]`
}

const STOP = new Set(['the', 'and', 'for', 'are', 'what', 'how', 'does', 'this', 'that', 'with', 'from', 'will', 'would', 'budget', 'proposed', 'city', 'milwaukee', '2027', '2026'])

/** The sentences of a passage that share the most words with the question, in their original order,
 *  up to `max` characters. Keeps the chat's input small without dropping the sentence that answers. */
export function focusPassage(text: string, query: string, max = 1200): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const words = new Set((query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)))
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9•"“(])/)
  const scored = sentences.map((t, i) => ({ t, i, hits: (t.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => words.has(w)).length }))
  const keep = new Set<number>()
  let used = 0
  for (const s of [...scored].sort((a, b) => b.hits - a.hits || a.i - b.i)) {
    if (used + s.t.length > max) continue
    keep.add(s.i); used += s.t.length + 1
  }
  return scored.filter((s) => keep.has(s.i)).map((s) => s.t).join(' … ')
}

/** Any-word keyword query: a question's words joined with OR (stop words drop out in Postgres). */
export const anyWords = (q: string) => q.toLowerCase().match(/[a-z0-9]+/g)?.join(' or ') ?? ''

export async function searchBudgetText(db: Db, version: string, query: string, limit = 5): Promise<Passage[]> {
  const vec = await embedQuery(query).catch(() => null)
  const words = anyWords(query)
  const rows = await db.execute(sql`
    with ver as (select id from budget_versions where slug = ${version}),
    kw as (
      select c.id, row_number() over (order by ts_rank_cd(c.tsv, websearch_to_tsquery('english', ${words})) desc) as r
      from chunks c where c.budget_version_id = (select id from ver) and c.kind = 'narrative' and c.tsv @@ websearch_to_tsquery('english', ${words})
      order by r limit 20
    ),
    vs as (
      select c.id, row_number() over (order by c.embedding <=> ${vec}::vector) as r
      from chunks c where ${vec}::text is not null and c.budget_version_id = (select id from ver) and c.kind = 'narrative'
      order by c.embedding <=> ${vec}::vector limit 20
    )
    select c.id, c.heading, c.context_header, c.text, c.pdf_page, c.printed_page, d.kind as doc,
      coalesce(1.0 / (${RRF_K} + kw.r), 0) + coalesce(1.0 / (${RRF_K} + vs.r), 0) as score
    from chunks c join documents d on d.id = c.doc_id
    left join kw on kw.id = c.id left join vs on vs.id = c.id
    where kw.id is not null or vs.id is not null
    order by score desc limit ${limit}`)
  return (rows.rows as { id: string; heading: string | null; context_header: string; text: string; pdf_page: number; printed_page: string; doc: Cite['doc'] }[])
    .map((r) => ({ id: r.id, heading: r.heading, context: r.context_header.split(' — ')[1] ?? r.context_header, text: focusPassage(r.text, query),
      cite: { doc: r.doc, pdf_page: r.pdf_page, printed_page: r.printed_page } }))
}
