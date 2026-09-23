/**
 * Embed narrative chunks and concepts with Voyage (voyage-4, 1024 dims), via a content-addressed
 * cache so reloads (D14) never pay twice.
 *
 *   1. For every chunk / concept row, build its embedding text and a fingerprint
 *      sha256(model | input_type | text).
 *   2. Fingerprints missing from embedding_cache are sent to Voyage in batches of 128.
 *   3. Every row's vector is (re)filled from the cache.
 *
 * Chunks embed as `context_header + text` (docs/06 §6: deterministic contextual retrieval);
 * concepts as `label — gloss`. Stored texts use input_type 'document'; search queries later use
 * 'query'. Run: pnpm db:embed (also runs at the end of pnpm db:load).
 */
import { createHash } from 'node:crypto'

import { config } from 'dotenv'
import { eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as s from '../lib/db/schema'

config({ path: '.env.local' })

const MODEL = 'voyage-4'
const INPUT_TYPE = 'document'
const BATCH = 128 // ~90K tokens per request at our chunk sizes; the limit is 1,000 texts / 320K tokens
const VERSION = '2027-proposed-3rd-run-2026-09-14'

const fingerprint = (text: string) => createHash('sha256').update(`${MODEL}|${INPUT_TYPE}|${text}`).digest('hex')

async function voyage(texts: string[], key: string, attempt = 0): Promise<{ vectors: number[][]; tokens: number }> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: INPUT_TYPE }),
  })
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = Number(res.headers.get('retry-after')) * 1000 || 2 ** attempt * 2000
    await new Promise((r) => setTimeout(r, wait))
    return voyage(texts, key, attempt + 1)
  }
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = (await res.json()) as { data: { embedding: number[]; index: number }[]; usage: { total_tokens: number } }
  const vectors = body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
  if (vectors.length !== texts.length || vectors.some((v) => v.length !== 1024)) {
    throw new Error(`Voyage returned ${vectors.length} vectors for ${texts.length} texts, or not 1024 dims`)
  }
  return { vectors, tokens: body.usage.total_tokens }
}

const vec = (v: number[]) => `[${v.join(',')}]`

async function main() {
  const key = process.env.VOYAGE_API_KEY
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set (.env.local)')
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  try {
    const [version] = await db.select().from(s.budgetVersions).where(eq(s.budgetVersions.slug, VERSION))
    if (!version) throw new Error(`budget version ${VERSION} not loaded — run pnpm db:load first`)
    const v = version.id

    const chunkRows = await db.select({ id: s.chunks.id, header: s.chunks.contextHeader, text: s.chunks.text })
      .from(s.chunks).where(eq(s.chunks.budgetVersionId, v))
    const conceptRows = await db.select({ id: s.concepts.id, label: s.concepts.label, gloss: s.concepts.gloss })
      .from(s.concepts).where(eq(s.concepts.budgetVersionId, v))
    const items = [
      ...chunkRows.map((r) => ({ table: 'chunks' as const, id: r.id, text: `${r.header}\n\n${r.text}` })),
      ...conceptRows.map((r) => ({ table: 'concepts' as const, id: String(r.id), text: r.gloss ? `${r.label} — ${r.gloss}` : r.label })),
    ].map((it) => ({ ...it, hash: fingerprint(it.text) }))

    // cache misses → Voyage
    const unique = [...new Map(items.map((it) => [it.hash, it.text])).entries()]
    const have = new Set<string>()
    for (let i = 0; i < unique.length; i += 1000) {
      const hashes = unique.slice(i, i + 1000).map(([h]) => h)
      for (const r of await db.select({ hash: s.embeddingCache.hash }).from(s.embeddingCache).where(inArray(s.embeddingCache.hash, hashes))) have.add(r.hash)
    }
    const missing = unique.filter(([h]) => !have.has(h))
    let tokens = 0
    if (missing.length && !key) throw new Error(`${missing.length} texts need embedding but VOYAGE_API_KEY is not set`)
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH)
      const out = await voyage(batch.map(([, t]) => t), key as string)
      tokens += out.tokens
      await db.insert(s.embeddingCache).values(batch.map(([hash], j) => ({ hash, model: MODEL, inputType: INPUT_TYPE,
        embedding: out.vectors[j] }))).onConflictDoNothing()
    }

    // refill every row from the cache, in one transaction
    await db.transaction(async (tx) => {
      for (const table of ['chunks', 'concepts'] as const) {
        const rows = items.filter((it) => it.table === table)
        for (let i = 0; i < rows.length; i += 200) {
          const part = rows.slice(i, i + 200)
          const values = sql.join(part.map((r) => sql`(${r.id}, ${r.hash})`), sql`, `)
          const target = table === 'chunks' ? sql`chunks` : sql`concepts`
          const idCast = table === 'chunks' ? sql`t.id` : sql`t.id::text`
          await tx.execute(sql`update ${target} as t set embedding = c.embedding
            from (values ${values}) as m(id, hash) join embedding_cache c on c.hash = m.hash
            where ${idCast} = m.id and t.budget_version_id = ${v}`)
        }
      }
    })
    const filled = await db.execute(sql`select
      (select count(*) from chunks where budget_version_id = ${v} and embedding is not null) as chunks,
      (select count(*) from concepts where budget_version_id = ${v} and embedding is not null) as concepts`)
    process.stdout.write(`${JSON.stringify({ model: MODEL, texts: items.length, cache_hits: unique.length - missing.length,
      embedded_now: missing.length, voyage_tokens: tokens, filled: filled.rows[0] })}\n`)
  } catch (err) {
    const cause = (err as { cause?: { message?: string } }).cause
    process.stderr.write(`embed failed: ${cause?.message ?? String(err).slice(0, 300)}\n`)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
