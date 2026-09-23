// @vitest-environment node
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { computeReceipt } from '../receipt'
import { RATES } from '../receipt.fixture'
import { getParcelFacts, getReceiptRates } from './receipt'
import * as s from './schema'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL
const VERSION = '2027-proposed-3rd-run-2026-09-14'

describe.skipIf(!url)('receipt data (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  afterAll(() => pool.end())

  it('rates and fees in the database equal the worked-example fixture, with citations', async () => {
    const r = await getReceiptRates(db, VERSION)
    const strip = (x: typeof RATES) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'cite' ? undefined : v)))
    expect(strip(r)).toEqual(strip(RATES))
    expect(r.total.cite).toMatchObject({ doc: 'summary', printed_page: '7' })
    expect(r.fees.solid_waste.cite).toMatchObject({ doc: 'summary', printed_page: '159' })
  })

  it('a real parcel produces a receipt end to end (2401 W Wisconsin Av)', async () => {
    const p = await getParcelFacts(db, '4000708100')
    expect(p).toMatchObject({ taxkey: '4000708100', assessmentClass: '2', units: 5, cityGarbage: false })
    const r = computeReceipt({ ...p!, view: 'owner' }, await getReceiptRates(db, VERSION))
    expect(r.kind).toBe('estimate')
  })

  it('an exempt parcel says exempt', async () => {
    const p = await getParcelFacts(db, '0010022000')
    expect(computeReceipt({ ...p!, view: 'owner' }, RATES)).toEqual({ kind: 'exempt' })
  })

  it('unknown taxkey returns null', async () => {
    expect(await getParcelFacts(db, '0000000000')).toBeNull()
  })
})
