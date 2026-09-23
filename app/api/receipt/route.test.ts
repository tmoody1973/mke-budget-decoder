// @vitest-environment node
import { config } from 'dotenv'
import { describe, expect, it } from 'vitest'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL
const post = (body: unknown, ip = '203.0.113.1') =>
  new Request('http://x/api/receipt', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip } })

describe.skipIf(!url)('POST /api/receipt and /api/address', () => {
  it('manual mode reproduces the docs/07 owner example', async () => {
    const { POST } = await import('./route')
    const res = await POST(post({ view: 'owner', assessed2026: 200_000, assessed2025: 188_000, frontageFt: 40 }))
    const { receipt } = await res.json()
    expect(receipt.total).toEqual({ c2026: 203676, c2027: 208062 })
  })

  it('a real parcel by taxkey returns a receipt and no owner data', async () => {
    const { POST } = await import('./route')
    const body = await (await POST(post({ view: 'owner', taxkey: '4000708100' }))).json()
    expect(body.receipt.kind).toBe('estimate')
    expect(JSON.stringify(body)).not.toMatch(/OWNER_NAME|OWNER_MAIL|OWNER_CITY|OWNER_ZIP|ownerName|mailing/i)
  })

  it('rejects bad input with a plain message', async () => {
    const { POST } = await import('./route')
    for (const b of [{ view: 'x' }, { view: 'owner', taxkey: '12' }, { view: 'owner', assessed2026: -5 }, { view: 'owner', frontageFt: 1.5, assessed2026: 1 }]) {
      const res = await POST(post(b))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBeTruthy()
    }
  })

  it('caps requests per visitor', async () => {
    const { POST } = await import('./route')
    const codes = []
    for (let i = 0; i < 22; i++) codes.push((await POST(post({ view: 'x' }, '198.51.100.9'))).status)
    expect(codes.slice(0, 20).every((c) => c === 400)).toBe(true)
    expect(codes.slice(20)).toEqual([429, 429])
  })

  it('address search collapses condos and validates length', async () => {
    const { POST } = await import('../address/route')
    const req = (q: string) => new Request('http://x/api/address', { method: 'POST', body: JSON.stringify({ q }) })
    expect((await POST(req('ab'))).status).toBe(400)
    const { results } = await (await POST(req('1300 n prospect ave'))).json()
    expect(results[0]).toMatchObject({ taxkey: null, exactNumber: true })
  })
})
