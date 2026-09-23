// Receipt inputs from the database: cited rates (section_totals p.7, fees p.159/p.203) and the one
// parcel a resident picked. The arithmetic lives in lib/receipt.ts.
import { and, eq, inArray } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { FeeKey, ReceiptInput, ReceiptRates } from '../receipt'
import * as s from './schema'

type Db = NodePgDatabase<typeof s>

// Plain-language names for the tax-rate parts, in the order the receipt lists them.
const SECTIONS: [string, string][] = [
  ['A', 'City operations (General City Purposes)'], ['D', 'Debt'], ['B', 'Pensions (Employee Retirement)'],
  ['F', 'Contingent fund'], ['C', 'Capital improvements'],
]
const FEES: FeeKey[] = ['solid_waste', 'extra_cart', 'snow_ice', 'street_lighting', 'sewer_stormwater_avg']

export async function getReceiptRates(db: Db, versionSlug: string): Promise<ReceiptRates> {
  const [v] = await db.select().from(s.budgetVersions).where(eq(s.budgetVersions.slug, versionSlug))
  if (!v) throw new Error(`budget version ${versionSlug} not loaded`)
  const rates = await db.select().from(s.sectionTotals).where(and(eq(s.sectionTotals.budgetVersionId, v.id),
    eq(s.sectionTotals.line, 'levy'), inArray(s.sectionTotals.section, ['TOTAL', ...SECTIONS.map(([k]) => k)])))
  const bySection = new Map(rates.map((r) => [r.section, r]))
  const rate = (k: string) => {
    const r = bySection.get(k)
    if (!r?.taxRate2026 || !r.taxRate2027) throw new Error(`tax rate for section ${k} missing`)
    return { r2026: r.taxRate2026, r2027: r.taxRate2027, cite: r.cite }
  }
  const feeRows = await db.select().from(s.fees).where(and(eq(s.fees.budgetVersionId, v.id), inArray(s.fees.fee, FEES)))
  const fees = Object.fromEntries(FEES.map((k) => {
    const f = feeRows.find((r) => r.fee === k)
    if (!f?.value2026 || !f.value2027) throw new Error(`fee ${k} missing`)
    return [k, { v2026: f.value2026, v2027: f.value2027, cite: f.cite }]
  })) as ReceiptRates['fees']
  return { total: rate('TOTAL'), components: SECTIONS.map(([k, label]) => ({ section: k, label, ...rate(k) })), fees }
}

export type ParcelFacts = Omit<ReceiptInput, 'view' | 'frontageFt' | 'extraCarts'> & {
  taxkey: string; ownerOccupied: boolean; yrAssmt: string | null; snapshotDate: string
}

/** The receipt inputs for one taxkey. Garbage rule (decided 2026-09-23): the city solid waste fee
 *  applies to class 1 residential with 1-4 units, shown as an assumption. */
export async function getParcelFacts(db: Db, taxkey: string): Promise<ParcelFacts | null> {
  const [p] = await db.select().from(s.parcels).where(eq(s.parcels.taxkey, taxkey))
  if (!p) return null
  const units = p.nrUnits ?? 0
  return {
    taxkey: p.taxkey, assessed2026: p.cATotal ?? 0, assessed2025: p.pATotal ?? 0, units,
    assessmentClass: p.cAClass, cityGarbage: p.cAClass === '1' && units >= 1 && units <= 4,
    ownerOccupied: p.ownOcpd === 'O', yrAssmt: p.yrAssmt, snapshotDate: p.snapshotDate,
  }
}
