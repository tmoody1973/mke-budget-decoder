// Address suggestions for the City Receipt. POST so the typed address stays out of URL logs
// (docs/07 §8: typed addresses are never logged or stored).
import { getDb } from '@/lib/db/client'
import { searchAddresses } from '@/lib/db/parcels'
import { allow, clientKey } from '@/lib/rate-limit'

export async function POST(req: Request) {
  if (!allow(`address:${clientKey(req)}`, 60, 60_000)) {
    return Response.json({ error: 'Too many searches. Try again in a minute.' }, { status: 429 })
  }
  const body = (await req.json().catch(() => null)) as { q?: unknown } | null
  const q = typeof body?.q === 'string' ? body.q.trim() : ''
  if (q.length < 3 || q.length > 100) {
    return Response.json({ error: 'Type at least 3 characters of a Milwaukee street address.' }, { status: 400 })
  }
  try {
    return Response.json({ results: await searchAddresses(getDb(), q) })
  } catch {
    console.error('address search failed') // no query text in logs
    return Response.json({ error: 'Address search is unavailable right now.' }, { status: 500 })
  }
}
