// Lookups for the chat agent beyond the Overview's queries: a department's cost breakdown, the
// human-reviewed budget facts, and the glossary. Every row keeps its citation.
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as s from './schema'
import type { Cite } from './schema'
import { changes } from './overview'
import { anyWords } from './search'

type Db = NodePgDatabase<typeof s>

const versionId = (version: string) => sql`(select id from budget_versions where slug = ${version})`

// Summary department tables (docs/02 §2): what each metric means, in plain words, and its unit.
const METRICS: Record<string, { label: string; unit: 'dollars' | 'count' }> = {
  salaries: { label: 'Salaries and wages', unit: 'dollars' },
  fringe: { label: 'Fringe benefits (health care, pensions and other benefits)', unit: 'dollars' },
  operating: { label: 'Operating expenditures (supplies, services, utilities)', unit: 'dollars' },
  equipment: { label: 'Equipment purchases', unit: 'dollars' },
  special_funds: { label: 'Special funds', unit: 'dollars' },
  total_expenditures: { label: 'Total expenditures', unit: 'dollars' },
  positions: { label: 'Budgeted positions', unit: 'count' },
  fte_om: { label: 'Full-time equivalents, operating budget', unit: 'count' },
  fte_other: { label: 'Full-time equivalents, other funding', unit: 'count' },
  rev_total: { label: 'Revenue the department brings in', unit: 'dollars' },
}

export type BreakdownRow = { metric: string; label: string; unit: 'dollars' | 'count'; actual2025: number | null
  adopted2026: number | null; requested2027: number | null; proposed2027: number | null
  changeFromAdopted: number | null; changeFromRequest: number | null; percentChangeFromAdopted: number | null }

/** A department's Summary table: salaries, benefits, operating, equipment, positions, revenue. */
export async function getDepartmentBreakdown(db: Db, version: string, slug: string) {
  const rows = await db.select({ name: s.departments.name, metric: s.deptSummary.metric, actual2025: s.deptSummary.actual2025,
    adopted2026: s.deptSummary.adopted2026, requested2027: s.deptSummary.requested2027, proposed2027: s.deptSummary.proposed2027,
    changeFromAdopted: s.deptSummary.changeVsAdopted, changeFromRequest: s.deptSummary.changeVsRequested, cite: s.deptSummary.cite })
    .from(s.deptSummary).innerJoin(s.departments, eq(s.deptSummary.deptId, s.departments.id))
    .where(and(eq(s.deptSummary.budgetVersionId, versionId(version)), eq(s.departments.slug, slug)))
  if (!rows.length) return null
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    slug, name: rows[0].name, cite: rows[0].cite as Cite,
    rows: Object.keys(METRICS).flatMap((m) => {
      const r = rows.find((x) => x.metric === m)
      return r ? [{ metric: m, ...METRICS[m], actual2025: num(r.actual2025), adopted2026: num(r.adopted2026),
        requested2027: num(r.requested2027), proposed2027: num(r.proposed2027), ...changes(r) }] : []
    }) satisfies BreakdownRow[],
  }
}

/** Human-reviewed facts whose topic or statement matches the question (any word). */
export async function findBudgetFacts(db: Db, version: string, query: string, limit = 4) {
  const q = anyWords(query)
  if (!q) return []
  return db.select({ id: s.budgetFacts.id, topic: s.budgetFacts.topic, statement: s.budgetFacts.statement,
    context: s.budgetFacts.context, cite: s.budgetFacts.cite })
    .from(s.budgetFacts)
    .where(and(eq(s.budgetFacts.budgetVersionId, versionId(version)), isNotNull(s.budgetFacts.reviewedBy),
      sql`to_tsvector('english', ${s.budgetFacts.topic} || ' ' || ${s.budgetFacts.statement}) @@ websearch_to_tsquery('english', ${q})`))
    .orderBy(sql`ts_rank_cd(to_tsvector('english', ${s.budgetFacts.topic} || ' ' || ${s.budgetFacts.statement}), websearch_to_tsquery('english', ${q})) desc`)
    .limit(limit)
}

/** Glossary entries whose term or alias matches, closest first. */
export async function lookupGlossary(db: Db, version: string, term: string, limit = 3) {
  const t = term.trim().toLowerCase()
  if (!t) return []
  return db.select({ term: s.glossary.term, definition: s.glossary.plainDefinition, whyItMatters: s.glossary.whyItMatters,
    ours: sql<boolean>`${s.glossary.definitionSource} = 'ours'`, cite: s.glossary.cite })
    .from(s.glossary)
    .where(and(eq(s.glossary.budgetVersionId, versionId(version)),
      sql`(lower(${s.glossary.term}) like ${`%${t}%`} or ${t} like '%' || lower(${s.glossary.term}) || '%'
        or exists (select 1 from unnest(${s.glossary.aliases}) a where lower(a) = ${t})
        or word_similarity(${t}, lower(${s.glossary.term})) > 0.5)`))
    .orderBy(sql`word_similarity(${t}, lower(${s.glossary.term})) desc`)
    .limit(limit)
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))

/** Summary p.7: every budget section's total and property tax levy, with the tax rate each section
 *  adds per $1,000 of assessed value (only A, B, C, D and F have one). */
export async function getBudgetSections(db: Db, version: string) {
  const rows = await db.select().from(s.sectionTotals)
    .where(and(eq(s.sectionTotals.budgetVersionId, versionId(version)), sql`${s.sectionTotals.line} in ('budget', 'levy')`))
  const bySection = new Map<string, typeof rows>()
  for (const r of rows) bySection.set(r.section, [...(bySection.get(r.section) ?? []), r])
  // The whole city levy is printed on the A-F subtotal (sections G-N levy nothing; TOTAL has no levy line).
  const totalLevy = n(rows.find((r) => r.section === 'SUBTOTAL_ABCDF' && r.line === 'levy')?.proposed2027)
  const diff = (a: number | null, b: number | null, places = 0) => (a === null || b === null ? null : +(b - a).toFixed(places))
  return [...bySection].map(([section, rs]) => {
    const b = rs.find((r) => r.line === 'budget'), l = rs.find((r) => r.line === 'levy')
    const row = { budget2026: n(b?.adopted2026), budget2027: n(b?.proposed2027), levy2026: n(l?.adopted2026), levy2027: n(l?.proposed2027),
      rate2026: n(l?.taxRate2026), rate2027: n(l?.taxRate2027) }
    // Changes and shares worked out here, so the chat quotes them instead of doing arithmetic (principle 1).
    return { section, label: (b ?? l)!.label, cite: (b ?? l)!.cite as Cite, ...row,
      budgetChange: diff(row.budget2026, row.budget2027), levyChange: diff(row.levy2026, row.levy2027), rateChange: diff(row.rate2026, row.rate2027, 2),
      levySharePercent2027: row.levy2027 === null || !totalLevy ? null : Math.round((row.levy2027 / totalLevy) * 1000) / 10 }
  }).sort((a, b) => (a.section === 'TOTAL' ? 1 : b.section === 'TOTAL' ? -1 : a.section.localeCompare(b.section)))
}

export type Fund = 'general' | 'transportation-fund' | 'sewer-maintenance-fund' | 'employee-retirement'

/** Summary revenue tables by fund (general city purposes p.156-162; Transportation Fund p.190 incl.
 *  parking and streetcar; sewer; pensions), four stages each. */
export async function getRevenues(db: Db, version: string, fund: Fund) {
  const rows = await db.select({ category: s.revenues.category, line: s.revenues.line, isTotal: s.revenues.isTotal,
    adopted2026: s.revenues.adopted2026, requested2027: s.revenues.requested2027, proposed2027: s.revenues.proposed2027, cite: s.revenues.cite })
    .from(s.revenues)
    .where(and(eq(s.revenues.budgetVersionId, versionId(version)), eq(s.revenues.fund, fund), eq(s.revenues.source, 'summary')))
  return rows.filter((r) => fund !== 'general' || r.isTotal || /withdrawal|levy/i.test(r.line))
    .map((r) => {
      const row = { ...r, adopted2026: n(r.adopted2026), requested2027: n(r.requested2027), proposed2027: n(r.proposed2027) }
      const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a)
      return { ...row, changeFromAdopted: diff(row.adopted2026, row.proposed2027), changeFromRequest: diff(row.requested2027, row.proposed2027) }
    })
}

/** One printed revenue line in every fund's Summary table (e.g. Local Sales Tax: the general fund's share
 *  p.160 and the pension fund's share p.163), so a split is quoted from the page, not subtracted. */
export async function getRevenueLineByFund(db: Db, version: string, line: string) {
  const rows = await db.select({ fund: s.revenues.fund, line: s.revenues.line, adopted2026: s.revenues.adopted2026,
    requested2027: s.revenues.requested2027, proposed2027: s.revenues.proposed2027, cite: s.revenues.cite })
    .from(s.revenues)
    .where(and(eq(s.revenues.budgetVersionId, versionId(version)), eq(s.revenues.source, 'summary'), eq(s.revenues.line, line)))
  return rows.map((r) => ({ ...r, adopted2026: n(r.adopted2026), requested2027: n(r.requested2027), proposed2027: n(r.proposed2027) }))
}

/** Position changes a department's Summary page lists, with the document's own reason for each. */
export async function getPositionChanges(db: Db, version: string, slug: string) {
  return db.select({ positions: s.positionChanges.positions, title: s.positionChanges.title, reason: s.positionChanges.reason,
    reasonCategory: s.positionChanges.reasonCategory, cite: s.positionChanges.cite })
    .from(s.positionChanges).innerJoin(s.departments, eq(s.positionChanges.deptId, s.departments.id))
    .where(and(eq(s.positionChanges.budgetVersionId, versionId(version)), eq(s.departments.slug, slug), sql`not ${s.positionChanges.isTotal}`))
}

/** A department's performance measures as printed (column labels vary by department). */
export async function getPerformanceMeasures(db: Db, version: string, slug: string) {
  return db.select({ measure: s.kpis.measure, columns: s.kpis.colLabels, values: s.kpis.values, footnote: s.kpis.footnote, cite: s.kpis.cite })
    .from(s.kpis).innerJoin(s.departments, eq(s.kpis.deptId, s.departments.id))
    .where(and(eq(s.kpis.budgetVersionId, versionId(version)), eq(s.departments.slug, slug)))
}

/** Detailed budget line items (BMD-2) whose description or account matches, e.g. "overtime" or
 *  "634000". Without a department, totals by department so a citywide question stays small. */
export async function searchBudgetLines(db: Db, version: string, query: string, slug?: string) {
  const q = query.trim()
  const match = /^\d{4,6}$/.test(q) ? sql`${s.lineItems.account} like ${`${q}%`}` : sql`${s.lineItems.description} ilike ${`%${q}%`}`
  const rows = await db.select({ dept: s.departments.name, slug: s.departments.slug, description: s.lineItems.description, account: s.lineItems.account,
    actual2025: s.lineItems.actual2025, adopted2026: s.lineItems.adopted2026, requested2027: s.lineItems.requested2027, proposed2027: s.lineItems.proposed2027, cite: s.lineItems.cite })
    .from(s.lineItems).innerJoin(s.departments, eq(s.lineItems.deptId, s.departments.id))
    .where(and(eq(s.lineItems.budgetVersionId, versionId(version)), sql`not ${s.lineItems.isSubtotal}`, sql`not ${s.lineItems.isPosition}`, match,
      slug ? eq(s.departments.slug, slug) : sql`true`))
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a)
  const lines = rows.map((r) => {
    const l = { ...r, actual2025: n(r.actual2025), adopted2026: n(r.adopted2026), requested2027: n(r.requested2027), proposed2027: n(r.proposed2027) }
    return { ...l, changeFromAdopted: diff(l.adopted2026, l.proposed2027), changeFromRequest: diff(l.requested2027, l.proposed2027) }
  })
  if (slug) return { byDepartment: false as const, lines: lines.slice(0, 40) }
  const groups = new Map<string, { dept: string; slug: string; lineCount: number; adopted2026: number; requested2027: number; proposed2027: number; cite: Cite }>()
  for (const l of lines) {
    const g = groups.get(l.slug) ?? { dept: l.dept, slug: l.slug, lineCount: 0, adopted2026: 0, requested2027: 0, proposed2027: 0, cite: l.cite as Cite }
    groups.set(l.slug, { ...g, lineCount: g.lineCount + 1, adopted2026: g.adopted2026 + (l.adopted2026 ?? 0),
      requested2027: g.requested2027 + (l.requested2027 ?? 0), proposed2027: g.proposed2027 + (l.proposed2027 ?? 0) })
  }
  // Group changes are sums of the lines, worked out here so the chat never subtracts them itself.
  const withChanges = [...groups.values()].map((g) => ({ ...g, changeFromAdopted: g.proposed2027 - g.adopted2026, changeFromRequest: g.proposed2027 - g.requested2027 }))
  return { byDepartment: true as const, lines: withChanges.sort((a, b) => b.proposed2027 - a.proposed2027) }
}

/** Capital projects the Summary's department pages describe (kind 'project' from the extractor).
 *  List headings (whose amount sums the items under them) and funding sources are left out so a total
 *  never counts anything twice. A printed amount the document garbled keeps its text, amount null. */
export async function getCapitalProjects(db: Db, version: string, opts: { slug?: string; query?: string } = {}) {
  const q = opts.query?.trim()
  const rows = await db.select({ name: s.capitalProjects.name, amount: s.capitalProjects.amount, amountText: s.capitalProjects.amountText,
    description: s.capitalProjects.description, dept: s.departments.name, slug: s.departments.slug, cite: s.capitalProjects.cite })
    .from(s.capitalProjects).leftJoin(s.departments, eq(s.capitalProjects.deptId, s.departments.id))
    .where(and(eq(s.capitalProjects.budgetVersionId, versionId(version)), eq(s.capitalProjects.category, 'project'),
      opts.slug ? eq(s.departments.slug, opts.slug) : sql`true`,
      q ? sql`(${s.capitalProjects.name} ilike ${`%${q}%`} or ${s.capitalProjects.description} ilike ${`%${q}%`} or ${s.departments.name} ilike ${`%${q}%`})` : sql`true`))
  return rows.map((r) => ({ ...r, amount: n(r.amount),
    note: r.amount === null && r.amountText ? `The budget prints this as "${r.amountText}", so the amount is unclear.` : null }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
}
