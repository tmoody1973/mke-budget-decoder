// Overview tables in the Blue Book Table world (DESIGN.md): ruled rows, tabular figures, a thin ink
// bar under each label, and a Source line naming the budget page. Hook-free, so chat answers can
// render them too. Every number arrives from lib/db; nothing here computes a budget figure except
// differences between two cited figures.
import type { Cite } from '@/lib/db/schema'
import { millions, pct, signedMillions } from '@/lib/format'

const DOCS = { summary: 'Proposed Plan and Executive Budget Summary', detailed: 'Proposed Detailed Budget' } as const

export function SourceLine({ cites, note }: { cites: Cite[]; note?: string }) {
  const pages = [...new Map(cites.map((c) => [`${c.doc}-${c.pdf_page}`, c])).values()]
    .sort((a, b) => a.pdf_page - b.pdf_page)
  return (
    <p className="mt-3 text-sm text-ink-soft">
      <span className="font-semibold text-ink">Source:</span> City of Milwaukee 2027 {DOCS[pages[0]?.doc ?? 'summary']},{' '}
      {pages.map((c) => `page ${c.printed_page} (PDF ${c.pdf_page})`).join('; ')}.{note && <> {note}</>}
    </p>
  )
}

const Bar = ({ value, max }: { value: number; max: number }) => (
  <span aria-hidden className="mt-1.5 block h-1.5 bg-rule">
    <span className="block h-full bg-ink" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
  </span>
)

const Head = ({ cols }: { cols: string[] }) => (
  <thead>
    <tr><td colSpan={cols.length} className="pb-1 text-right text-xs text-ink-soft">Millions of dollars</td></tr>
    <tr className="border-y-2 border-ink text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink">
      {cols.map((c, i) => (
        <th key={c} scope="col" className={`py-2 font-semibold ${i === 0 ? 'pr-2' : 'pl-3 text-right sm:pl-4'}`}
          dangerouslySetInnerHTML={{ __html: c }} />
      ))}
    </tr>
  </thead>
)
const num = 'py-3 pl-3 text-right text-[1.05rem] sm:pl-4'

type SectionRow = { section: string; name: string; adopted2026: number; proposed2027: number; cite: Cite }

/** Where the money goes: each lettered budget section, all funds (Summary p.7). */
export function SectionBudgets({ rows }: { rows: SectionRow[] }) {
  const max = Math.max(...rows.map((r) => r.proposed2027))
  const total = { a: rows.reduce((x, r) => x + r.adopted2026, 0), p: rows.reduce((x, r) => x + r.proposed2027, 0) }
  return (
    <>
      <table className="tabular mt-4 w-full border-collapse text-[0.95rem]">
        <caption className="sr-only">2027 proposed budget by section, all funds, with 2026 adopted</caption>
        <Head cols={['Section', '2026<br>adopted', '2027<br>proposed']} />
        <tbody>
          {rows.map((r) => (
            <tr key={r.section} className="border-b border-rule align-top">
              <th scope="row" className="py-3 pr-2 text-left font-normal text-ink">
                <span className="mr-1.5 font-semibold">{r.section}.</span>{r.name}
                <Bar value={r.proposed2027} max={max} />
              </th>
              <td className={`${num} text-ink-soft`}>{millions(r.adopted2026)}</td>
              <td className={`${num} font-semibold`}>{millions(r.proposed2027)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-y-2 border-ink">
            <th scope="row" className="py-3 pr-2 text-left font-semibold">All funds</th>
            <td className={`${num} font-semibold`}>{millions(total.a)}</td>
            <td className={`${num} text-lg font-bold`}>{millions(total.p)}</td>
          </tr>
        </tfoot>
      </table>
      <SourceLine cites={rows.map((r) => r.cite)} note="Sections E and L are not used in this budget." />
    </>
  )
}

type MixRow = { key: string; label: string; adopted2026: number; proposed2027: number; cite: Cite }

/** Where general city money comes from (Summary p.156-162). */
export function RevenueMix({ rows }: { rows: MixRow[] }) {
  const total = rows.reduce((x, r) => x + r.proposed2027, 0)
  const max = Math.max(...rows.map((r) => r.proposed2027))
  return (
    <>
      <table className="tabular mt-4 w-full border-collapse text-[0.95rem]">
        <caption className="sr-only">Sources of funds for general city purposes, 2027 proposed</caption>
        <Head cols={['Source', '2027<br>proposed', 'Share']} />
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-rule align-top">
              <th scope="row" className="py-3 pr-2 text-left font-normal text-ink">{r.label}<Bar value={r.proposed2027} max={max} /></th>
              <td className={`${num} font-semibold`}>{millions(r.proposed2027)}</td>
              <td className={`${num} text-ink-soft`}>{((r.proposed2027 / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-y-2 border-ink">
            <th scope="row" className="py-3 pr-2 text-left font-semibold">General city purposes</th>
            <td className={`${num} text-lg font-bold`}>{millions(total)}</td>
            <td className={`${num} font-semibold`}>100%</td>
          </tr>
        </tfoot>
      </table>
      <SourceLine cites={rows.map((r) => r.cite)} />
    </>
  )
}

type DeptRow = { slug: string; name: string; shortName: string | null; adopted2026: number; requested2027: number; proposed2027: number; cite: Cite }

/** What each department asked for and what the Mayor proposed (each department's Summary table). */
export function AskedVsProposed({ rows }: { rows: DeptRow[] }) {
  const asked = rows.reduce((x, r) => x + r.requested2027, 0), got = rows.reduce((x, r) => x + r.proposed2027, 0)
  return (
    <>
      <table className="tabular mt-4 w-full border-collapse text-[0.95rem]">
        <caption className="sr-only">Department budgets: 2027 requested, 2027 proposed, and the difference</caption>
        <Head cols={['Department', '2027<br>requested', '2027<br>proposed', '<span class="sm:hidden">Diff.</span><span class="hidden sm:inline">Difference</span>']} />
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug} className="border-b border-rule align-top">
              <th scope="row" className="py-3 pr-2 text-left font-normal text-ink"><abbr title={r.name} className="no-underline">{r.shortName ?? r.name}</abbr></th>
              <td className={`${num} text-ink-soft`}>{millions(r.requested2027)}</td>
              <td className={`${num} font-semibold`}>{millions(r.proposed2027)}</td>
              <td className={`${num} text-ink-soft`}>{signedMillions(r.proposed2027 - r.requested2027)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-y-2 border-ink">
            <th scope="row" className="py-3 pr-2 text-left font-semibold">These {rows.length} departments</th>
            <td className={`${num} font-semibold`}>{millions(asked)}</td>
            <td className={`${num} text-lg font-bold`}>{millions(got)}</td>
            <td className={`${num} font-semibold`}>{signedMillions(got - asked)}</td>
          </tr>
        </tfoot>
      </table>
      <SourceLine cites={rows.map((r) => r.cite).slice(0, 1)}
        note={`Each department’s own budget table, from page ${rows.map((r) => Number(r.cite.printed_page)).sort((a, b) => a - b)[0]} on. Special purpose accounts and the fringe benefit offset are budget lines, not departments, and are left out.`} />
    </>
  )
}

function ChangeGroup({ title, list }: { title: string; list: (DeptRow & { change: number })[] }) {
  return (
    <table className="tabular mt-4 w-full border-collapse text-[0.95rem]">
      <caption className="pb-2 text-left text-base font-semibold text-ink">{title}</caption>
      <Head cols={['Department', 'Change', 'Percent']} />
      <tbody>
        {list.map((r) => (
          <tr key={r.slug} className="border-b border-rule">
            <th scope="row" className="py-3 pr-2 text-left font-normal text-ink"><abbr title={r.name} className="no-underline">{r.shortName ?? r.name}</abbr></th>
            <td className={`${num} font-semibold`}>{signedMillions(r.change)}</td>
            <td className={`${num} text-ink-soft`}>{pct(r.adopted2026, r.proposed2027)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The largest increases and cuts from 2026 adopted to 2027 proposed, in dollars. */
export function BiggestChanges({ rows, n = 5 }: { rows: DeptRow[]; n?: number }) {
  const withChange = rows.map((r) => ({ ...r, change: r.proposed2027 - r.adopted2026 }))
  const up = [...withChange].filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, n)
  const down = [...withChange].filter((r) => r.change < 0).sort((a, b) => a.change - b.change).slice(0, n)
  return (
    <>
      <ChangeGroup title="Largest increases" list={up} />
      <div className="mt-6"><ChangeGroup title="Largest decreases" list={down} /></div>
      <SourceLine cites={rows.map((r) => r.cite).slice(0, 1)} note="2026 adopted compared with 2027 proposed, from each department’s budget table." />
    </>
  )
}
