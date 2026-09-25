// Numbered sources for a whole page (DESIGN.md §Source mark, §Sources and Notes): each figure row
// carries a reference-blue mark for its own page; one list at the end names every page and links
// back to the rows that use it. Build the registry before rendering so numbering is deterministic.
import type { Cite } from '@/lib/db/schema'

import { OpenOnHash } from './open-on-hash'

export type Use = { id: string; label: string }
export type Sources = ReturnType<typeof sourceRegistry>

const DOCS = { summary: 'Proposed Plan and Executive Budget Summary', detailed: 'Proposed Detailed Budget' } as const
const same = (a: Cite, b: Cite) => a.doc === b.doc && a.pdf_page === b.pdf_page

export function sourceRegistry() {
  const list: { cite: Cite; uses: Use[] }[] = []
  return {
    list,
    /** Registers that `use` (a row) draws on `cite`; returns the source number to print. */
    mark(cite: Cite, use: Use) {
      let i = list.findIndex((x) => same(x.cite, cite))
      if (i < 0) i = list.push({ cite, uses: [] }) - 1
      if (!list[i].uses.some((u) => u.id === use.id)) list[i].uses.push(use)
      return i + 1
    },
  }
}

// Glyph-sized mark with an invisible 24x24 px hit area (WCAG 2.2 target size).
const TAP = "relative no-underline hover:underline before:absolute before:-inset-x-[10px] before:-inset-y-[7px] before:content-['']"

/** Lettered note mark (assumption or explanation), same 24 px hit area as a source mark. */
export const NoteMark = ({ l }: { l: string }) => (
  <sup className="ml-0.5 text-[0.7em] italic">
    <a href={`#note-${l}`} className={`${TAP} before:-inset-x-[10px] text-ink-soft`} aria-label={`Note ${l}`}>{l}</a>
  </sup>
)

/** Source mark. `q` = the figures this mark stands for, highlighted when the page opens. */
export const Mark = ({ n, q }: { n: number; q?: (number | string)[] }) => (
  <sup className="ml-0.5 text-[0.7em] font-semibold">
    <a href={`#src-${n}`} className={`${TAP} text-ref`} aria-label={`Source ${n}`} data-q={terms(q)}>{n}</a>
  </sup>
)
const terms = (q?: (number | string)[]) =>
  q?.map((v) => (typeof v === 'number' ? Math.abs(v).toLocaleString('en-US') : v)).join('|') || undefined

/** Keeps a label's last word on the same line as its mark, so a mark never starts a line. */
export function Tail({ label, children }: { label: string; children: React.ReactNode }) {
  const i = label.lastIndexOf(' ')
  return <>{i > 0 ? label.slice(0, i + 1) : ''}<span className="whitespace-nowrap">{i > 0 ? label.slice(i + 1) : label}{children}</span></>
}

const where = (c: Cite) => c.printed_page === 'front matter' ? 'front matter (PDF page 4)'
  : `page ${c.printed_page}${c.line_no ? `, line ${c.line_no}` : ''} (PDF page ${c.pdf_page})`

// Short form for the list, where the document name is a group heading: "p. 7 (PDF 17)".
const short = (c: Cite) => c.printed_page === 'front matter' ? 'front matter (PDF 4)'
  : `p. ${c.printed_page}${c.line_no ? `, line ${c.line_no}` : ''} (PDF ${c.pdf_page})`
const GROUP = { summary: 'Budget Summary', detailed: 'Detailed Budget' } as const
const SHOWN_USES = 3 // "Used for" lists longer than this fold behind "and N more"

// "a, b and c"; with `more`, the list continues, so every join is a comma ("a, b, c and 23 more").
const linksFor = (uses: Use[], more = false) => uses.map((u, j) => (
  <span key={u.id}>{j > 0 && (j === uses.length - 1 && !more ? ' and ' : ', ')}<a href={`#${u.id}`} className="text-ref underline">{u.label}</a></span>
))

/** The page's sources, closed by default: tapping a figure's mark already opens its PDF page (the
 *  source drawer reads each entry's data attributes, so every entry stays in the page). Opened, the
 *  list is grouped by document, one line per page, numbered in first-use order as the marks are. */
export function SourcesList({ sources, notes = [] }: { sources: Sources; notes?: { l: string; text: string }[] }) {
  const numbered = sources.list.map((x, i) => ({ ...x, n: i + 1 }))
  const groups = (Object.keys(GROUP) as (keyof typeof GROUP)[]).map((doc) => ({ doc, items: numbered.filter((x) => x.cite.doc === doc) }))
    .filter((g) => g.items.length)
  const count = sources.list.length
  return (
    <section aria-labelledby="sources" className="mt-20 border-t-2 border-ink pt-4 text-sm leading-relaxed text-ink">
      <OpenOnHash />
      <h2 id="sources" className="text-xs font-semibold uppercase tracking-[0.06em]">Sources</h2>
      <p className="mt-1 text-ink-soft">
        {count} {count === 1 ? 'page' : 'pages'} of the City of Milwaukee’s 2027 proposed budget documents. Tap any blue number on
        this page to open the page it comes from.
      </p>
      <details className="sources-list mt-2">
        <summary className="cursor-pointer font-semibold text-ref underline underline-offset-4">Show all {count} sources</summary>
        {groups.map(({ doc, items }) => (
          <div key={doc} className="mt-4">
            <h3 className="border-b border-rule pb-1 text-xs font-semibold uppercase tracking-[0.06em]">{GROUP[doc]}</h3>
            <ol className="mt-1 divide-y divide-rule">
              {items.map(({ cite, uses, n }) => (
                <li key={n} value={n} id={`src-${n}`} className="fn-target -mx-1 grid grid-cols-[1.75rem_1fr] gap-x-1 px-1 py-1.5"
                  data-doc={cite.doc} data-pdf-page={cite.pdf_page} data-where={where(cite)}>
                  <span className="tabular font-semibold text-ref">{n}.</span>
                  <span>
                    <span className="tabular font-semibold">{short(cite)}</span>
                    <span className="ml-2 text-ink-soft">
                      Used for {uses.length > SHOWN_USES ? (
                        <>
                          {linksFor(uses.slice(0, SHOWN_USES), true)}{' '}
                          {/* The sentence's period sits inside the fold, so nothing trails the <details> box. */}
                          <details className="more-uses inline">
                            <summary className="inline cursor-pointer text-ref underline underline-offset-4">and {uses.length - SHOWN_USES} more</summary>
                            <span>{linksFor([uses[SHOWN_USES - 1], ...uses.slice(SHOWN_USES)]).slice(1)}.</span>
                          </details>
                        </>
                      ) : <>{linksFor(uses)}.</>}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </details>
      {notes.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-[0.06em]">Notes</h2>
          <ul className="mt-2 space-y-1">
            {notes.map(({ l, text }) => (
              <li key={l} id={`note-${l}`} className="fn-target -mx-1 px-1 text-ink-soft">
                <span className="mr-1 font-semibold italic text-ink">{l}.</span>{text}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Compact source list for one chat answer card (the card carries `data-src-scope`). */
export function CardSources({ sources }: { sources: Sources }) {
  return (
    <ol className="mt-3 space-y-1 border-t border-rule pt-2 text-xs leading-relaxed text-ink-soft">
      {sources.list.map(({ cite }, i) => (
        <li key={i} id={`src-${i + 1}`} className="fn-target -mx-1 px-1" data-doc={cite.doc} data-pdf-page={cite.pdf_page} data-where={where(cite)}>
          <a href={`#src-${i + 1}`} className="tabular mr-1 font-semibold text-ref">{i + 1}.</a>
          {DOCS[cite.doc]}, {where(cite)}.
        </li>
      ))}
    </ol>
  )
}
