// Lookups for the chat agent beyond the Overview's queries: a department's cost breakdown, the
// human-reviewed budget facts, and the glossary. Every row keeps its citation.
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as s from './schema'
import type { Cite } from './schema'
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
  adopted2026: number | null; requested2027: number | null; proposed2027: number | null }

/** A department's Summary table: salaries, benefits, operating, equipment, positions, revenue. */
export async function getDepartmentBreakdown(db: Db, version: string, slug: string) {
  const rows = await db.select({ name: s.departments.name, metric: s.deptSummary.metric, actual2025: s.deptSummary.actual2025,
    adopted2026: s.deptSummary.adopted2026, requested2027: s.deptSummary.requested2027, proposed2027: s.deptSummary.proposed2027,
    cite: s.deptSummary.cite })
    .from(s.deptSummary).innerJoin(s.departments, eq(s.deptSummary.deptId, s.departments.id))
    .where(and(eq(s.deptSummary.budgetVersionId, versionId(version)), eq(s.departments.slug, slug)))
  if (!rows.length) return null
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    slug, name: rows[0].name, cite: rows[0].cite as Cite,
    rows: Object.keys(METRICS).flatMap((m) => {
      const r = rows.find((x) => x.metric === m)
      return r ? [{ metric: m, ...METRICS[m], actual2025: num(r.actual2025), adopted2026: num(r.adopted2026),
        requested2027: num(r.requested2027), proposed2027: num(r.proposed2027) }] : []
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
