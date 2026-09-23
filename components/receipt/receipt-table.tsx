// The City Receipt as an almanac table: sources numbered, assumptions lettered, every amount
// from lib/receipt. No hooks, so Explore pages and chat answers can render it too.
import type { Cite } from '@/lib/db/schema'
import { cents, dollars, pct, signedCents } from '@/lib/format'
import type { Receipt } from '@/lib/receipt'

type Estimate = Extract<Receipt, { kind: 'estimate' }>
export type ParcelInfo = {
  assessed2026: number; assessed2025: number; yrAssmt: string | null; snapshotDate: string; assessmentClass?: string | null
} | null
const COMMERCIAL = new Set(['2', '4']) // MPROP classes: mercantile, special mercantile

const DOCS = { summary: 'Proposed Plan and Executive Budget Summary', detailed: 'Proposed Detailed Budget' } as const
const DEADLINE: Cite = { doc: 'summary', pdf_page: 4, printed_page: 'front matter' }
const FRONTAGE: Cite = { doc: 'summary', pdf_page: 151, printed_page: '141' }

function sourceList(cites: Cite[]) {
  const list: Cite[] = []
  const index = (c: Cite) => {
    let i = list.findIndex((x) => x.doc === c.doc && x.pdf_page === c.pdf_page)
    if (i < 0) i = list.push(c) - 1
    return i + 1
  }
  cites.forEach(index)
  return { list, index }
}

const Mark = ({ n }: { n: number }) => (
  <sup className="ml-0.5 text-[0.7em] font-semibold">
    <a href={`#fn-${n}`} className="text-ref no-underline hover:underline" aria-label={`Source ${n}`}>{n}</a>
  </sup>
)
const Note = ({ l }: { l: string }) => (
  <sup className="ml-0.5 text-[0.7em] italic text-ink-soft">
    <a href={`#note-${l}`} className="text-ink-soft no-underline hover:underline" aria-label={`Note ${l}`}>{l}</a>
  </sup>
)

export function ReceiptTable({ receipt, parcel }: { receipt: Estimate; parcel: ParcelInfo }) {
  const renter = receipt.view === 'renter'
  const usesFrontage = receipt.defaults.includes('frontage_40ft')
  const src = sourceList([...receipt.lines.map((l) => l.cite), ...(usesFrontage ? [FRONTAGE] : []), ...receipt.split.map((s) => s.cite), DEADLINE])
  // Notes are lettered in reading order: the heading's note first, then each row's, top to bottom.
  const notes: { l: string; text: string; cite?: Cite }[] = []
  const lettered = new Map<string, string>()
  const note = (id: string, text: string, cite?: Cite) => {
    if (!lettered.has(id)) lettered.set(id, String.fromCharCode(97 + notes.push({ l: String.fromCharCode(97 + notes.length), text, cite }) - 1))
    return lettered.get(id)!
  }
  const rentNote = renter ? note('rent', 'Paid by the building’s owner. The budget doesn’t show how much of this reaches your rent.') : null
  const commercial = COMMERCIAL.has(parcel?.assessmentClass ?? '')
  const rowNote: Record<string, () => string | null> = {
    property_tax: () => note('tax', 'The proposed 2027 rate applied to the 2026 assessment; 2026 is the adopted rate on the 2025 assessment.'),
    solid_waste: () => note('garbage', 'Assumes the city collects this property’s garbage, as it does for homes with 1–4 units. Larger buildings often hire private haulers.'),
    snow_ice: () => frontage(), street_lighting: () => frontage(), frontage: () => frontage(),
    sewer_stormwater: () => note('sewer', commercial
      ? 'An average household’s charge for each dwelling unit. Commercial sewer and stormwater charges are billed differently, so this is only a rough guide.'
      : 'An average household’s charge. Your actual bill depends on water use.'),
  }
  function frontage() {
    return receipt.defaults.includes('frontage_40ft')
      ? note('frontage', 'Street frontage assumed to be 40 feet, the budget’s own typical property. Snow & ice and street lighting are charged per foot.', FRONTAGE)
      : null
  }
  const noteFor = Object.fromEntries(receipt.lines.map((l) => [l.key, rowNote[l.key]?.() ?? null]))
  const change = receipt.total.c2027 - receipt.total.c2026
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged'

  return (
    <section aria-labelledby="receipt-heading" className="mt-10">
      <h2 id="receipt-heading" className="sr-only">Your estimated city charges</h2>

      <p className="text-sm text-ink-soft">
        {renter ? 'Your unit’s share of this building, 2027 estimate' : 'What the city charges this property, 2027 estimate'}
        {rentNote && <Note l={rentNote} />}
      </p>
      <p className="tabular mt-1 text-5xl font-bold tracking-[-0.02em] text-ink">
        {renter ? cents(receipt.perMonth.c2027) : cents(receipt.total.c2027)}
        <span className="ml-2 text-lg font-medium tracking-normal text-ink-soft">{renter ? 'a month' : 'a year'}</span>
      </p>
      <p className="tabular mt-2 text-base text-ink">
        {direction === 'unchanged' ? 'Unchanged from 2026.' : (
          <>
            <span className="font-semibold">{direction === 'up' ? 'Up' : 'Down'} {cents(Math.abs(renter ? receipt.perMonth.c2027 - receipt.perMonth.c2026 : change))}</span>
            {' '}from {renter ? `${cents(receipt.perMonth.c2026)} a month` : cents(receipt.total.c2026)} in 2026
            {renter && <> ({cents(receipt.total.c2027)} a year)</>}.
          </>
        )}
      </p>

      <table className="tabular mt-8 w-full border-collapse text-[0.95rem]">
        <caption className="sr-only">City charges, 2026 adopted and 2027 proposed estimate</caption>
        <thead>
          <tr className="border-y-2 border-ink text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink">
            <th scope="col" className="py-2 pr-2 font-semibold">Charge</th>
            <th scope="col" className="py-2 pl-2 text-right font-semibold">2026</th>
            <th scope="col" className="py-2 pl-2 text-right font-semibold">2027 est.</th>
            <th scope="col" className="hidden py-2 pl-2 text-right font-semibold sm:table-cell">Change</th>
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((l) => (
            <tr key={l.key} id={`row-${l.key}`} className="row-target border-b border-rule align-baseline">
              <th scope="row" className="py-3 pr-2 text-left font-normal text-ink">
                {l.label}<Mark n={src.index(l.cite)} />{noteFor[l.key] && <Note l={noteFor[l.key]!} />}
              </th>
              <td className="py-3 pl-2 text-right text-ink-soft">{cents(l.c2026)}</td>
              <td className="py-3 pl-2 text-right font-semibold text-ink">{cents(l.c2027)}</td>
              <td className="hidden py-3 pl-2 text-right text-ink-soft sm:table-cell">{signedCents(l.c2027 - l.c2026)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-y-2 border-ink">
            <th scope="row" className="py-3 pr-2 text-left font-semibold">{renter ? 'Per unit, per year' : 'Total'}</th>
            <td className="py-3 pl-2 text-right font-semibold">{cents(receipt.total.c2026)}</td>
            <td className="py-3 pl-2 text-right text-lg font-bold">{cents(receipt.total.c2027)}</td>
            <td className="hidden py-3 pl-2 text-right font-semibold sm:table-cell">{signedCents(change)}</td>
          </tr>
          {renter && (
            <tr className="border-b-2 border-ink">
              <th scope="row" className="py-3 pr-2 text-left font-semibold">Per unit, per month</th>
              <td className="py-3 pl-2 text-right font-semibold">{cents(receipt.perMonth.c2026)}</td>
              <td className="py-3 pl-2 text-right font-bold">{cents(receipt.perMonth.c2027)}</td>
              <td className="hidden py-3 pl-2 text-right font-semibold sm:table-cell">{signedCents(receipt.perMonth.c2027 - receipt.perMonth.c2026)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      {parcel && (
        <p className="tabular mt-4 text-sm text-ink-soft">
          Assessed value: {dollars(parcel.assessed2026)} for 2026
          {parcel.assessed2025 === parcel.assessed2026 ? ', unchanged from 2025'
            : ` (${pct(parcel.assessed2025, parcel.assessed2026) ?? 'new'} from ${dollars(parcel.assessed2025)} in 2025)`}.
          {' '}City Master Property File, {parcel.snapshotDate}.
          {parcel.yrAssmt && parcel.yrAssmt !== '2026' && <> This property still shows its {parcel.yrAssmt} assessment.</>}
        </p>
      )}

      <h3 className="mt-12 text-xl font-bold tracking-[-0.01em] text-ink">Where the 2027 city property tax goes</h3>
      <p className="mt-1 text-sm text-ink-soft">
        The city tax rate is split among budget sections. Only this split is exact; the tax isn’t earmarked by department.
      </p>
      <table className="tabular mt-4 w-full border-collapse text-[0.95rem]">
        <caption className="sr-only">2027 city property tax by budget section</caption>
        <thead>
          <tr className="border-y-2 border-ink text-left text-xs font-semibold uppercase tracking-[0.06em]">
            <th scope="col" className="py-2 pr-2 font-semibold">Budget section</th>
            <th scope="col" className="py-2 pl-2 text-right font-semibold">Share</th>
          </tr>
        </thead>
        <tbody>
          {receipt.split.map((s) => (
            <tr key={s.key} className="border-b border-rule">
              <th scope="row" className="py-3 pr-2 text-left font-normal">{s.label}<Mark n={src.index(s.cite)} /></th>
              <td className="py-3 pl-2 text-right font-semibold">{cents(s.c2027)}</td>
            </tr>
          ))}
          {receipt.splitRemainderC2027 !== 0 && (
            <tr className="border-b border-rule text-ink-soft">
              <th scope="row" className="py-3 pr-2 text-left font-normal">Rounding</th>
              <td className="py-3 pl-2 text-right">{signedCents(receipt.splitRemainderC2027)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <footer className="mt-12 border-t-2 border-ink pt-4 text-sm leading-relaxed text-ink">
        <p className="font-semibold">
          This is an estimate based on the Mayor’s proposed 2027 budget. The Common Council can change it before
          adopting the budget in November.<Mark n={src.index(DEADLINE)} />
        </p>
        <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.06em]">Sources</h3>
        <ol className="mt-2 space-y-1">
          {src.list.map((c, i) => (
            <li key={i} id={`fn-${i + 1}`} className="fn-target -mx-1 rounded-sm px-1">
              <span className="tabular mr-1 font-semibold text-ref">{i + 1}.</span>
              City of Milwaukee 2027 {DOCS[c.doc]}, {c.printed_page === 'front matter' ? 'budget calendar' : `page ${c.printed_page}`} (PDF page {c.pdf_page}).
            </li>
          ))}
        </ol>
        <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.06em]">Notes</h3>
        <ul className="mt-2 space-y-1">
          {notes.map(({ l, text, cite }) => (
            <li key={l} id={`note-${l}`} className="fn-target -mx-1 rounded-sm px-1 text-ink-soft">
              <span className="mr-1 font-semibold italic text-ink">{l}.</span>{text}{cite && <Mark n={src.index(cite)} />}
            </li>
          ))}
        </ul>
      </footer>
    </section>
  )
}
