// Per-visitor request cap for the address and receipt endpoints (docs/07 §8: no scraping).
// ponytail: in-memory, so each server instance counts separately and a restart resets it.
// Upgrade path: a Vercel Firewall rate-limit rule at deploy, or a shared store if abuse shows up.
const hits = new Map<string, number[]>()

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return false
  }
  hits.set(key, [...recent, now])
  return true
}

export const clientKey = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
