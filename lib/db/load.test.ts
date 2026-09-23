// @vitest-environment node
/**
 * P1.10 load verification: queries the loaded database (not the loader's own counts).
 * Skipped when DATABASE_URL is absent (CI has no database secret).
 */
import { config } from 'dotenv'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import * as s from './schema'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL
const VERSION = '2027-proposed-3rd-run-2026-09-14'

async function fileRows(name: string): Promise<number> {
  const file = await asyncBufferFromFile(`data/processed/${name}.parquet`)
  return (await parquetReadObjects({ file })).length
}

describe.skipIf(!url)('loaded database', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  let v = 0

  beforeAll(async () => {
    const versions = await db.select().from(s.budgetVersions).where(eq(s.budgetVersions.slug, VERSION))
    expect(versions).toHaveLength(1)
    v = versions[0].id
  })
  afterAll(() => pool.end())

  const count = async (table: typeof s.lineItems | typeof s.deptSummary | typeof s.chunks | typeof s.revenues
    | typeof s.services | typeof s.kpis | typeof s.positionChanges | typeof s.capitalProjects | typeof s.positionLines
    | typeof s.sectionTotals | typeof s.sectionComparisons | typeof s.positionsSummary | typeof s.fteSummary
    | typeof s.concepts) =>
    Number((await db.select({ n: sql<number>`count(*)` }).from(table).where(eq(table.budgetVersionId, v)))[0].n)

  it.each([
    ['line_items', s.lineItems], ['position_lines', s.positionLines], ['dept_summary', s.deptSummary],
    ['services', s.services], ['kpis', s.kpis], ['position_changes', s.positionChanges],
    ['capital_projects', s.capitalProjects], ['revenues', s.revenues], ['section_totals', s.sectionTotals],
    ['section_comparisons', s.sectionComparisons], ['positions_summary', s.positionsSummary],
    ['fte_summary', s.fteSummary], ['concepts', s.concepts],
  ] as const)('%s row count equals its data file', async (name, table) => {
    expect(await count(table)).toBe(await fileRows(name))
  })

  it('G1 all funds and G2 general city purposes come back exact', async () => {
    const rows = await db.select().from(s.sectionTotals)
      .where(and(eq(s.sectionTotals.budgetVersionId, v), eq(s.sectionTotals.line, 'budget')))
    const by = Object.fromEntries(rows.map((r) => [r.section, r.proposed2027]))
    expect(by.TOTAL).toBe(2_261_087_412)
    expect(by.A).toBe(846_796_205)
  })

  it('G13 Police four stages, joined through departments', async () => {
    const [r] = await db.select({ a: s.deptSummary.actual2025, ad: s.deptSummary.adopted2026,
      rq: s.deptSummary.requested2027, p: s.deptSummary.proposed2027 })
      .from(s.deptSummary).innerJoin(s.departments, eq(s.deptSummary.deptId, s.departments.id))
      .where(and(eq(s.deptSummary.budgetVersionId, v), eq(s.departments.slug, 'police'),
        eq(s.deptSummary.metric, 'total_expenditures')))
    expect([r.a, r.ad, r.rq, r.p].map(Number)).toEqual([330_680_888, 310_111_835, 345_822_092, 343_937_125])
  })

  it('G16 total budgeted positions', async () => {
    const [r] = await db.select().from(s.positionsSummary)
      .where(and(eq(s.positionsSummary.budgetVersionId, v), eq(s.positionsSummary.label, 'Total Budgeted Positions')))
    expect([r.adopted2026, r.proposed2027]).toEqual([7_818, 7_844])
  })

  it('G20 Detailed 110.1 line 10 with its citation', async () => {
    const [r] = await db.select().from(s.lineItems).where(and(eq(s.lineItems.budgetVersionId, v),
      sql`${s.lineItems.cite}->>'printed_page' = '110.1'`, sql`(${s.lineItems.cite}->>'line_no')::int = 10`))
    expect([r.actual2025, r.adopted2026, r.requested2027, r.proposed2027]).toEqual([10_901_893, 10_130_279, 10_967_573, 10_501_580])
    expect(r.cite).toMatchObject({ doc: 'detailed', pdf_page: 3, printed_page: '110.1', line_no: 10 })
  })

  it('every department-scoped row is linked to a department', async () => {
    for (const table of [s.deptSummary, s.services, s.kpis, s.positionChanges] as const) {
      const n = await db.select({ n: sql<number>`count(*)` }).from(table)
        .where(and(eq(table.budgetVersionId, v), isNull(table.deptId)))
      expect(Number(n[0].n)).toBe(0)
    }
    const orphanLines = await db.select({ n: sql<number>`count(*)` }).from(s.lineItems)
      .where(and(eq(s.lineItems.budgetVersionId, v), isNull(s.lineItems.deptId),
        sql`${s.lineItems.section} not in ('400','420','430')`))   // restated/recap sections have no department
    expect(Number(orphanLines[0].n)).toBe(0)
  })

  it('every position line points at its line item', async () => {
    const n = await db.select({ n: sql<number>`count(*)` }).from(s.positionLines)
      .where(and(eq(s.positionLines.budgetVersionId, v), isNull(s.positionLines.lineItemId)))
    expect(Number(n[0].n)).toBe(0)
  })

  it('blank cells stay NULL in the database, never 0', async () => {
    const [r] = await db.select().from(s.lineItems).where(and(eq(s.lineItems.budgetVersionId, v),
      sql`${s.lineItems.cite}->>'printed_page' = '110.2'`, sql`(${s.lineItems.cite}->>'line_no')::int = 7`))
    expect(r.adopted2026).toBe(3000)
    expect(r.proposed2027).toBeNull()
  })

  it('full-text search finds a narrative chunk (tsv is generated by Postgres)', async () => {
    const rows = await db.select({ text: s.chunks.text, dept: s.chunks.deptId }).from(s.chunks)
      .where(and(eq(s.chunks.budgetVersionId, v), sql`${s.chunks.tsv} @@ plainto_tsquery('english', 'recruit classes')`))
    // Summary p.117: 'funds the maximum number of annual classes (3) each at … recruits per class (65)'
    expect(rows.some((r) => r.text.includes('maximum number of annual classes (3)'))).toBe(true)
  })
})
