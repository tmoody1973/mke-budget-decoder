// Budget figures for the "What's in the news" topics (lib/civic/news.ts). Each figure is a database
// row with its citation; the page formats and marks it. Nothing here comes from an article.
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { TopicId } from '@/lib/civic/news'

import { getDepartmentTotals, getHeadline, getSectionBudgets } from './overview'
import { getReceiptRates } from './receipt'
import * as s from './schema'
import type { Cite } from './schema'

type Db = NodePgDatabase<typeof s>

export type TopicFigure = {
  id: string; label: string; cite: Cite
  kind: 'dollars' | 'rate' | 'fee' // dollars: whole budget amounts; rate: $ per $1,000; fee: $ per household a year
  adopted2026: number | null; proposed2027: number
}

export async function getTopicFigures(db: Db, version: string): Promise<Record<TopicId, TopicFigure[]>> {
  const [h, depts, sections, rates] = await Promise.all([
    getHeadline(db, version), getDepartmentTotals(db, version), getSectionBudgets(db, version), getReceiptRates(db, version),
  ])
  const dept = (slug: string, label: string): TopicFigure => {
    const d = depts.find((x) => x.slug === slug)
    if (!d) throw new Error(`department ${slug} missing`)
    return { id: `news-${slug}`, label, cite: d.cite, kind: 'dollars', adopted2026: d.adopted2026, proposed2027: d.proposed2027 }
  }
  const g = sections.find((x) => x.section === 'G')
  if (!g) throw new Error('section G missing')
  const [lib] = await db.select({ amount: s.capitalProjects.amount, cite: s.capitalProjects.cite }).from(s.capitalProjects)
    .innerJoin(s.budgetVersions, eq(s.capitalProjects.budgetVersionId, s.budgetVersions.id))
    .where(and(eq(s.budgetVersions.slug, version), eq(s.capitalProjects.name, 'Branch Library New Construction')))
  if (!lib?.amount) throw new Error('Branch Library New Construction missing')
  const sw = rates.fees.solid_waste

  return {
    roads: [dept('dpw-infrastructure', 'Public Works, Infrastructure Services Division (streets, bridges, lighting)')],
    parking: [{ id: 'news-transportation-fund', label: 'Transportation Fund, which includes city parking', cite: g.cite, kind: 'dollars', adopted2026: g.adopted2026, proposed2027: g.proposed2027 }],
    'taxes-fees': [
      { id: 'news-levy', label: 'City property tax levy', cite: h.levy.cite, kind: 'dollars', adopted2026: h.levy.adopted2026, proposed2027: h.levy.proposed2027 },
      { id: 'news-rate', label: 'City tax rate per $1,000 of assessed value', cite: h.rate.cite, kind: 'rate', adopted2026: Number(h.rate.r2026), proposed2027: Number(h.rate.r2027) },
      { id: 'news-solid-waste', label: 'Solid waste (garbage) fee, per household a year', cite: sw.cite, kind: 'fee', adopted2026: Number(sw.v2026), proposed2027: Number(sw.v2027) },
    ],
    'public-safety': [dept('police', 'Police Department'), dept('fire', 'Fire Department')],
    buildings: [{ id: 'news-midtown-library', label: 'New Midtown branch library, 2027 capital budget', cite: lib.cite, kind: 'dollars', adopted2026: null, proposed2027: Number(lib.amount) }],
    gap: [],
  }
}
