// Shareable City Receipt image (1080x1350, 4:5: Instagram feed, LinkedIn and X show it uncropped).
// Same body and math as /api/receipt, so the picture never shows a figure the screen does not.
// No address or assessed value on the image: it is made to be posted publicly (decided 2026-09-23).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

import type { Cite } from '@/lib/db/schema'
import { allow, clientKey } from '@/lib/rate-limit'
import type { Receipt } from '@/lib/receipt'
import { receiptFromBody } from '@/lib/receipt-request'

type Estimate = Extract<Receipt, { kind: 'estimate' }>

// Hex twins of the app/globals.css tokens (the image renderer cannot read CSS variables).
const C = { ink: '#1a2b49', inkSoft: '#404d66', band: '#fdbe45', bandDeep: '#df911a', paper: '#fdfaf1' }
const APP_URL = 'mkebudget.app'
const W = 1080, H = 1350, PAPER_W = 800

const logo = readFile(join(process.cwd(), 'assets/logo-160.png')).then((b) => `data:image/png;base64,${b.toString('base64')}`)
const fonts = Promise.all(['Regular', 'Bold'].map((w) => readFile(join(process.cwd(), `assets/fonts/IBMPlexMono-${w}.ttf`))))

const money = (c: number) => (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = (c: number) => `${c > 0 ? '+' : c < 0 ? '−' : ''}$${money(Math.abs(c))}`
const short = (label: string) => label.replace(/\s*\(.*\)$/, '')
const DOC = { summary: 'Budget Summary', detailed: 'Detailed Budget' } as const

function sourcesLine(cites: Cite[]) {
  const byDoc = new Map<Cite['doc'], Set<string>>()
  for (const c of cites) byDoc.set(c.doc, (byDoc.get(c.doc) ?? new Set()).add(c.printed_page))
  return [...byDoc].map(([d, p]) => `${DOC[d]} p${p.size > 1 ? 'p' : ''}. ${[...p].sort((a, b) => Number(a) - Number(b)).join(', ')}`).join('; ')
}

const Row = ({ cells, bold = false, size = 25 }: { cells: string[]; bold?: boolean; size?: number }) => (
  <div style={{ display: 'flex', fontSize: size, fontWeight: bold ? 700 : 400, lineHeight: 1.4 }}>
    <div style={{ flex: 1 }}>{cells[0]}</div>
    {cells.slice(1).map((c, i) => <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', width: 172 }}>{c}</div>)}
  </div>
)
const Rule = ({ char = '-' }: { char?: string }) => (
  <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.2, color: C.inkSoft, overflow: 'hidden', whiteSpace: 'nowrap' }}>{char.repeat(46)}</div>
)
const Center = ({ children, size = 25, bold = false }: { children: string; size?: number; bold?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'center', textAlign: 'center', fontSize: size, fontWeight: bold ? 700 : 400, lineHeight: 1.35 }}>{children}</div>
)
// Sawtooth edge where the receipt was torn off the roll.
const Torn = ({ flip = false }: { flip?: boolean }) => {
  const teeth = 40, w = PAPER_W / teeth
  const d = `M0 ${flip ? 0 : 14} ` + Array.from({ length: teeth }, (_, i) => `L${i * w + w / 2} ${flip ? 14 : 0} L${(i + 1) * w} ${flip ? 0 : 14}`).join(' ') + (flip ? ` L${PAPER_W} 0 Z` : ` L${PAPER_W} 14 L0 14 Z`)
  return <svg width={PAPER_W} height={14} viewBox={`0 0 ${PAPER_W} 14`} style={{ display: 'flex' }}><path d={d} fill={C.paper} /></svg>
}
// Decorative barcode: bar widths from the total, so each receipt's code differs. Carries no data.
const Barcode = ({ seed }: { seed: number }) => (
  <div style={{ display: 'flex', justifyContent: 'center', height: 56, marginTop: 12 }}>
    {Array.from({ length: 46 }, (_, i) => (
      <div key={i} style={{ width: ((seed >> (i % 17)) & 1) + ((i * 7 + seed) % 3) + 1, marginRight: 3, background: C.ink }} />
    ))}
  </div>
)

function ReceiptImage({ r, logoSrc }: { r: Estimate; logoSrc: string }) {
  const renter = r.view === 'renter'
  const change = renter ? r.perMonth.c2027 - r.perMonth.c2026 : r.total.c2027 - r.total.c2026
  return (
    <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', background: C.band, fontFamily: 'Plex Mono', color: C.ink }}>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 18px 40px rgba(26,43,73,0.28)' }}>
        <Torn />
        <div style={{ display: 'flex', flexDirection: 'column', width: PAPER_W, background: C.paper, padding: '22px 52px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator, not the browser */}
            <img src={logoSrc} width={60} height={60} alt="" />
          </div>
          <Center size={36} bold>MILWAUKEE BUDGET DECODER</Center>
          <Center size={25}>CITY RECEIPT · MILWAUKEE, WI</Center>
          <Center size={22}>ESTIMATE · MAYOR’S PROPOSED 2027 BUDGET</Center>
          <Rule />
          <Row cells={[renter ? 'A MILWAUKEE RENTER' : 'A MILWAUKEE HOMEOWNER']} bold />
          {renter && <Row size={21} cells={['Your unit’s share of the building']} />}
          <Rule />
          <Row cells={['ITEM', '2026', '2027']} bold />
          {r.lines.map((l) => <Row key={l.key} cells={[short(l.label), money(l.c2026), money(l.c2027)]} />)}
          <Rule char="=" />
          <Row bold size={26} cells={[renter ? 'PER YEAR' : 'TOTAL', `$${money(r.total.c2026)}`, `$${money(r.total.c2027)}`]} />
          {renter && <Row bold size={26} cells={['PER MONTH', `$${money(r.perMonth.c2026)}`, `$${money(r.perMonth.c2027)}`]} />}
          <Row bold cells={[renter ? 'CHANGE PER MONTH' : 'CHANGE FROM 2026', '', signed(change)]} />
          <Rule />
          <Row bold cells={['CITY PROPERTY TAX GOES TO', '2027']} />
          {r.split.map((s) => <Row key={s.key} cells={[short(s.label), money(s.c2027)]} />)}
          <Rule />
          {renter && <div style={{ display: 'flex', fontSize: 21, lineHeight: 1.4 }}>Paid by the building’s owner. The budget doesn’t show how much of this reaches your rent.</div>}
          <div style={{ display: 'flex', fontSize: 21, lineHeight: 1.4 }}>Not a bill. The Common Council can change the budget before it votes in November.</div>
          <div style={{ display: 'flex', fontSize: 19, lineHeight: 1.4, color: C.inkSoft, marginTop: 6 }}>
            Source: City of Milwaukee 2027 Proposed {sourcesLine([...r.lines, ...r.split].map((l) => l.cite))}.
          </div>
          <Barcode seed={r.total.c2027} />
        </div>
        <Torn flip />
      </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 34 }}>
        <div style={{ display: 'flex', fontSize: 28 }}>Look up your own city receipt</div>
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, borderBottom: `4px solid ${C.ink}` }}>{APP_URL}</div>
      </div>
    </div>
  )
}

export async function POST(req: Request) {
  if (!allow(`receipt-image:${clientKey(req)}`, 10, 60_000)) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }
  const r = await receiptFromBody((await req.json().catch(() => null)) as Record<string, unknown> | null)
  if ('error' in r) return Response.json({ error: r.error }, { status: r.status })
  if (r.receipt.kind !== 'estimate') return Response.json({ error: 'This property has no city receipt estimate to share.' }, { status: 400 })
  const [[regular, bold], logoSrc] = await Promise.all([fonts, logo])
  return new ImageResponse(<ReceiptImage r={r.receipt} logoSrc={logoSrc} />, {
    width: W, height: H,
    fonts: [{ name: 'Plex Mono', data: regular, weight: 400, style: 'normal' }, { name: 'Plex Mono', data: bold, weight: 700, style: 'normal' }],
    headers: { 'content-disposition': 'attachment; filename="my-milwaukee-city-receipt-2027.png"', 'cache-control': 'no-store' },
  })
}
