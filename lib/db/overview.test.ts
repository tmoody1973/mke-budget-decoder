// @vitest-environment node
// P2.1: the Overview page's queries, checked against the golden numbers (docs/02 §7).
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { getDepartmentTotals, getGcpReconciliation, getHeadline, getRevenueMix, getSectionBudgets } from './overview'
import * as s from './schema'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL
const VERSION = '2027-proposed-3rd-run-2026-09-14'

describe.skipIf(!url)('overview queries (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  afterAll(() => pool.end())

  it('headline: G1 all funds, G2 general city purposes, levy and rate, each cited', async () => {
    const h = await getHeadline(db, VERSION)
    expect(h.allFunds).toMatchObject({ adopted2026: 2_075_687_722, proposed2027: 2_261_087_412 })
    expect(h.gcp).toMatchObject({ adopted2026: 815_673_383, proposed2027: 846_796_205 })
    expect(h.levy).toMatchObject({ adopted2026: 336_820_871, proposed2027: 343_557_288 })
    expect([h.rate.r2026, h.rate.r2027]).toEqual(['7.61', '7.29'])
    expect(h.allFunds.cite).toMatchObject({ doc: 'summary', printed_page: '7' })
  })

  it('section budgets: the lettered sections add up to the all-funds total', async () => {
    const rows = await getSectionBudgets(db, VERSION)
    expect(rows.map((r) => r.section)).toEqual(['A', 'B', 'C', 'D', 'F', 'G', 'H', 'I', 'J', 'K', 'M', 'N'])
    expect(rows.reduce((a, r) => a + r.proposed2027, 0)).toBe(2_261_087_412)
    // p.7: only A, B, C, D and F carry a city property tax rate
    expect(rows.filter((r) => r.taxRate2027 > 0).map((r) => r.section)).toEqual(['A', 'B', 'C', 'D', 'F'])
  })

  it('revenue mix: the sources add up exactly to general city purposes ($846,796,205)', async () => {
    const mix = await getRevenueMix(db, VERSION)
    expect(mix.reduce((a, r) => a + r.proposed2027, 0)).toBe(846_796_205)
    expect(mix.find((r) => r.key === 'levy')?.proposed2027).toBe(143_688_740)
    expect(mix.every((r) => r.cite.printed_page === '162' || r.cite.printed_page === '163' || Number(r.cite.printed_page) >= 156)).toBe(true)
  })

  it('departments: real departments only, with the four stages (G13 Police)', async () => {
    const d = await getDepartmentTotals(db, VERSION)
    const police = d.find((x) => x.slug === 'police')!
    expect([police.adopted2026, police.requested2027, police.proposed2027]).toEqual([310_111_835, 345_822_092, 343_937_125])
    expect(d.some((x) => ['fringe-benefit-offset', 'gcp-source-of-funds', 'special-purpose-accounts'].includes(x.slug))).toBe(false)
    expect(d.every((x) => x.requested2027 !== null && x.proposed2027 !== null)).toBe(true)
  })

  it('departments carry the changes the Summary prints, so the chat never subtracts (Library p.100, Fire p.91)', async () => {
    const d = await getDepartmentTotals(db, VERSION)
    const library = d.find((x) => x.slug === 'library')!, fire = d.find((x) => x.slug === 'fire')!
    expect([library.changeFromAdopted, library.changeFromRequest, library.percentChangeFromAdopted]).toEqual([1_490_755, -1_055_032, 4.4])
    expect([fire.changeFromAdopted, fire.changeFromRequest, fire.percentChangeFromAdopted]).toEqual([7_479_471, -5_872_611, 4.5])
    expect(d.every((x) => x.changeFromAdopted === x.proposed2027 - x.adopted2026)).toBe(true)
  })

  it('departments + special purpose accounts + fringe offset = general city purposes (adopted and proposed)', async () => {
    const [d, r, h] = await Promise.all([getDepartmentTotals(db, VERSION), getGcpReconciliation(db, VERSION), getHeadline(db, VERSION)])
    for (const k of ['adopted2026', 'proposed2027'] as const) {
      const sum = d.reduce((a, x) => a + x[k], 0) + r.specialPurpose[k] + r.fringeOffset[k]
      expect(sum).toBe(h.gcp[k])
    }
    expect(r.specialPurpose.cite).toMatchObject({ doc: 'detailed', printed_page: '400.1', line_no: 2 })
  })
})
