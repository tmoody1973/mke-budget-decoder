// YouTube thumbnail (1280x720) for the launch video. Built to read at phone-feed size: a few huge words,
// and a City Receipt with its totals hidden, so the only way to see your number is to watch (or visit).
// No dollar figure on the receipt: the one number shown, the $2.26B, is read from the database (Summary p.7).
// GET /social/youtube (receipt hook) or /social/youtube?v=ask (adds the chat).
import { ImageResponse } from 'next/og'

import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import { getHeadline } from '@/lib/db/overview'
import { C, logoSrc, ogFonts } from '@/lib/og'

export const dynamic = 'force-dynamic'

const LINES = ['Property tax', 'Garbage', 'Snow and ice', 'Street lighting', 'Sewer']
const Row = ({ label, bold = false }: { label: string; bold?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 30 : 25, fontWeight: bold ? 800 : 600, lineHeight: 1.55 }}>
    <span>{label}</span><span style={{ color: bold ? C.ink : C.inkSoft }}>$ ???</span>
  </div>
)

export async function GET(req: Request) {
  const ask = new URL(req.url).searchParams.get('v') === 'ask' // /social/youtube?v=ask: the chat version
  const [fonts, logo, h] = await Promise.all([ogFonts(), logoSrc(), getHeadline(getDb(), BUDGET_VERSION)])
  const total = `$${(h.allFunds.proposed2027 / 1e9).toFixed(2)}B`
  return new ImageResponse(
    <div style={{ width: 1280, height: 720, display: 'flex', background: C.band, fontFamily: 'Franklin', color: C.ink, padding: '44px 56px', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator */}
          <img src={logo} width={54} height={54} alt="" />
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Milwaukee Budget Decoder</span>
        </div>
        <span style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 56 }}>MILWAUKEE’S</span>
        <span style={{ fontSize: 214, fontWeight: 800, letterSpacing: '-0.06em', lineHeight: 0.9, marginTop: 4, marginLeft: -8 }}>{total}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 18 }}>
          <span style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em' }}>BUDGET</span>
          <span style={{ display: 'flex', background: C.ink, color: C.band, fontSize: 76, fontWeight: 800, letterSpacing: '-0.02em', padding: '2px 22px 8px', transform: 'rotate(-3deg)' }}>DECODED</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', right: 52, top: 70, width: 372, background: C.paper, padding: '26px 30px 22px', transform: 'rotate(5deg)', boxShadow: '0 22px 50px rgba(26,43,73,0.35)' }}>
        <span style={{ display: 'flex', justifyContent: 'center', fontSize: 27, fontWeight: 800, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>YOUR CITY RECEIPT</span>
        <span style={{ display: 'flex', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: C.inkSoft, marginBottom: 10 }}>Proposed 2027 · your address</span>
        <div style={{ display: 'flex', height: 3, background: C.ink, marginBottom: 8 }} />
        {LINES.map((l) => <Row key={l} label={l} />)}
        <div style={{ display: 'flex', height: 3, background: C.ink, margin: '8px 0 6px' }} />
        <Row label="TOTAL" bold />
        <div style={{ display: 'flex', justifyContent: 'center', height: 44, marginTop: 14 }}>
          {Array.from({ length: 34 }, (_, i) => <div key={i} style={{ width: (i * 7) % 3 + 2, marginRight: 4, background: C.ink }} />)}
        </div>
      </div>
      {ask ? (
        // Chat bubble, for the "ask" version: the receipt still asks "what's yours?"
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'absolute', right: 56, top: 528, transform: 'rotate(-3deg)' }}>
          <svg width="40" height="26" viewBox="0 0 40 26" style={{ marginLeft: 48 }}><path d="M0 26 L22 0 L40 26 Z" fill={C.ink} /></svg>
          <div style={{ display: 'flex', background: C.ink, color: C.band, padding: '12px 28px 16px', borderRadius: 26, marginTop: -1 }}>
            <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Ask it anything</span>
          </div>
        </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 318, top: 452, width: 150, height: 150, borderRadius: 75, background: C.ink, color: C.band, transform: 'rotate(-10deg)', fontSize: 34, fontWeight: 800, lineHeight: 1, textAlign: 'center' }}>
        What’s yours?
      </div>
      )}

      {/* Bottom-left: YouTube covers the bottom-right corner with the video length. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, position: 'absolute', left: 56, bottom: 34 }}>
        <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', borderBottom: `5px solid ${C.ink}` }}>mkebudget.app</span>
        <span style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>The Mayor’s proposed budget · not yet adopted</span>
      </div>
    </div>,
    { width: 1280, height: 720, fonts, headers: { 'cache-control': 'public, max-age=3600' } },
  )
}
