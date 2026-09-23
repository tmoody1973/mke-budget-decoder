// @vitest-environment node
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { normalizeAddress, searchAddresses } from './parcels'
import * as s from './schema'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL

describe('normalizeAddress', () => {
  it.each([
    ['2400 w. Wisconsin Ave, Milwaukee, WI 53233', { houseNr: 2400, street: 'W WISCONSIN AV' }],
    ['123 North Lincoln Memorial Drive', { houseNr: 123, street: 'N LINCOLN MEMORIAL DR' }],
    ['5 w court st', { houseNr: 5, street: 'W COURT ST' }], // 'COURT' is the name, not the type
    ['1300 n prospect', { houseNr: 1300, street: 'N PROSPECT' }],
    ['2400 w wisconsin', { houseNr: 2400, street: 'W WISCONSIN' }], // the street, not the state
    ['2400 W Wisconsin Av Milwaukee Wisconsin', { houseNr: 2400, street: 'W WISCONSIN AV' }],
    ['e juneau avenue', { houseNr: null, street: 'E JUNEAU AV' }],
    ['3rd st', { houseNr: null, street: '3RD ST' }], // numbered street, no house number
    ['1234a n 27th st', { houseNr: 1234, street: 'N 27TH ST' }],
    ['4500 s 20th lane', { houseNr: 4500, street: 'S 20TH LA' }], // Milwaukee writes Lane as LA
  ])('%s', (input, expected) => expect(normalizeAddress(input)).toEqual(expected))
})

describe.skipIf(!url)('searchAddresses (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  afterAll(() => pool.end())

  it('finds the exact parcel for a full address', async () => {
    const [first] = await searchAddresses(db, '2401 W Wisconsin Ave')
    expect(first).toEqual({ taxkey: '4000708100', address: '2401 W WISCONSIN AV', exactNumber: true, parcels: 1 })
  })

  it('tolerates a typo and a missing street type', async () => {
    const [first] = await searchAddresses(db, '2401 w wiscosin')
    expect(first?.taxkey).toBe('4000708100')
  })

  it('offers the nearest numbers when the typed number is not a parcel', async () => {
    const res = await searchAddresses(db, '2400 w wisconsin')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((r) => r.address.includes('W WISCONSIN AV'))).toBe(true)
    expect(res[0].address.startsWith('2401')).toBe(true) // closest to 2400
  })

  it('matches a number inside a parcel range', async () => {
    const [r] = (await pool.query(
      'select house_nr_lo, house_nr_hi, sdir, street, taxkey from parcels where house_nr_hi > house_nr_lo + 4 and street is not null limit 1',
    )).rows
    const res = await searchAddresses(db, `${r.house_nr_lo + 2} ${r.sdir ?? ''} ${r.street}`)
    expect(res.find((m) => m.taxkey === r.taxkey)?.exactNumber).toBe(true)
  })

  it('returns only address and taxkey, never assessment or owner data', async () => {
    const [first] = await searchAddresses(db, '2401 W Wisconsin Ave')
    expect(Object.keys(first).sort()).toEqual(['address', 'exactNumber', 'parcels', 'taxkey'])
  })

  it('collapses a condo building to one row with no taxkey', async () => {
    const [first] = await searchAddresses(db, '1300 n prospect ave')
    expect(first).toMatchObject({ address: '1300 N PROSPECT AV', taxkey: null, exactNumber: true })
    expect(first.parcels).toBeGreaterThan(300)
  })
})
