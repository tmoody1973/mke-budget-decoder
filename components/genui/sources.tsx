// Numbered sources for a whole page (DESIGN.md §Source mark, §Sources and Notes): each figure row
// carries a reference-blue mark for its own page; one list at the end names every page and links
// back to the rows that use it. Build the registry before rendering so numbering is deterministic.
import type { Cite } from '@/lib/db/schema'

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

export const Mark = ({ n }: { n: number }) => (
  <sup className="ml-0.5 text-[0.7em] font-semibold">
    <a href={`#src-${n}`} className={`${TAP} text-ref`} aria-label={`Source ${n}`}>{n}</a>
  </sup>
)

/** Keeps a label's last word on the same line as its mark, so a mark never starts a line. */
export function Tail({ label, children }: { label: string; children: React.ReactNode }) {
  const i = label.lastIndexOf(' ')
  return <>{i > 0 ? label.slice(0, i + 1) : ''}<span className="whitespace-nowrap">{i > 0 ? label.slice(i + 1) : label}{children}</span></>
}

const where = (c: Cite) => c.printed_page === 'front matter' ? 'front matter (PDF page 4)'
  : `page ${c.printed_page}${c.line_no ? `, line ${c.line_no}` : ''} (PDF page ${c.pdf_page})`

export function SourcesList({ sources, notes = [] }: { sources: Sources; notes?: { l: string; text: string }[] }) {
  return (
    <section aria-labelledby="sources" className="mt-20 border-t-2 border-ink pt-4 text-sm leading-relaxed text-ink">
      <h2 id="sources" className="text-xs font-semibold uppercase tracking-[0.06em]">Sources</h2>
      <p className="mt-1 text-ink-soft">All from the City of Milwaukee’s 2027 proposed budget documents.</p>
      <ol className="mt-3 space-y-2">
        {sources.list.map(({ cite, uses }, i) => (
          <li key={i} id={`src-${i + 1}`} className="fn-target -mx-1 px-1">
            <span className="tabular mr-1 font-semibold text-ref">{i + 1}.</span>
            {DOCS[cite.doc]}, {where(cite)}.
            <span className="ml-1 text-ink-soft">
              Used for{' '}
              {uses.map((u, j) => (
                <span key={u.id}>{j > 0 && (j === uses.length - 1 ? ' and ' : ', ')}<a href={`#${u.id}`} className="text-ref underline">{u.label}</a></span>
              ))}.
            </span>
          </li>
        ))}
      </ol>
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
