// @vitest-environment node
// Chat lookups against the loaded budget (golden figures from docs/02 §7).
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { findBudgetFacts, getDepartmentBreakdown, lookupGlossary } from './chat'
import * as s from './schema'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL
const VERSION = '2027-proposed-3rd-run-2026-09-14'

describe.skipIf(!url)('chat lookups (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  afterAll(() => pool.end())

  it('Police breakdown: salaries, positions and total match Summary p.116', async () => {
    const b = (await getDepartmentBreakdown(db, VERSION, 'police'))!
    const get = (m: string) => b.rows.find((r) => r.metric === m)!
    expect([get('salaries').adopted2026, get('salaries').proposed2027]).toEqual([190_364_638, 214_743_752])
    expect([get('positions').adopted2026, get('positions').proposed2027]).toEqual([2526, 2585]) // G17
    expect(get('total_expenditures').proposed2027).toBe(343_937_125) // G13
    expect(b.cite.printed_page).toBe('116')
    expect(await getDepartmentBreakdown(db, VERSION, 'no-such-dept')).toBeNull()
  }, 30_000)

  it('Act 12 questions find the reviewed Act 12 facts', async () => {
    const facts = await findBudgetFacts(db, VERSION, 'How does Act 12 affect police staffing?')
    expect(facts.map((f) => f.id)).toEqual(expect.arrayContaining(['sro-mandate']))
    expect(facts.every((f) => f.cite.pdf_page > 0)).toBe(true)
  }, 30_000)

  it('glossary finds a term by name', async () => {
    const hits = await lookupGlossary(db, VERSION, 'levy')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].definition.length).toBeGreaterThan(10)
  }, 30_000)
})
