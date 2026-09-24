// Link preview (1200x630): what appears when anyone pastes mkebudget.app into a post, text or chat.
// Figures from the database (Summary p.7), like the rest of the site.
import { ImageResponse } from 'next/og'

import { billions, C, logoSrc, millionsShort, ogFonts, sectionShares } from '@/lib/og'

export const alt = 'Milwaukee Budget Decoder: the Mayor’s proposed 2027 budget, every dollar traced to its page'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-dynamic'

export default async function Image() {
  const [fonts, logo, s] = await Promise.all([ogFonts(), logoSrc(), sectionShares(4)])
  const rows = s.rows.filter((r) => r.label !== 'Everything else')
  const max = Math.max(...rows.map((r) => r.amount))
  return new ImageResponse(
    <div style={{ width: 1200, height: 630, display: 'flex', background: C.band, fontFamily: 'Franklin', color: C.ink, padding: 56, gap: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator */}
          <img src={logo} width={52} height={52} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 24, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em' }}>
            <span>Milwaukee</span><span>Budget Decoder</span>
          </div>
        </div>
        <span style={{ fontSize: 34, fontWeight: 800, marginTop: 52, letterSpacing: '-0.02em' }}>Where would</span>
        <span style={{ fontSize: 96, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1 }}>{billions(s.total)}</span>
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>go?</span>
        <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.35, marginTop: 'auto' }}>The Mayor’s proposed 2027 budget, every dollar traced to its page. Look up your own city receipt.</span>
        <span style={{ fontSize: 34, fontWeight: 800, marginTop: 14, letterSpacing: '-0.02em' }}>mkebudget.app</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: C.paper, padding: '30px 30px', gap: 18, justifyContent: 'center' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, fontWeight: 600 }}>
              <span>{r.label}</span><span style={{ fontWeight: 800 }}>{millionsShort(r.amount)}</span>
            </div>
            <div style={{ display: 'flex', height: 12, marginTop: 7, background: C.rule }}>
              <div style={{ width: `${(r.amount / max) * 100}%`, background: C.ink }} />
            </div>
          </div>
        ))}
        <span style={{ fontSize: 16, color: C.inkSoft, marginTop: 6 }}>{`Proposed, not adopted. Summary p. ${s.page}.`}</span>
      </div>
    </div>,
    { ...size, fonts },
  )
}
