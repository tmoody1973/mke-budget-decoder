// City Receipt for one parcel (by taxkey) or for a typed-in assessed value (condos, or anyone who
// prefers not to give an address). POST keeps the taxkey out of URL logs (docs/07 §8).
import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import { getParcelFacts, getReceiptRates } from '@/lib/db/receipt'
import { allow, clientKey } from '@/lib/rate-limit'
import { computeReceipt, type ReceiptInput, type ReceiptRates } from '@/lib/receipt'

const VIEWS = ['owner', 'renter', 'landlord'] as const
let rates: Promise<ReceiptRates> | null = null // same for every request; read once per instance

const intIn = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null)
const bad = (error: string) => Response.json({ error }, { status: 400 })

export async function POST(req: Request) {
  if (!allow(`receipt:${clientKey(req)}`, 20, 60_000)) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return bad('Send a JSON body.')
  const view = VIEWS.find((v) => v === b.view)
  if (!view) return bad('view must be owner, renter or landlord.')
  const frontageFt = b.frontageFt === undefined ? undefined : intIn(b.frontageFt, 1, 2000)
  const extraCarts = b.extraCarts === undefined ? 0 : intIn(b.extraCarts, 0, 10)
  if (frontageFt === null) return bad('frontageFt must be a whole number of feet, 1 to 2,000.')
  if (extraCarts === null) return bad('extraCarts must be 0 to 10.')

  try {
    rates ??= getReceiptRates(getDb(), BUDGET_VERSION)
    let input: ReceiptInput
    let parcel: Record<string, unknown> | null = null
    if (typeof b.taxkey === 'string') {
      if (!/^\d{10}$/.test(b.taxkey)) return bad('taxkey must be 10 digits.')
      const facts = await getParcelFacts(getDb(), b.taxkey)
      if (!facts) return Response.json({ error: 'No property with that tax key.' }, { status: 404 })
      const { taxkey: _t, ...rest } = facts
      input = { ...rest, view, frontageFt, extraCarts }
      parcel = { assessed2026: facts.assessed2026, assessed2025: facts.assessed2025, units: facts.units,
        assessmentClass: facts.assessmentClass, ownerOccupied: facts.ownerOccupied, yrAssmt: facts.yrAssmt,
        snapshotDate: facts.snapshotDate }
    } else {
      const assessed2026 = intIn(b.assessed2026, 1, 1_000_000_000)
      if (assessed2026 === null) return bad('Send a taxkey, or assessed2026 as whole dollars.')
      const assessed2025 = b.assessed2025 === undefined ? assessed2026 : intIn(b.assessed2025, 1, 1_000_000_000)
      const units = b.units === undefined ? 1 : intIn(b.units, 1, 999)
      // a condo unit in a big building: the building's size decides city garbage service (1-4 units)
      const buildingUnits = b.buildingUnits === undefined ? units : intIn(b.buildingUnits, 1, 5000)
      if (assessed2025 === null || units === null || buildingUnits === null) {
        return bad('assessed2025, units and buildingUnits must be whole numbers.')
      }
      input = { assessed2026, assessed2025, units, cityGarbage: buildingUnits <= 4, view, frontageFt, extraCarts }
    }
    return Response.json({ receipt: computeReceipt(input, await rates), parcel, budget: BUDGET_VERSION })
  } catch {
    rates = null
    console.error('receipt failed') // no taxkey or address in logs
    return Response.json({ error: 'The receipt is unavailable right now.' }, { status: 500 })
  }
}
