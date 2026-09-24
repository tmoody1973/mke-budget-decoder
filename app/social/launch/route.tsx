// Launch post image (1080x1350, the size LinkedIn, Instagram and X show largest): the hook, then the
// five things people can do on the site, then the address. The $2.26 billion comes from the database
// at render time (Summary p.7). GET /social/launch.
import { ImageResponse } from 'next/og'

import { billions, C, logoSrc, ogFonts, sectionShares } from '@/lib/og'

export const dynamic = 'force-dynamic'

// Lucide icon paths (ISC license), inlined: lucide-react's components are client-only and crash a route handler.
const ICONS = {
  receipt: ['M13 16H8', 'M14 8H8', 'M16 12H8', 'M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z'],
  chat: ['M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z', 'M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1'],
  chart: ['M3 3v16a2 2 0 0 0 2 2h16', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  news: ['M15 18h-5', 'M18 14h-8', 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2', 'M11 6h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z'],
  calendar: ['M16 18h6', 'M16 2v3', 'M19 15v6', 'M21 11.5V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h8.3', 'M3 9h18', 'M8 2v3'],
  heart: ['M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5'],
}
const Icon = ({ paths, color, size, fill = 'none', stroke = 2 }: { paths: string[]; color: string; size: number; fill?: string; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {paths.map((d) => <path key={d} d={d} />)}
  </svg>
)

const FEATURES = [
  { icon: ICONS.receipt, title: 'Your City Receipt', line: 'Enter your address. See what the city would charge your home.' },
  { icon: ICONS.chat, title: 'Ask about the budget', line: 'Plain-language answers, every figure linked to its page.' },
  { icon: ICONS.chart, title: 'See where it goes', line: 'Charts and tables for every section and department.' },
  { icon: ICONS.news, title: 'Check the news', line: 'Reported figures set beside what the budget prints.' },
  { icon: ICONS.calendar, title: 'Have your say', line: 'Council hearing dates, added to your calendar.' },
]

export async function GET() {
  const [fonts, logo, s] = await Promise.all([ogFonts(), logoSrc(), sectionShares(5)])
  return new ImageResponse(
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.band, fontFamily: 'Franklin', color: C.ink, padding: '60px 72px 52px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator */}
        <img src={logo} width={64} height={64} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 30, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em' }}>
          <span>Milwaukee</span><span>Budget Decoder</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44 }}>
        <span style={{ fontSize: 58, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>Milwaukee’s</span>
        <span style={{ fontSize: 132, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.98, marginTop: 4 }}>{billions(s.total)}</span>
        <span style={{ fontSize: 58, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6 }}>budget, decoded.</span>
        <span style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.35, marginTop: 20 }}>
          The Mayor’s proposed 2027 budget, every number traced to its page.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', background: C.paper, marginTop: 34, padding: '10px 32px' }}>
        {FEATURES.map(({ icon, title, line }, i) => (
          <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '19px 0', borderTop: i ? `2px solid ${C.rule}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 68, height: 68, background: C.ink, flexShrink: 0 }}>
              <Icon paths={icon} color={C.band} size={38} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 31, fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</span>
              <span style={{ fontSize: 23, fontWeight: 400, lineHeight: 1.3, marginTop: 2, color: C.inkSoft }}>{line}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.02em', borderBottom: `5px solid ${C.ink}` }}>mkebudget.app</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 22, fontWeight: 600, marginTop: 12 }}>
            Free and independent. Made with <Icon paths={ICONS.heart} color={C.ink} fill={C.paper} size={22} stroke={2.5} /> by Tarik Moody
          </span>
        </div>
        <span style={{ fontSize: 18, fontWeight: 400, textAlign: 'right', maxWidth: 360, lineHeight: 1.35 }}>
          {`Proposed, not adopted: the Common Council votes in November. Total: 2027 Proposed Budget Summary, p. ${s.page}.`}
        </span>
      </div>
    </div>,
    { width: 1080, height: 1350, fonts, headers: { 'cache-control': 'public, max-age=3600' } },
  )
}
