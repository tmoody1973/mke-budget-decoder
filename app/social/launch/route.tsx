// Launch post image (1080x1350, 4:5 for Instagram, LinkedIn and X): the hook "Where would $2.26 billion
// go?", the biggest budget sections as bars, and the personal call to look up your own receipt.
// Figures come from the database at render time (Summary p.7); GET /social/launch downloads it.
import { ImageResponse } from 'next/og'

import { billions, C, logoSrc, millionsShort, ogFonts, sectionShares } from '@/lib/og'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [fonts, logo, s] = await Promise.all([ogFonts(), logoSrc(), sectionShares(5)])
  const max = Math.max(...s.rows.map((r) => r.amount))
  return new ImageResponse(
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.band, fontFamily: 'Franklin', color: C.ink, padding: '64px 72px 56px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator */}
        <img src={logo} width={64} height={64} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 30, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em' }}>
          <span>Milwaukee</span><span>Budget Decoder</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 56 }}>
        <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>Where would</span>
        <span style={{ fontSize: 150, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.95, marginTop: 6 }}>{billions(s.total)}</span>
        <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 10 }}>go?</span>
        <span style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.35, marginTop: 26, maxWidth: 860 }}>
          The Mayor’s proposed 2027 budget for Milwaukee, every dollar traced to its page.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', background: C.paper, marginTop: 40, padding: '26px 34px 24px', gap: 16 }}>
        {s.rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, fontWeight: 600 }}>
              <span>{r.label}</span><span style={{ fontWeight: 800 }}>{millionsShort(r.amount)}</span>
            </div>
            <div style={{ display: 'flex', height: 14, marginTop: 8, background: C.rule }}>
              <div style={{ width: `${(r.amount / max) * 100}%`, background: r.label === 'Everything else' ? C.inkSoft : C.ink }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ink, color: C.paper, marginTop: 34, padding: '26px 34px' }}>
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.01em' }}>What would the city charge your home?</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22 }}>
        <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em', borderBottom: `5px solid ${C.ink}` }}>mkebudget.app</span>
        <span style={{ fontSize: 20, fontWeight: 400, textAlign: 'right', maxWidth: 440, lineHeight: 1.35 }}>
          {`Proposed, not adopted: the Common Council votes in November. Source: 2027 Proposed Budget Summary, p. ${s.page}.`}
        </span>
      </div>
    </div>,
    { width: 1080, height: 1350, fonts, headers: { 'cache-control': 'public, max-age=3600' } },
  )
}
