// P2.1 queries for the Overview page. Every row carries its citation; the page only formats.
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as s from './schema'
import type { Cite } from './schema'

type Db = NodePgDatabase<typeof s>
export type Stages = { adopted2026: number; proposed2027: number; cite: Cite }

async function versionId(db: Db, slug: string) {
  const [v] = await db.select({ id: s.budgetVersions.id }).from(s.budgetVersions).where(eq(s.budgetVersions.slug, slug))
  if (!v) throw new Error(`budget version ${slug} not loaded`)
  return v.id
}

const SECTION_NAMES: Record<string, string> = {
  A: 'General city purposes', B: 'Employee retirement (pensions)', C: 'Capital improvements', D: 'City debt',
  F: 'Common Council contingent fund', G: 'Transportation fund', H: 'Grant and aid fund',
  I: 'Economic development fund', J: 'Water Works', K: 'Sewer maintenance fund',
  M: 'County delinquent taxes fund', N: 'Settlement funds',
}
const LETTERS = Object.keys(SECTION_NAMES)

/** Summary p.7: the budget, the city tax levy and the tax rate, all funds and general city purposes. */
export async function getHeadline(db: Db, version: string) {
  const v = await versionId(db, version)
  const rows = await db.select().from(s.sectionTotals)
    .where(and(eq(s.sectionTotals.budgetVersionId, v), inArray(s.sectionTotals.section, ['TOTAL', 'A'])))
  const get = (section: string, line: 'budget' | 'levy') => {
    const r = rows.find((x) => x.section === section && x.line === line)
    if (!r || r.adopted2026 === null || r.proposed2027 === null) throw new Error(`section ${section} ${line} missing`)
    return { adopted2026: r.adopted2026, proposed2027: r.proposed2027, cite: r.cite, rate: r }
  }
  const levy = get('TOTAL', 'levy')
  const { rate: _a, ...allFunds } = get('TOTAL', 'budget')
  const { rate: _g, ...gcp } = get('A', 'budget')
  return {
    allFunds, gcp,
    levy: { adopted2026: levy.adopted2026, proposed2027: levy.proposed2027, cite: levy.cite },
    rate: { r2026: levy.rate.taxRate2026!, r2027: levy.rate.taxRate2027!, cite: levy.cite },
  }
}

/** Summary p.7: each lettered budget section (subtotals left out, so the rows add up to the total). */
export async function getSectionBudgets(db: Db, version: string) {
  const v = await versionId(db, version)
  const rows = await db.select().from(s.sectionTotals).where(and(eq(s.sectionTotals.budgetVersionId, v),
    eq(s.sectionTotals.line, 'budget'), inArray(s.sectionTotals.section, LETTERS)))
  return LETTERS.map((k) => {
    const r = rows.find((x) => x.section === k)
    if (!r) throw new Error(`section ${k} missing`)
    return { section: k, name: SECTION_NAMES[k], adopted2026: r.adopted2026 ?? 0, proposed2027: r.proposed2027 ?? 0, cite: r.cite }
  })
}

// Summary p.156-162: general city purposes revenue by category, then the reserve withdrawal and the levy.
const MIX: { key: string; label: string; lines: string[] }[] = [
  { key: 'intergovernmental', label: 'Intergovernmental revenue (from the state and other governments)', lines: ['Total Intergovernmental Revenue'] },
  { key: 'levy', label: 'Property tax levy', lines: ['Property Tax Levy'] },
  { key: 'charges', label: 'Charges for services', lines: ['Total Charges for Services'] },
  { key: 'taxes', label: 'Other taxes and payments in lieu of taxes', lines: ['Total Taxes'] },
  { key: 'tsf', label: 'Tax Stabilization Fund withdrawal', lines: ['Tax Stabilization Fund Withdrawal (Sustainable)', 'Tax Stabilization Fund Withdrawal (Revenue Anticipation)'] },
  { key: 'misc', label: 'Miscellaneous revenue', lines: ['Total Miscellaneous Revenue'] },
  { key: 'fringe', label: 'Fringe benefit reimbursement from other city funds', lines: ['Total Fringe Benefits'] },
  { key: 'permits', label: 'Licenses and permits', lines: ['Total Licenses and Permits'] },
  { key: 'fines', label: 'Fines and forfeitures', lines: ['Total Fines and Forfeitures'] },
]

export async function getRevenueMix(db: Db, version: string) {
  const v = await versionId(db, version)
  const rows = await db.select().from(s.revenues).where(and(eq(s.revenues.budgetVersionId, v),
    eq(s.revenues.source, 'summary'), eq(s.revenues.fund, 'general'), inArray(s.revenues.line, MIX.flatMap((m) => m.lines))))
  return MIX.map((m) => {
    const hit = rows.filter((r) => m.lines.includes(r.line))
    if (hit.length !== m.lines.length) throw new Error(`revenue line(s) for ${m.key} missing`)
    return {
      key: m.key, label: m.label, cite: hit[0].cite,
      adopted2026: hit.reduce((a, r) => a + (r.adopted2026 ?? 0), 0),
      proposed2027: hit.reduce((a, r) => a + (r.proposed2027 ?? 0), 0),
    }
  })
}

// Not departments: accounting lines and account groups that live in section A.
const NOT_DEPARTMENTS = ['fringe-benefit-offset', 'gcp-source-of-funds', 'special-purpose-accounts', 'dpw']

/** Each department's total expenditures across the four stages (its Summary budget table). */
export async function getDepartmentTotals(db: Db, version: string) {
  const v = await versionId(db, version)
  const rows = await db.select({
    slug: s.departments.slug, name: s.departments.name, shortName: s.departments.shortName,
    actual2025: s.deptSummary.actual2025, adopted2026: s.deptSummary.adopted2026,
    requested2027: s.deptSummary.requested2027, proposed2027: s.deptSummary.proposed2027, cite: s.deptSummary.cite,
  }).from(s.deptSummary).innerJoin(s.departments, eq(s.deptSummary.deptId, s.departments.id))
    .where(and(eq(s.deptSummary.budgetVersionId, v), eq(s.deptSummary.metric, 'total_expenditures'),
      eq(s.departments.section, 'A'), notInArray(s.departments.slug, NOT_DEPARTMENTS)))
  return rows
    .filter((r) => r.requested2027 !== null && r.proposed2027 !== null && r.adopted2026 !== null)
    .map((r) => ({ ...r, adopted2026: Number(r.adopted2026), requested2027: Number(r.requested2027), proposed2027: Number(r.proposed2027),
      actual2025: r.actual2025 === null ? null : Number(r.actual2025) }))
    .sort((a, b) => b.proposed2027 - a.proposed2027)
}

/** The two lines that take the departments' total to general city purposes: special purpose accounts
 *  (Detailed 400.1 line 2) and the fringe benefit offset (Summary p.155). */
export async function getGcpReconciliation(db: Db, version: string) {
  const v = await versionId(db, version)
  const [spa] = await db.select().from(s.lineItems).where(and(eq(s.lineItems.budgetVersionId, v),
    eq(s.lineItems.section, '400'), eq(s.lineItems.description, 'TOTAL SPECIAL PURPOSE ACCOUNTS')))
  const [off] = await db.select({ adopted2026: s.deptSummary.adopted2026, proposed2027: s.deptSummary.proposed2027, cite: s.deptSummary.cite })
    .from(s.deptSummary).innerJoin(s.departments, eq(s.deptSummary.deptId, s.departments.id))
    .where(and(eq(s.deptSummary.budgetVersionId, v), eq(s.departments.slug, 'fringe-benefit-offset'),
      eq(s.deptSummary.metric, 'total_expenditures')))
  if (!spa || !off) throw new Error('special purpose accounts or fringe benefit offset total missing')
  return {
    specialPurpose: { adopted2026: Number(spa.adopted2026), proposed2027: Number(spa.proposed2027), cite: spa.cite },
    fringeOffset: { adopted2026: Number(off.adopted2026), proposed2027: Number(off.proposed2027), cite: off.cite },
  }
}
