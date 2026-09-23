import { describe, expect, it } from 'vitest'

import { computeReceipt } from './receipt'
import { RATES } from './receipt.fixture'

const line = (r: ReturnType<typeof computeReceipt>, key: string) => {
  if (r.kind !== 'estimate') throw new Error(r.kind)
  return r.lines.find((l) => l.key === key)!
}

describe('docs/07 §4 worked examples (exact to the cent)', () => {
  it('owner: single-family, $200,000 (2026) / $188,000 (2025), 40 ft, city garbage', () => {
    const r = computeReceipt({ assessed2026: 200_000, assessed2025: 188_000, units: 1, cityGarbage: true,
      frontageFt: 40, view: 'owner' }, RATES)
    if (r.kind !== 'estimate') throw new Error(r.kind)
    expect([line(r, 'property_tax').c2026, line(r, 'property_tax').c2027]).toEqual([143068, 145800])
    expect(r.split.map((s) => s.c2027)).toEqual([61000, 46200, 36000, 2200, 400])
    expect([line(r, 'solid_waste').c2027, line(r, 'snow_ice').c2027, line(r, 'street_lighting').c2027,
      line(r, 'sewer_stormwater').c2027]).toEqual([28000, 4920, 4640, 24702])
    expect([r.total.c2026, r.total.c2027]).toEqual([203676, 208062]) // $2,036.76 → $2,080.62
  })

  it('renter: one unit of a 4-unit building, $320,000 / $305,000', () => {
    const r = computeReceipt({ assessed2026: 320_000, assessed2025: 305_000, units: 4, cityGarbage: true,
      frontageFt: 40, view: 'renter' }, RATES)
    if (r.kind !== 'estimate') throw new Error(r.kind)
    expect([line(r, 'property_tax').c2026, line(r, 'property_tax').c2027]).toEqual([58026, 58320])
    expect([line(r, 'frontage').c2026, line(r, 'frontage').c2027]).toEqual([2310, 2390])
    expect([r.total.c2026, r.total.c2027]).toEqual([111704, 113412]) // per unit per year
    expect([r.perMonth.c2026, r.perMonth.c2027]).toEqual([9309, 9451]) // $93.09 → $94.51
    expect(r.paidBy).toBe('owner')
  })
})

describe('when the receipt must not estimate', () => {
  it('exempt property (class 9)', () => {
    expect(computeReceipt({ assessed2026: 0, assessed2025: 0, units: 0, cityGarbage: false, view: 'owner',
      assessmentClass: '9' }, RATES)).toEqual({ kind: 'exempt' })
  })
  it('manufacturing is state-assessed (class 3)', () => {
    expect(computeReceipt({ assessed2026: 0, assessed2025: 0, units: 0, cityGarbage: false, view: 'owner',
      assessmentClass: '3' }, RATES)).toEqual({ kind: 'state_assessed' })
  })
})

describe('defaults and labels', () => {
  it('frontage defaults to 40 ft, labeled as the budget typical property', () => {
    const r = computeReceipt({ assessed2026: 200_000, assessed2025: 188_000, units: 1, cityGarbage: true, view: 'owner' }, RATES)
    expect(r.kind === 'estimate' && r.defaults).toContain('frontage_40ft')
  })
  it('no city garbage: the solid waste line is left out, not zeroed', () => {
    const r = computeReceipt({ assessed2026: 200_000, assessed2025: 188_000, units: 1, cityGarbage: false,
      frontageFt: 40, view: 'owner' }, RATES)
    expect(r.kind === 'estimate' && r.lines.some((l) => l.key === 'solid_waste')).toBe(false)
  })
  it('a half cent rounds up ($150,000 ÷ 4 units at $7.29 = $273.375 → $273.38)', () => {
    const r = computeReceipt({ assessed2026: 150_000, assessed2025: 150_000, units: 4, cityGarbage: false,
      frontageFt: 40, view: 'renter' }, RATES)
    expect(line(r, 'property_tax').c2027).toBe(27338)
  })
  it('vacant land (no dwelling units) gets no household sewer charge', () => {
    const r = computeReceipt({ assessed2026: 7_800, assessed2025: 7_800, units: 0, cityGarbage: false,
      frontageFt: 40, view: 'owner' }, RATES)
    expect(r.kind === 'estimate' && r.lines.map((l) => l.key)).toEqual(['property_tax', 'snow_ice', 'street_lighting'])
  })
  it('extra carts are charged per cart', () => {
    const r = computeReceipt({ assessed2026: 200_000, assessed2025: 188_000, units: 1, cityGarbage: true,
      frontageFt: 40, extraCarts: 2, view: 'owner' }, RATES)
    expect([line(r, 'extra_carts').c2026, line(r, 'extra_carts').c2027]).toEqual([16248, 16736])
  })
})
