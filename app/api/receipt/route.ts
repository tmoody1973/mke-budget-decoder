// City Receipt for one parcel (by taxkey) or for a typed-in assessed value (condos, or anyone who
// prefers not to give an address). POST keeps the taxkey out of URL logs (docs/07 §8).
import { allow, clientKey } from '@/lib/rate-limit'
import { receiptFromBody } from '@/lib/receipt-request'

export async function POST(req: Request) {
  if (!allow(`receipt:${clientKey(req)}`, 20, 60_000)) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }
  const r = await receiptFromBody((await req.json().catch(() => null)) as Record<string, unknown> | null)
  return 'error' in r ? Response.json({ error: r.error }, { status: r.status }) : Response.json(r)
}
