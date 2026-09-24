// Dashboard charts in the Blue Book Table world (DESIGN.md, .impeccable/surfaces/app-page-tsx.md).
// Pure: every figure and its source number arrive as props (lib/db numbers, page-wide source
// registry), so the Overview page and, later, chat answers render the same components.
// Layout math comes from Visx; the marks are HTML so labels stay readable at any width.
import { Treemap, hierarchy, treemapSquarify } from '@visx/hierarchy'
import { scaleLinear } from '@visx/scale'

import { bigDollars, millions, pct, signedMillions } from '@/lib/format'

import type { getHeadline } from '@/lib/db/overview'

import { Mark, Tail, type Sources } from './sources'

/** A disclosure that swaps in the cited table behind a chart (the chart's accessible version). */
export function ShowTable({ children, label = 'Show as table' }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="group mt-4">
      <summary className="cursor-pointer text-sm font-semibold text-ref underline underline-offset-4 marker:text-ref">
        {label}
      </summary>
      {children}
    </details>
  )
}

// ---------------------------------------------------------------------------- treemap

export type Block = {
  key: string; letter: string; label: string; short: string; value: number
  levy: boolean // has a city property tax rate (Summary p.7, from section_totals)
}

type Layout = { w: number; h: number; className: string }
const LAYOUTS: Layout[] = [
  { w: 2250, h: 1000, className: 'hidden aspect-[9/4] sm:block' }, // laptop and desktop (fits 1280x800 with legend)
  { w: 1000, h: 1150, className: 'aspect-[1000/1150] sm:hidden' }, // phone
]
const pctOf = (v: number, of: number) => `${(v / of) * 100}%`

function Tiles({ blocks, total, layout }: { blocks: Block[]; total: number; layout: Layout }) {
  const root = hierarchy<{ children?: Block[] } & Partial<Block>>({ children: blocks })
    .sum((d) => d.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  return (
    <div className={`relative w-full ${layout.className}`}>
      <Treemap root={root} size={[layout.w, layout.h]} tile={treemapSquarify} paddingInner={8}>
        {(tree) => tree.leaves().map((n) => {
          const d = n.data as Block
          const x0 = Math.max(0, n.x0), y0 = Math.max(0, n.y0), x1 = Math.min(layout.w, n.x1), y1 = Math.min(layout.h, n.y1)
          const share = ((d.value / total) * 100).toFixed(1)
          const text = `${d.letter}. ${d.label}: ${bigDollars(d.value)}, ${share}% of all funds, ${d.levy ? 'has' : 'no'} city property tax rate`
          const below = y1 < layout.h * 0.72, right = x0 > layout.w * 0.55
          return (
            <div key={d.key}>
              <div role="img" tabIndex={0} aria-label={text}
                className={`tile peer absolute overflow-hidden outline-offset-[-3px] ${d.levy ? 'bg-ink text-paper' : 'bg-fund text-ink ring-1 ring-inset ring-ref'}`}
                style={{ left: pctOf(x0, layout.w), top: pctOf(y0, layout.h), width: pctOf(x1 - x0, layout.w), height: pctOf(y1 - y0, layout.h) }}>
                <div className="p-1.5 sm:p-3">{/* padding lives inside, so thin tiles keep their exact size */}
                  <p aria-hidden className="tile-letter text-xs font-bold">{d.letter}</p>
                  <p aria-hidden className="tile-name text-sm font-semibold leading-snug text-balance">{d.letter}. {d.short}</p>
                  <p aria-hidden className="tile-amt tabular text-sm font-bold">${millions(d.value)}M</p>
                  <p aria-hidden className="tile-share tabular text-sm opacity-85">{share}% of all funds</p>
                </div>
              </div>
              <div aria-hidden className="pointer-events-none absolute z-10 hidden w-56 border border-ink bg-paper p-3 text-sm text-ink peer-hover:block peer-focus-visible:block"
                style={{ ...(below ? { top: `calc(${pctOf(y1, layout.h)} + 6px)` } : { bottom: `calc(${pctOf(layout.h - y0, layout.h)} + 6px)` }),
                  ...(right ? { right: pctOf(layout.w - x1, layout.w) } : { left: pctOf(x0, layout.w) }) }}>
                <p className="font-semibold">{d.letter}. {d.label}</p>
                <p className="tabular mt-1">{bigDollars(d.value)} · {share}% of all funds</p>
                <p className="mt-1 text-ink-soft">{d.levy ? 'Has a city property tax rate' : 'No city property tax rate'}</p>
              </div>
            </div>
          )
        })}
      </Treemap>
    </div>
  )
}

/** Where the money goes: every budget section sized by its 2027 proposed amount, all funds.
 *  `n` is the source mark for the section figures and tax rates (Summary p.7). */
export function BudgetTreemap({ blocks, total, n }: { blocks: Block[]; total: number; n: number }) {
  const shown = blocks.filter((b) => b.value > 0)
  const zero = blocks.filter((b) => b.value <= 0)
  return (
    <figure>
      {LAYOUTS.map((l) => <Tiles key={l.w} blocks={shown} total={total} layout={l} />)}
      <figcaption className="mt-3 text-sm text-ink">
        <span className="legend flex flex-wrap gap-x-6 gap-y-2">
          <span className="flex items-center gap-2"><span aria-hidden className="size-3 bg-ink" /><span>Has a city property tax rate<Mark n={n} /></span></span>
          <span className="flex items-center gap-2"><span aria-hidden className="size-3 bg-fund ring-1 ring-inset ring-ref" />No city property tax rate; paid from its own revenue</span>
        </span>
        <span className="sr-only">Key to the sections:</span>
        <span className="mt-3 grid gap-x-8 border-t border-rule pt-2 sm:grid-cols-2">
          {shown.map((b) => (
            <span key={b.key} className="tabular grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-2 border-b border-rule py-1 text-ink-soft">
              <span className="font-bold text-ink">{b.letter}</span><span>{b.label}</span><span className="text-right text-ink">{bigDollars(b.value)}</span>
            </span>
          ))}
        </span>
        {zero.length > 0 && <span className="mt-2 block text-ink-soft">{zero.map((z) => `${z.letter}. ${z.label}`).join(', ')}: $0 in 2027, not shown.</span>}
      </figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------------------- box score

export type Score = { id: string; label: string; value: string; was: string; change: string; n: number; q?: (number | string)[] }

/** The four headline figures (Summary p.7) as box-score rows, registering each source in `src`. */
export function headlineScores(h: Awaited<ReturnType<typeof getHeadline>>, src: Sources): Score[] {
  const scores: Score[] = [
    { id: 'score-all', label: 'All city funds', a: h.allFunds.adopted2026, p: h.allFunds.proposed2027, cite: h.allFunds.cite },
    { id: 'score-gcp', label: 'General city purposes', a: h.gcp.adopted2026, p: h.gcp.proposed2027, cite: h.gcp.cite },
    { id: 'score-levy', label: 'City property tax levy', a: h.levy.adopted2026, p: h.levy.proposed2027, cite: h.levy.cite },
  ].map((s) => ({
    id: s.id, label: s.label, value: bigDollars(s.p), was: bigDollars(s.a),
    change: `${s.p >= s.a ? 'Up' : 'Down'} ${pct(s.a, s.p)?.replace(/^[+−]/, '')}`,
    n: src.mark(s.cite, { id: s.id, label: s.label.toLowerCase() }), q: [s.a, s.p],
  }))
  const rateDown = Number(h.rate.r2027) < Number(h.rate.r2026)
  return [...scores, {
    id: 'score-rate', label: 'City tax rate per $1,000 of assessed value', value: `$${h.rate.r2027}`, was: `$${h.rate.r2026}`,
    change: `${rateDown ? 'Down' : 'Up'} $${Math.abs(Number(h.rate.r2027) - Number(h.rate.r2026)).toFixed(2)}`,
    n: src.mark(h.rate.cite, { id: 'score-rate', label: 'the tax rate' }), q: [h.rate.r2026, h.rate.r2027],
  }]
}

/** The four numbers people quote, each with its 2026 comparison and source. */
export function BoxScore({ scores }: { scores: Score[] }) {
  return (
    <dl className="divide-y divide-rule border-t-2 border-ink">
      {scores.map((s) => (
        <div key={s.id} id={s.id} className="row-target py-4">
          <dt className="text-sm font-semibold text-ink">{s.label}</dt>
          <dd className="tabular mt-1 text-3xl font-bold tracking-[-0.01em] text-ink lg:text-4xl">
            <Tail label={s.value}><Mark n={s.n} q={s.q} /></Tail>
          </dd>
          <dd className="tabular mt-1 text-sm text-ink-soft"><span className="font-semibold text-ink">{s.change}</span> from {s.was} adopted for 2026</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------------------- movers

export type Mover = { id: string; name: string; fullName: string; change: number; adopted2026: number; proposed2027: number; n: number }

/** Largest proposed increases and decreases from 2026, as bars growing either way from zero. */
export function Movers({ movers }: { movers: Mover[] }) {
  const max = Math.max(...movers.map((m) => Math.abs(m.change)))
  const x = scaleLinear<number>({ domain: [-max, max], range: [14, 86] }) // side margins hold the value labels
  return (
    <div role="img" aria-label={`Largest proposed changes from 2026: ${movers.map((m) => `${m.fullName} ${signedMillions(m.change)} million`).join('; ')}.`}>
      <p className="text-right text-xs text-ink-soft">Millions of dollars, 2026 adopted to 2027 proposed</p>
      <ul aria-hidden className="mt-2">
        {movers.map((m) => {
          const left = Math.min(x(0), x(m.change)), width = Math.abs(x(m.change) - x(0))
          return (
            <li key={m.id} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-3 border-b border-rule py-2 lg:grid-cols-[minmax(0,10rem)_1fr]">
              <span className="text-sm leading-tight text-ink">{m.name}</span>
              <span className="relative block h-7">
                <span className="absolute inset-y-0 left-1/2 w-px bg-ink" />
                <span className={`absolute inset-y-1.5 ${m.change > 0 ? 'bg-ink' : 'bg-ink-soft'}`} style={{ left: `${left}%`, width: `${width}%` }} />
                <span className={`tabular absolute top-1/2 -translate-y-1/2 text-xs font-semibold text-ink ${m.change > 0 ? 'pl-1' : 'pr-1'}`}
                  style={m.change > 0 ? { left: `${left + width}%` } : { right: `${100 - left}%` }}>
                  {signedMillions(m.change)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 flex justify-between text-xs text-ink-soft"><span>Proposed decrease</span><span>Proposed increase</span></p>
    </div>
  )
}

// ---------------------------------------------------------------------------- levy vs rate

export type LevyRate = { levy2026: number; levy2027: number; rate2026: string; rate2027: string }

function PairBars({ title, a, b, fmt }: { title: string; a: number; b: number; fmt: (v: number) => string }) {
  const x = scaleLinear<number>({ domain: [0, Math.max(a, b)], range: [0, 100] })
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{title} <span className="tabular font-normal text-ink-soft">({pct(a, b)})</span></p>
      {[['2026', a, 'bg-ink-soft'], ['2027', b, 'bg-ink']].map(([yr, v, c]) => (
        <div key={yr as string} className="mt-2 grid grid-cols-[3rem_1fr] items-center gap-2">
          <span className="tabular text-xs text-ink-soft">{yr}</span>
          <span className="flex items-center gap-2">
            <span className={`block h-5 ${c}`} style={{ width: `${x(v as number) * 0.72}%` }} />
            <span className="tabular whitespace-nowrap text-sm font-semibold text-ink">{fmt(v as number)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** The city levy rises while the rate falls: two small paired bars, 2026 against 2027. */
export function LevyVsRate({ d }: { d: LevyRate }) {
  return (
    <div role="img" aria-label={`City property tax levy ${bigDollars(d.levy2026)} adopted for 2026, ${bigDollars(d.levy2027)} proposed for 2027; tax rate $${d.rate2026} per $1,000 adopted for 2026, $${d.rate2027} proposed.`}
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <div aria-hidden><PairBars title="City property tax levy" a={d.levy2026} b={d.levy2027} fmt={bigDollars} /></div>
      <div aria-hidden><PairBars title="Tax rate per $1,000" a={Number(d.rate2026)} b={Number(d.rate2027)} fmt={(v) => `$${v.toFixed(2)}`} /></div>
    </div>
  )
}
