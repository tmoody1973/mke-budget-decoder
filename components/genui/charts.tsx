// Dashboard charts in the Blue Book Table world (DESIGN.md, .impeccable/surfaces/app-page-tsx.md).
// Pure: every figure and its source number arrive as props (lib/db numbers, page-wide source
// registry), so the Overview page and, later, chat answers render the same components.
// Layout math comes from Visx; the marks are HTML so labels stay readable at any width.
import { Treemap, hierarchy, treemapSquarify } from '@visx/hierarchy'
import { scaleLinear } from '@visx/scale'

import { bigDollars, millions, pct, signedMillions } from '@/lib/format'

import { Mark, Tail } from './sources'

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
  key: string; letter: string; label: string; value: number
  levy: boolean // paid for partly by property tax (Summary p.7 tax rate > 0)
}

type Layout = { w: number; h: number; className: string }
const LAYOUTS: Layout[] = [
  { w: 1600, h: 1000, className: 'hidden aspect-[16/10] sm:block' }, // laptop and desktop
  { w: 1000, h: 1150, className: 'aspect-[1000/1150] sm:hidden' }, // phone
]

function Tiles({ blocks, total, layout }: { blocks: Block[]; total: number; layout: Layout }) {
  const root = hierarchy<{ children?: Block[] } & Partial<Block>>({ children: blocks })
    .sum((d) => d.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  return (
    <div aria-hidden className={`relative w-full ${layout.className}`}>
      <Treemap root={root} size={[layout.w, layout.h]} tile={treemapSquarify} paddingInner={8} round>
        {(tree) => tree.leaves().map((n) => {
          const d = n.data as Block
          const w = n.x1 - n.x0, h = n.y1 - n.y0
          const full = w >= 300 && h >= 150, mid = w >= 170 && h >= 110, tiny = w >= 36 && h >= 30
          const share = ((d.value / total) * 100).toFixed(1)
          return (
            <div key={d.key} title={`${d.letter}. ${d.label}: ${bigDollars(d.value)} (${share}% of all funds)`}
              className={`absolute overflow-hidden p-2 sm:p-3 ${d.levy ? 'bg-ink text-paper' : 'bg-fund text-ink'}`}
              style={{ left: `${(n.x0 / layout.w) * 100}%`, top: `${(n.y0 / layout.h) * 100}%`,
                width: `${(w / layout.w) * 100}%`, height: `${(h / layout.h) * 100}%` }}>
              {full ? (
                <>
                  <p className="text-sm font-semibold leading-snug sm:text-base">{d.letter}. {d.label}</p>
                  <p className="tabular mt-1 text-xl font-bold sm:text-3xl">{bigDollars(d.value)}</p>
                  <p className="tabular text-xs opacity-80 sm:text-sm">{share}% of all funds</p>
                </>
              ) : mid ? (
                <>
                  <p className="text-xs font-semibold leading-tight sm:text-sm">{d.letter}. {d.label}</p>
                  <p className="tabular text-sm font-bold sm:text-base">{millions(d.value)}M</p>
                </>
              ) : tiny ? <p className="text-xs font-bold">{d.letter}</p> : null}
            </div>
          )
        })}
      </Treemap>
    </div>
  )
}

/** Where the money goes: every budget section sized by its 2027 proposed amount, all funds. */
export function BudgetTreemap({ blocks, total }: { blocks: Block[]; total: number }) {
  const shown = blocks.filter((b) => b.value > 0)
  const zero = blocks.filter((b) => b.value <= 0)
  return (
    <figure>
      {LAYOUTS.map((l) => <Tiles key={l.w} blocks={shown} total={total} layout={l} />)}
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
        <span className="flex items-center gap-2"><span aria-hidden className="size-3 bg-ink" />Paid for partly by property tax</span>
        <span className="flex items-center gap-2"><span aria-hidden className="size-3 bg-fund" />Paid for by its own revenue, no property tax</span>
        {zero.length > 0 && <span className="text-ink-soft">{zero.map((z) => `${z.letter}. ${z.label}`).join(', ')}: $0 in 2027, not shown.</span>}
      </figcaption>
      <ul className="sr-only">
        {shown.map((b) => <li key={b.key}>{b.letter}. {b.label}: {bigDollars(b.value)}, {((b.value / total) * 100).toFixed(1)} percent of all funds, {b.levy ? 'paid for partly by property tax' : 'no property tax'}.</li>)}
      </ul>
    </figure>
  )
}

// ---------------------------------------------------------------------------- box score

export type Score = { id: string; label: string; value: string; was: string; change: string; n: number }

/** The four numbers people quote, each with its 2026 comparison and source. */
export function BoxScore({ scores }: { scores: Score[] }) {
  return (
    <dl className="divide-y divide-rule border-t-2 border-ink">
      {scores.map((s) => (
        <div key={s.id} id={s.id} className="row-target py-4">
          <dt className="text-sm font-semibold text-ink">{s.label}</dt>
          <dd className="tabular mt-1 text-3xl font-bold tracking-[-0.01em] text-ink lg:text-4xl">
            <Tail label={s.value}><Mark n={s.n} /></Tail>
          </dd>
          <dd className="tabular mt-1 text-sm text-ink-soft"><span className="font-semibold text-ink">{s.change}</span> from {s.was} in 2026</dd>
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
            <li key={m.id} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-3 border-b border-rule py-2">
              <span className="truncate text-sm text-ink" title={m.fullName}>{m.name}</span>
              <span className="relative block h-7">
                <span className="absolute inset-y-0 left-1/2 w-px bg-ink" />
                <span className={`absolute inset-y-1.5 ${m.change > 0 ? 'bg-ink' : 'bg-fund'}`} style={{ left: `${left}%`, width: `${width}%` }} />
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
      {[['2026', a, 'bg-fund'], ['2027', b, 'bg-ink']].map(([yr, v, c]) => (
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
    <div role="img" aria-label={`City property tax levy ${bigDollars(d.levy2026)} in 2026, ${bigDollars(d.levy2027)} proposed for 2027; tax rate $${d.rate2026} per $1,000 in 2026, $${d.rate2027} proposed.`}
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <div aria-hidden><PairBars title="City property tax levy" a={d.levy2026} b={d.levy2027} fmt={bigDollars} /></div>
      <div aria-hidden><PairBars title="Tax rate per $1,000" a={Number(d.rate2026)} b={Number(d.rate2027)} fmt={(v) => `$${v.toFixed(2)}`} /></div>
    </div>
  )
}
