// Overview tables in the Blue Book Table world (DESIGN.md): ruled rows, tabular figures in millions,
// a thin ink bar under each label (2027 proposed), and a numbered source mark on every figure row
// pointing at that row's own page. Hook-free, so chat answers can render them too. Every figure
// comes from lib/db; this file only adds up or subtracts cited figures.
import { millions, pct, signedMillions } from '@/lib/format'

import { Mark, Tail } from './sources'

const Bar = ({ value, max }: { value: number; max: number }) => (
  <span aria-hidden className="mt-1.5 block h-1.5 bg-rule">
    <span className="block h-full bg-ink" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
  </span>
)

function Head({ cols, bars = false }: { cols: string[]; bars?: boolean }) {
  return (
    <thead>
      <tr>
        <td colSpan={cols.length} className="pb-1 text-right text-xs text-ink-soft">
          Millions of dollars{bars && ' · bars show 2027 proposed'}
        </td>
      </tr>
      <tr className="border-y-2 border-ink text-left text-xs font-semibold uppercase tracking-normal text-ink sm:tracking-[0.06em]">
        {cols.map((c, i) => (
          <th key={c} scope="col" className={`py-2 font-semibold ${i === 0 ? 'pr-2' : 'pl-2 text-right sm:pl-4'}`}
            dangerouslySetInnerHTML={{ __html: c }} />
        ))}
      </tr>
    </thead>
  )
}
const num = 'py-3 pl-2 text-right text-[1.05rem] sm:pl-4' // pl-2 on phones: the 4-column table fits 390 px
const label = 'py-3 pr-2 text-left font-normal text-ink'
const table = 'tabular mt-4 w-full border-collapse text-[0.95rem]'

type Numbered = { n: number; id: string }
type SectionRow = Numbered & { section: string; name: string; adopted2026: number; proposed2027: number }

/** Where the money goes: each lettered budget section, all funds (Summary p.7). */
export function SectionBudgets({ rows, noteMark }: { rows: SectionRow[]; noteMark?: string }) {
  const max = Math.max(...rows.map((r) => r.proposed2027))
  const total = { a: rows.reduce((x, r) => x + r.adopted2026, 0), p: rows.reduce((x, r) => x + r.proposed2027, 0) }
  return (
    <table className={table}>
      <caption className="sr-only">2027 proposed budget by section, all funds, with 2026 adopted</caption>
      <Head cols={['Section', '2026<br>adopted', '2027<br>proposed']} bars />
      <tbody>
        {rows.map((r) => (
          <tr key={r.section} id={r.id} className="row-target border-b border-rule align-top">
            <th scope="row" className={label}>
              <span className="mr-1.5 font-semibold">{r.section}.</span><Tail label={r.name}><Mark n={r.n} /></Tail>
              <Bar value={r.proposed2027} max={max} />
            </th>
            <td className={`${num} text-ink-soft`}>{millions(r.adopted2026)}</td>
            <td className={`${num} font-semibold`}>{millions(r.proposed2027)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-y-2 border-ink">
          <th scope="row" className="py-3 pr-2 text-left font-semibold">
            All funds{noteMark && <sup className="ml-0.5 text-[0.7em] italic"><a href={`#note-${noteMark}`} className="text-ink-soft no-underline">{noteMark}</a></sup>}
          </th>
          <td className={`${num} font-semibold`}>{millions(total.a)}</td>
          <td className={`${num} font-bold sm:text-lg`}>{millions(total.p)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

type MixRow = Numbered & { key: string; label: string; proposed2027: number }

/** Where general city money comes from, largest first (Summary p.156-162). */
export function RevenueMix({ rows }: { rows: MixRow[] }) {
  const sorted = [...rows].sort((a, b) => b.proposed2027 - a.proposed2027)
  const total = rows.reduce((x, r) => x + r.proposed2027, 0)
  const max = sorted[0]?.proposed2027 ?? 1
  return (
    <table className={table}>
      <caption className="sr-only">Sources of funds for general city purposes, 2027 proposed, largest first</caption>
      <Head cols={['Source', '2027<br>proposed', 'Share']} bars />
      <tbody>
        {sorted.map((r) => (
          <tr key={r.key} id={r.id} className="row-target border-b border-rule align-top">
            <th scope="row" className={label}><Tail label={r.label}><Mark n={r.n} /></Tail><Bar value={r.proposed2027} max={max} /></th>
            <td className={`${num} font-semibold`}>{millions(r.proposed2027)}</td>
            <td className={`${num} text-ink-soft`}>{((r.proposed2027 / total) * 100).toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-y-2 border-ink">
          <th scope="row" className="py-3 pr-2 text-left font-semibold">General city purposes</th>
          <td className={`${num} font-bold sm:text-lg`}>{millions(total)}</td>
          <td className={`${num} font-semibold`}>100%</td>
        </tr>
      </tfoot>
    </table>
  )
}

export type DeptRow = Numbered & { slug: string; name: string; shortName: string | null; adopted2026: number; requested2027: number; proposed2027: number }
type Line = Numbered & { label: string; proposed2027: number }

const DeptName = ({ r }: { r: DeptRow }) => (
  <Tail label={r.shortName ?? r.name}><Mark n={r.n} /></Tail>
)

function Footing({ l, sign }: { l: Line; sign?: string }) {
  return (
    <tr id={l.id} className="row-target border-b border-rule">
      <th scope="row" className={label}>{sign && <span aria-hidden className="mr-1">{sign}</span>}<Tail label={l.label}><Mark n={l.n} /></Tail></th>
      <td className={num} />
      <td className={`${num} font-semibold`}>{millions(l.proposed2027)}</td>
      <td className={num} />
    </tr>
  )
}

/** What each department asked for and what the Mayor proposed, footed to general city purposes. */
export function AskedVsProposed({ rows, specialPurpose, fringeOffset, gcp }: {
  rows: DeptRow[]; specialPurpose: Line; fringeOffset: Line; gcp: Line
}) {
  const asked = rows.reduce((x, r) => x + r.requested2027, 0), got = rows.reduce((x, r) => x + r.proposed2027, 0)
  return (
    <table className={table}>
      <caption className="sr-only">Department budgets: 2027 requested, 2027 proposed, and the difference; then the lines that take the departments to general city purposes</caption>
      <Head cols={['Department', '2027<br>requested', '2027<br>proposed', '<span class="sm:hidden">Diff.</span><span class="hidden sm:inline">Difference</span>']} />
      <tbody>
        {rows.map((r) => (
          <tr key={r.slug} id={r.id} className="row-target border-b border-rule align-top">
            <th scope="row" className={label}><abbr title={r.name} className="no-underline"><DeptName r={r} /></abbr></th>
            <td className={`${num} text-ink-soft`}>{millions(r.requested2027)}</td>
            <td className={`${num} font-semibold`}>{millions(r.proposed2027)}</td>
            <td className={`${num} text-ink-soft`}>{signedMillions(r.proposed2027 - r.requested2027)}</td>
          </tr>
        ))}
      </tbody>
      <tbody>
        <tr className="border-y-2 border-ink">
          <th scope="row" className="py-3 pr-2 text-left font-semibold">These {rows.length} departments</th>
          <td className={`${num} font-semibold`}>{millions(asked)}</td>
          <td className={`${num} font-bold`}>{millions(got)}</td>
          <td className={`${num} font-semibold`}>{signedMillions(got - asked)}</td>
        </tr>
        <Footing l={specialPurpose} sign="+" />
        <Footing l={fringeOffset} />
      </tbody>
      <tfoot>
        <tr className="border-y-2 border-ink">
          <th scope="row" className="py-3 pr-2 text-left font-semibold"><Tail label={gcp.label}><Mark n={gcp.n} /></Tail></th>
          <td className={num} />
          <td className={`${num} font-bold sm:text-lg`}>{millions(gcp.proposed2027)}</td>
          <td className={num} />
        </tr>
      </tfoot>
    </table>
  )
}

function ChangeGroup({ title, list }: { title: string; list: (DeptRow & { change: number })[] }) {
  return (
    <table className={table}>
      <caption className="pb-2 text-left text-base font-semibold text-ink">{title}</caption>
      <Head cols={['Department', '2026 adopted to<br>2027 proposed', 'Percent']} />
      <tbody>
        {list.map((r) => (
          <tr key={r.slug} className="border-b border-rule">
            <th scope="row" className={label}><abbr title={r.name} className="no-underline"><DeptName r={r} /></abbr></th>
            <td className={`${num} font-semibold`}>{signedMillions(r.change)}</td>
            <td className={`${num} text-ink-soft`}>{pct(r.adopted2026, r.proposed2027)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The departments with the largest proposed increases and decreases from 2026, in dollars. */
export function BiggestChanges({ rows, n = 5 }: { rows: DeptRow[]; n?: number }) {
  const withChange = rows.map((r) => ({ ...r, change: r.proposed2027 - r.adopted2026 }))
  const up = withChange.filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, n)
  const down = withChange.filter((r) => r.change < 0).sort((a, b) => a.change - b.change).slice(0, n)
  return (
    <>
      <ChangeGroup title="Largest proposed increases" list={up} />
      <div className="mt-6"><ChangeGroup title="Largest proposed decreases" list={down} /></div>
    </>
  )
}
