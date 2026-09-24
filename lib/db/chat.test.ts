// @vitest-environment node
// Chat lookups against the loaded budget (golden figures from docs/02 §7).
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { findBudgetFacts, getBudgetSections, getCapitalProjects, getDepartmentBreakdown, getPerformanceMeasures, getPositionChanges, getRevenues, lookupGlossary, searchBudgetLines } from './chat'
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

describe.skipIf(!url)('chat lookups, second set (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  afterAll(() => pool.end())

  it('sections: rate split and capital/debt totals match Summary p.7 (G9, G10)', async () => {
    const secs = await getBudgetSections(db, VERSION)
    const a = secs.find((x) => x.section === 'A')!, c = secs.find((x) => x.section === 'C')!, d = secs.find((x) => x.section === 'D')!
    expect([a.rate2027, a.levy2027]).toEqual([3.05, 143_688_740])
    expect([c.budget2026, c.budget2027, d.budget2027]).toEqual([236_708_867, 316_607_345, 326_623_735])
    expect(secs.at(-1)!.section).toBe('TOTAL')
  }, 30_000)

  it('revenues: parking citations and the GCP requested total', async () => {
    const t = await getRevenues(db, VERSION, 'transportation-fund')
    expect(t.find((r) => r.line === 'Parking Citation Revenue')).toMatchObject({ adopted2026: 14_000_000, requested2027: 18_000_000, proposed2027: 21_000_000 })
    const g = await getRevenues(db, VERSION, 'general')
    expect(g.some((r) => r.requested2027 === 878_902_850)).toBe(true) // G2
  }, 30_000)

  it('911 position changes keep the document reason', async () => {
    const p = await getPositionChanges(db, VERSION, 'emergency-communications')
    expect(p.find((x) => x.title === 'Emergency Communications Officer V')).toMatchObject({ reason: 'Elimination of funded vacant positions' })
  }, 30_000)

  it('overtime lines total by department; measures come back as printed', async () => {
    const ot = await searchBudgetLines(db, VERSION, 'overtime')
    expect(ot.byDepartment).toBe(true)
    expect(ot.lines.length).toBeGreaterThan(5)
    expect((await getPerformanceMeasures(db, VERSION, 'fire')).length).toBeGreaterThan(0)
  }, 30_000)
})

describe.skipIf(!url)('capital projects (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  afterAll(() => pool.end())

  it('named projects only, headings left out, the printed typo kept with a note', async () => {
    const all = await getCapitalProjects(db, VERSION)
    expect(all.every((p) => p.name)).toBe(true)
    expect(all.some((p) => p.amount === 4_115_000)).toBe(false) // Police list heading (2,115,000 + 2,000,000)
    const port = all.find((p) => p.name === 'Terminal & Facility Maintenance')!
    expect(port.amount).toBeNull()
    expect(port.note).toContain('$1,300,000 million')
    const lib = await getCapitalProjects(db, VERSION, { query: 'library' })
    expect(lib.map((p) => p.name)).toContain('Branch Library New Construction')
  }, 30_000)
})
