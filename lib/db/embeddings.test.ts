// @vitest-environment node
/**
 * P1.10 embedding verification. Coverage needs DATABASE_URL; the semantic probes also need
 * VOYAGE_API_KEY (each embeds one short query, a few tokens). Both skip in CI.
 */
import { config } from 'dotenv'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import * as s from './schema'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL
const key = process.env.VOYAGE_API_KEY
const VERSION = '2027-proposed-3rd-run-2026-09-14'

async function embedQuery(text: string): Promise<string> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: [text], model: 'voyage-4', input_type: 'query' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}`)
  const body = (await res.json()) as { data: { embedding: number[] }[] }
  return `[${body.data[0].embedding.join(',')}]`
}

describe.skipIf(!url)('embeddings', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  let v = 0

  beforeAll(async () => {
    v = (await db.select().from(s.budgetVersions).where(eq(s.budgetVersions.slug, VERSION)))[0].id
  })
  afterAll(() => pool.end())

  it('every chunk and concept has a 1024-dim vector', async () => {
    for (const table of [s.chunks, s.concepts] as const) {
      const [r] = await db.select({ missing: sql<number>`count(*) filter (where ${table.embedding} is null)`,
        dims: sql<number[]>`array_agg(distinct vector_dims(${table.embedding}))` })
        .from(table).where(eq(table.budgetVersionId, v))
      expect(Number(r.missing)).toBe(0)
      expect(r.dims.map(Number)).toEqual([1024])
    }
  })

  it.skipIf(!key)('a plain-language question finds the Police recruit-class passage', async () => {
    const q = await embedQuery('how many police recruit classes will be funded')
    const rows = await db.select({ text: s.chunks.text }).from(s.chunks)
      .where(eq(s.chunks.budgetVersionId, v)).orderBy(sql`${s.chunks.embedding} <=> ${q}::vector`).limit(3)
    expect(rows.some((r) => r.text.includes('maximum number of annual classes (3)'))).toBe(true)
  })

  it.skipIf(!key)('"consultants" finds the Professional Services account', async () => {
    const q = await embedQuery('consultants and outside experts')
    const rows = await db.select({ label: s.concepts.label }).from(s.concepts)
      .where(eq(s.concepts.budgetVersionId, v))
      .orderBy(sql`${s.concepts.embedding} <=> ${q}::vector`).limit(3)
    expect(rows.some((r) => /professional services/i.test(r.label))).toBe(true)
  })
})
