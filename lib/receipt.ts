// City Receipt math (docs/07 §3). Pure: rates come in from the database (lib/db), so every rate
// carries its citation; this file only multiplies. All money is integer cents, rounded per line.
import type { Cite } from './db/schema'

type Rate = { r2026: string; r2027: string; cite: Cite } // $ per $1,000 of assessed value, as printed
type Fee = { v2026: string; v2027: string; cite: Cite }
export type FeeKey = 'solid_waste' | 'extra_cart' | 'snow_ice' | 'street_lighting' | 'sewer_stormwater_avg'

export type ReceiptRates = {
  total: Rate
  components: (Rate & { section: string; label: string })[]
  fees: Record<FeeKey, Fee>
}

export type ReceiptInput = {
  assessed2026: number // taxable assessment that funds the 2027 budget (MPROP C_A_TOTAL)
  assessed2025: number // prior-year assessment that funded 2026 (P_A_TOTAL)
  units: number // dwelling units (NR_UNITS)
  cityGarbage: boolean // decided 2026-09-23: class 1 residential with 1-4 units, labeled as assumed
  view: 'owner' | 'renter' | 'landlord'
  assessmentClass?: string | null
  frontageFt?: number
  extraCarts?: number
}

export type Amount = { c2026: number; c2027: number }
export type ReceiptLine = Amount & { key: string; label: string; cite: Cite }

export type Receipt =
  | { kind: 'exempt' }
  | { kind: 'state_assessed' }
  | { kind: 'no_assessment' }
  | { kind: 'no_dwellings' } // renter view of a parcel with no homes on it
  | {
      kind: 'estimate'
      view: ReceiptInput['view']
      paidBy: 'you' | 'owner'
      lines: ReceiptLine[]
      split: (ReceiptLine & { section: string })[] // property tax by budget section, 2027 only is exact
      splitRemainderC2027: number // rounding difference between the parts and the total rate
      total: Amount
      perMonth: Amount
      defaults: string[] // assumptions the UI must label
    }

export const DEFAULT_FRONTAGE_FT = 40 // the budget's own 'typical property' (docs/07 §2)
const hundredths = (s: string) => Math.round(Number(s) * 100)
const taxCents = (assessed: number, rate: string) => Math.round((assessed * hundredths(rate)) / 1000)
const per = (c: number, share: number) => Math.round(c / share)

export function computeReceipt(input: ReceiptInput, rates: ReceiptRates): Receipt {
  if (input.assessmentClass === '9') return { kind: 'exempt' }
  if (input.assessmentClass === '3') return { kind: 'state_assessed' }
  if (!(input.assessed2026 > 0)) return { kind: 'no_assessment' }
  if (input.view === 'renter' && input.units === 0) return { kind: 'no_dwellings' }

  const units = Math.max(1, input.units)
  const share = input.view === 'renter' ? units : 1 // renter sees their unit's share; owner/landlord the parcel
  const frontage = input.frontageFt ?? DEFAULT_FRONTAGE_FT
  const defaults = input.frontageFt === undefined ? ['frontage_40ft'] : []
  if (input.cityGarbage) defaults.push('city_garbage_assumed')
  const f = rates.fees
  const fee = (k: FeeKey, qty: number): Amount => ({
    c2026: per(Math.round(hundredths(f[k].v2026) * qty), share), c2027: per(Math.round(hundredths(f[k].v2027) * qty), share),
  })

  const lines: ReceiptLine[] = [{
    key: 'property_tax', label: 'City property tax', cite: rates.total.cite,
    c2026: per(taxCents(input.assessed2025, rates.total.r2026), share),
    c2027: per(taxCents(input.assessed2026, rates.total.r2027), share),
  }]
  if (input.cityGarbage) {
    lines.push({ key: 'solid_waste', label: 'Solid waste fee', cite: f.solid_waste.cite, ...fee('solid_waste', units) })
    if (input.extraCarts) lines.push({ key: 'extra_carts', label: 'Extra garbage carts', cite: f.extra_cart.cite, ...fee('extra_cart', input.extraCarts) })
  }
  if (input.view === 'owner') {
    lines.push({ key: 'snow_ice', label: `Snow & ice (${frontage}\u00a0ft)`, cite: f.snow_ice.cite, ...fee('snow_ice', frontage) })
    lines.push({ key: 'street_lighting', label: `Street lighting (${frontage}\u00a0ft)`, cite: f.street_lighting.cite, ...fee('street_lighting', frontage) })
  } else {
    const s = fee('snow_ice', frontage), l = fee('street_lighting', frontage)
    lines.push({ key: 'frontage', label: `Snow & ice and lighting (${frontage}\u00a0ft)`, cite: f.snow_ice.cite,
      c2026: s.c2026 + l.c2026, c2027: s.c2027 + l.c2027 })
  }
  // Sewer is an average-household charge per dwelling unit (docs/07 §3); vacant land has none.
  if (input.units > 0) lines.push({ key: 'sewer_stormwater', label: 'Sewer + stormwater',
    cite: f.sewer_stormwater_avg.cite, ...fee('sewer_stormwater_avg', input.units) })

  const split = rates.components.map((c) => ({
    key: `split_${c.section}`, section: c.section, label: c.label, cite: c.cite,
    c2026: per(taxCents(input.assessed2025, c.r2026), share), c2027: per(taxCents(input.assessed2026, c.r2027), share),
  }))
  const total = lines.reduce((a, l) => ({ c2026: a.c2026 + l.c2026, c2027: a.c2027 + l.c2027 }), { c2026: 0, c2027: 0 })
  return {
    kind: 'estimate', view: input.view, paidBy: input.view === 'owner' ? 'you' : 'owner', lines, split,
    splitRemainderC2027: lines[0].c2027 - split.reduce((a, s) => a + s.c2027, 0),
    total, perMonth: { c2026: Math.round(total.c2026 / 12), c2027: Math.round(total.c2027 / 12) }, defaults,
  }
}

const PER_FOOT: FeeKey[] = ['snow_ice', 'street_lighting']
/** Each fee with its change, and the per-foot fees for the budget's typical 40-foot property (p.141),
 *  worked out here so the chat quotes them instead of multiplying or subtracting (principle 1). */
export function feeChanges(fees: ReceiptRates['fees']) {
  return Object.fromEntries(Object.entries(fees).map(([k, f]) => {
    const a = Number(f.v2026), b = Number(f.v2027)
    return [k, { ...f, change: +(b - a).toFixed(2), percentChange: Math.round(((b - a) / a) * 1000) / 10,
      ...(PER_FOOT.includes(k as FeeKey) ? { typicalProperty: { frontageFeet: DEFAULT_FRONTAGE_FT, page: '141',
        cost2026: +(a * DEFAULT_FRONTAGE_FT).toFixed(2), cost2027: +(b * DEFAULT_FRONTAGE_FT).toFixed(2),
        costChange: +((b - a) * DEFAULT_FRONTAGE_FT).toFixed(2) } } : {}) }]
  }))
}

type Estimate = Extract<Receipt, { kind: 'estimate' }>
const dollars = (cents: number) => Math.round(cents) / 100
/** The receipt in dollars, with every change worked out here: the chat quotes these instead of
 *  converting cents or dividing by 12 itself (a slip there once turned $173.39 a month into "$17.34 more"). */
export function receiptInDollars(r: Estimate, assessed?: { a2025?: number; a2026: number }) {
  const change = (a: { c2026: number; c2027: number }) => dollars(a.c2027 - a.c2026)
  const services = r.lines.filter((l) => l.key !== 'property_tax')
  const servicesTotal = services.reduce((a, l) => ({ c2026: a.c2026 + l.c2026, c2027: a.c2027 + l.c2027 }), { c2026: 0, c2027: 0 })
  const tax = r.lines.find((l) => l.key === 'property_tax')
  return {
    lines: r.lines.map((l) => ({ label: l.label, dollars2026: dollars(l.c2026), dollars2027: dollars(l.c2027), change: change(l) })),
    total: { dollars2026: dollars(r.total.c2026), dollars2027: dollars(r.total.c2027), changePerYear: change(r.total),
      changePerMonth: dollars((r.total.c2027 - r.total.c2026) / 12) },
    perMonth: { dollars2026: dollars(r.perMonth.c2026), dollars2027: dollars(r.perMonth.c2027) },
    propertyTaxChange: tax ? change(tax) : null,
    serviceChargesChange: change(servicesTotal),
    ...(assessed?.a2025 ? { assessmentChangePercent: Math.round(((assessed.a2026 - assessed.a2025) / assessed.a2025) * 1000) / 10 } : {}),
  }
}
