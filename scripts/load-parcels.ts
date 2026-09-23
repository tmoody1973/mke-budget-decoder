/**
 * Load the MPROP snapshot (data/processed/parcels.parquet) into `parcels`, replacing the previous
 * snapshot in one transaction (same all-or-nothing rule as D14). Run by `pnpm mprop:refresh`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { Pool } from 'pg'

import * as s from '../lib/db/schema'

config({ path: '.env.local' })

const DIR = join(process.cwd(), 'data', 'processed')
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set (.env.local)')
  const meta = JSON.parse(readFileSync(join(DIR, 'parcels_meta.json'), 'utf8')) as { snapshot_date: string; rows: number }
  const rows = (await parquetReadObjects({ file: await asyncBufferFromFile(join(DIR, 'parcels.parquet')) })).map((r) => ({
    taxkey: String(r.TAXKEY), snapshotDate: meta.snapshot_date, yrAssmt: str(r.YR_ASSMT), taxRateCd: str(r.TAX_RATE_CD),
    houseNrLo: num(r.HOUSE_NR_LO), houseNrHi: num(r.HOUSE_NR_HI), houseNrSfx: str(r.HOUSE_NR_SFX), sdir: str(r.SDIR),
    street: str(r.STREET), sttype: str(r.STTYPE), cAClass: str(r.C_A_CLASS), cATotal: num(r.C_A_TOTAL),
    cAExmType: str(r.C_A_EXM_TYPE), cAExmTotal: num(r.C_A_EXM_TOTAL), pATotal: num(r.P_A_TOTAL),
    pAExmTotal: num(r.P_A_EXM_TOTAL), nrUnits: num(r.NR_UNITS), ownOcpd: str(r.OWN_OCPD), landUse: str(r.LAND_USE),
    landUseGp: str(r.LAND_USE_GP), bldgType: str(r.BLDG_TYPE), dpwSanitation: str(r.DPW_SANITATION),
    geoAlder: str(r.GEO_ALDER), lotArea: str(r.LOT_AREA), cornerLot: str(r.CORNER_LOT),
  }))
  if (rows.length !== meta.rows) throw new Error(`parquet has ${rows.length} rows, meta says ${meta.rows}`)

  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  try {
    await db.transaction(async (tx) => {
      await tx.delete(s.parcels)
      for (let i = 0; i < rows.length; i += 1000) await tx.insert(s.parcels).values(rows.slice(i, i + 1000))
    })
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from parcels`)).rows as { n: number }[]
    process.stdout.write(`${JSON.stringify({ snapshot_date: meta.snapshot_date, loaded: n })}\n`)
  } catch (err) {
    const cause = (err as { cause?: { message?: string } }).cause
    process.stderr.write(`load-parcels failed: ${cause?.message ?? String(err).slice(0, 300)}\n`)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
