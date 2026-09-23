// Address search for the City Receipt (docs/07, D15). Returns addresses and taxkeys only; the
// receipt reads assessed values separately, for the one parcel the user picks.
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from './schema'

type Db = NodePgDatabase<typeof schema>

// MPROP Appendix I: Milwaukee's official street-type codes (LA = Lane, TR = Terrace, WA = Way…)
const STREET_TYPES: Record<string, string> = {
  AV: 'AV', AVE: 'AV', AVENUE: 'AV', BL: 'BL', BLVD: 'BL', BOULEVARD: 'BL', CR: 'CR', CIR: 'CR', CIRCLE: 'CR',
  CT: 'CT', COURT: 'CT', DR: 'DR', DRIVE: 'DR', LA: 'LA', LN: 'LA', LANE: 'LA', PK: 'PK', PKWY: 'PK', PARKWAY: 'PK',
  PL: 'PL', PLACE: 'PL', RD: 'RD', ROAD: 'RD', ST: 'ST', STREET: 'ST', TR: 'TR', TER: 'TR', TERRACE: 'TR',
  WA: 'WA', WAY: 'WA',
}
const DIRECTIONS: Record<string, string> = { N: 'N', NORTH: 'N', S: 'S', SOUTH: 'S', E: 'E', EAST: 'E', W: 'W', WEST: 'W' }

export type NormalizedAddress = { houseNr: number | null; street: string }

/** '2400 w. Wisconsin Ave, Milwaukee, WI 53233' → { houseNr: 2400, street: 'W WISCONSIN AV' } */
export function normalizeAddress(input: string): NormalizedAddress {
  const tokens = input.toUpperCase().replace(/[.,#]/g, ' ').split(/\s+/).filter(Boolean)
  // drop a trailing ZIP, state and city. 'WISCONSIN' only after 'MILWAUKEE': W Wisconsin Av is a street
  if (/^\d{5}(-\d{4})?$/.test(tokens.at(-1) ?? '') && tokens.length > 2) tokens.pop()
  if (tokens.at(-1) === 'WI' || (tokens.at(-1) === 'WISCONSIN' && tokens.at(-2) === 'MILWAUKEE')) tokens.pop()
  if (tokens.at(-1) === 'MILWAUKEE' && tokens.length > 2) tokens.pop()
  const first = tokens[0]?.match(/^(\d+)-?[A-Z]?$/) // '1234' or '1234A'; not '3RD' (a street)
  const houseNr = first ? Number(first[1]) : null
  const rest = first ? tokens.slice(1) : tokens
  const words = rest.map((t, i) => {
    if (i === 0 && DIRECTIONS[t]) return DIRECTIONS[t]
    if (i === rest.length - 1 && i > 0 && STREET_TYPES[t]) return STREET_TYPES[t] // 'COURT ST' keeps COURT
    return t
  })
  return { houseNr, street: words.join(' ') }
}

export type AddressMatch = {
  taxkey: string | null // null when several parcels share the address (condos): no unit field to pick one
  address: string // as MPROP writes it, with the range when the parcel spans several numbers
  exactNumber: boolean // the typed house number falls inside this parcel's range
  parcels: number // how many parcels share this address
}

/** Up to `limit` parcels that look like the typed address: exact house-number matches first,
 *  then the nearest numbers on the best-matching street. Typo-tolerant (pg_trgm word similarity). */
export async function searchAddresses(db: Db, input: string, limit = 8): Promise<AddressMatch[]> {
  const { houseNr, street } = normalizeAddress(input)
  if (street.length < 3) return []
  // Repeated addresses (condo units) collapse to one row: 1300 N Prospect Av has 312 parcels.
  const rows = await db.execute(sql`
    select min(taxkey) as taxkey, count(*)::int as n, house_nr_lo, house_nr_hi, house_nr_sfx, sdir, street, sttype,
           (${houseNr}::int is not null and ${houseNr}::int between house_nr_lo and house_nr_hi) as exact,
           max(word_similarity(${street}, address)) as sim
    from parcels
    where ${street} <% address
    group by house_nr_lo, house_nr_hi, house_nr_sfx, sdir, street, sttype
    order by exact desc, sim desc, abs(house_nr_lo - coalesce(${houseNr}::int, house_nr_lo)), house_nr_lo
    limit ${limit}`)
  return (rows.rows as Record<string, string | number | boolean | null>[]).map((r) => {
    const num = r.house_nr_hi !== r.house_nr_lo ? `${r.house_nr_lo}-${r.house_nr_hi}` : String(r.house_nr_lo)
    const parts = [`${num}${r.house_nr_sfx ?? ''}`, r.sdir, r.street, r.sttype].filter(Boolean)
    const n = Number(r.n)
    return { taxkey: n === 1 ? String(r.taxkey) : null, address: parts.join(' '), exactNumber: Boolean(r.exact), parcels: n }
  })
}
