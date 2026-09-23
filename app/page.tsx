// Overview (D15): answer the visitor's question first, trust material second.
import { ArrowDown } from 'lucide-react'

import { AskedVsProposed, BiggestChanges, RevenueMix, SectionBudgets } from '@/components/genui/budget-tables'
import { Mark, SourcesList, sourceRegistry } from '@/components/genui/sources'
import { ReceiptFinder } from '@/components/receipt/receipt-finder'
import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import {
  getDepartmentTotals, getGcpReconciliation, getHeadline, getRevenueMix, getSectionBudgets,
} from '@/lib/db/overview'
import type { Cite } from '@/lib/db/schema'
import { bigDollars, pct } from '@/lib/format'

const QUESTIONS = [
  { href: '#taxes', q: 'Are my property taxes going up?' },
  { href: '#spending', q: 'Where does the money go?' },
  { href: '#revenue', q: 'Where does the money come from?' },
  { href: '#departments', q: 'What did departments ask for, and what did the Mayor propose?' },
  { href: '#changes', q: 'What does the Mayor propose to change most?' },
]
// Rendered per request: the page reads the database, and CI builds without one.
export const dynamic = 'force-dynamic'

const CALENDAR: Cite = { doc: 'summary', pdf_page: 4, printed_page: 'front matter' }
const NoteMark = ({ l }: { l: string }) => (
  <sup className="ml-0.5 text-[0.7em] italic"><a href={`#note-${l}`} className="text-ink-soft no-underline" aria-label={`Note ${l}`}>{l}</a></sup>
)

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="scroll-mt-6 text-2xl font-bold tracking-[-0.01em] text-ink sm:text-3xl">{children}</h2>
)
const Lead = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <p id={id} className="row-target tabular -mx-1 mt-3 max-w-[62ch] px-1 leading-relaxed text-ink">{children}</p>
)

export default async function Overview() {
  const [h, sectionRows, mixRows, deptRows, rec] = await Promise.all([
    getHeadline(getDb(), BUDGET_VERSION), getSectionBudgets(getDb(), BUDGET_VERSION), getRevenueMix(getDb(), BUDGET_VERSION),
    getDepartmentTotals(getDb(), BUDGET_VERSION), getGcpReconciliation(getDb(), BUDGET_VERSION),
  ])

  // Number every source in reading order before rendering, so the marks and the list agree.
  const src = sourceRegistry()
  const intro = src.mark(h.allFunds.cite, { id: 'intro', label: 'the totals at the top' })
  const calendar = src.mark(CALENDAR, { id: 'intro', label: 'the totals at the top' })
  const levyMark = src.mark(h.levy.cite, { id: 'taxes-lead', label: 'the property tax levy and rate' })
  const levyGcpCite = mixRows.find((r) => r.key === 'levy')!.cite
  const sections = sectionRows.map((r) => ({ ...r, id: `sec-${r.section}`, n: src.mark(r.cite, { id: `sec-${r.section}`, label: `section ${r.section}` }) }))
  const revGcpMark = src.mark(h.gcp.cite, { id: 'revenue-lead', label: 'the revenue summary' })
  const revLevyMark = src.mark(levyGcpCite, { id: 'revenue-lead', label: 'the revenue summary' })
  const revTotalLevyMark = src.mark(h.levy.cite, { id: 'revenue-lead', label: 'the revenue summary' })
  const sortedMix = [...mixRows].sort((a, b) => b.proposed2027 - a.proposed2027)
  const mix = sortedMix.map((r) => ({ ...r, id: `rev-${r.key}`, n: src.mark(r.cite, { id: `rev-${r.key}`, label: r.label.split(' (')[0].toLowerCase() }) }))
  const depts = deptRows.map((r) => ({ ...r, id: `dept-${r.slug}`, n: src.mark(r.cite, { id: `dept-${r.slug}`, label: r.shortName ?? r.name }) }))
  const spa = { ...rec.specialPurpose, label: 'Special purpose accounts', id: 'dept-spa', n: src.mark(rec.specialPurpose.cite, { id: 'dept-spa', label: 'special purpose accounts' }) }
  const offset = { ...rec.fringeOffset, label: 'Fringe benefit offset', id: 'dept-offset', n: src.mark(rec.fringeOffset.cite, { id: 'dept-offset', label: 'the fringe benefit offset' }) }
  const gcp = { ...h.gcp, label: 'General city purposes', id: 'dept-gcp', n: src.mark(h.gcp.cite, { id: 'dept-gcp', label: 'general city purposes' }) }

  const notes = [
    { l: 'a', text: 'The budget has no sections lettered E or L.' },
    { l: 'b', text: 'Special purpose accounts are citywide spending lines, such as worker’s compensation, that sit outside any department. The fringe benefit offset removes employee benefit costs that are budgeted twice, in special purpose accounts and again in department budgets, so the city does not levy for them twice.' },
  ]
  const levyUp = h.levy.proposed2027 > h.levy.adopted2026
  const rateDown = Number(h.rate.r2027) < Number(h.rate.r2026)
  const levyGcp = mixRows.find((r) => r.key === 'levy')!.proposed2027
  const gcpTotal = mixRows.reduce((x, r) => x + r.proposed2027, 0)

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      <h1 className="text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">
        Milwaukee’s proposed 2027 budget, with every number traced to its page
      </h1>
      <p id="intro" className="row-target tabular -mx-1 mt-5 max-w-[62ch] px-1 text-lg leading-relaxed text-ink">
        The Mayor proposes spending <strong>{bigDollars(h.allFunds.proposed2027)}</strong> across all city funds in
        2027, including <strong>{bigDollars(h.gcp.proposed2027)}</strong> for general city purposes.<Mark n={intro} /> This
        is a proposal: the Common Council can change it before adopting the budget in November.<Mark n={calendar} />
      </p>

      <nav aria-labelledby="questions" className="mt-10 border-t-2 border-ink pt-4">
        <h2 id="questions" className="text-base font-semibold text-ink">Start with a question</h2>
        <ul className="mt-2">
          {QUESTIONS.map(({ href, q }) => (
            <li key={href} className="border-b border-rule">
              <a href={href} className="flex items-baseline justify-between gap-4 py-3 text-lg text-ink no-underline hover:text-ref">
                {q}<ArrowDown aria-hidden className="size-4 shrink-0 text-ref" strokeWidth={2} />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-16">
        <H2 id="taxes">Are my property taxes going up?</H2>
        <Lead id="taxes-lead">
          Under the Mayor’s proposal, the city’s property tax levy would {levyUp ? 'rise' : 'fall'} from{' '}
          {bigDollars(h.levy.adopted2026)} to {bigDollars(h.levy.proposed2027)} ({pct(h.levy.adopted2026, h.levy.proposed2027)}),
          and the city tax rate would {rateDown ? 'fall' : 'rise'} from ${h.rate.r2026} to ${h.rate.r2027} per $1,000 of
          assessed value{levyUp && rateDown ? ', because the total assessed value of property in the city grew' : ''}.<Mark n={levyMark} />{' '}
          Whether the city’s share of your tax bill rises depends on how your home’s assessment changed compared with the
          citywide change. School, county, sewerage district and technical college taxes on the same bill are set separately.
        </Lead>
        <div className="mt-8"><ReceiptFinder /></div>
      </section>

      <section className="mt-20">
        <H2 id="spending">Where the money goes</H2>
        <Lead>
          The budget is divided into lettered sections. General city purposes pays for most departments; the others are
          pensions, debt, capital projects and funds with their own revenue, such as Water Works.
        </Lead>
        <SectionBudgets rows={sections} noteMark="a" />
      </section>

      <section className="mt-20">
        <H2 id="revenue">Where the general city money comes from</H2>
        <Lead id="revenue-lead">
          The {bigDollars(gcpTotal)} for general city purposes comes from these sources, largest first.<Mark n={revGcpMark} /> Property
          tax supplies {bigDollars(levyGcp)} ({((levyGcp / gcpTotal) * 100).toFixed(1)}%) of it;<Mark n={revLevyMark} /> the city’s
          full {bigDollars(h.levy.proposed2027)} levy also pays toward pensions, debt, capital improvements and the contingent
          fund.<Mark n={revTotalLevyMark} />
        </Lead>
        <RevenueMix rows={mix} />
      </section>

      <section className="mt-20">
        <H2 id="departments">What departments asked for, and what the Mayor proposed</H2>
        <Lead>
          Each department sent a request; the Mayor’s proposal is what went to the Council. Largest budgets first. The
          departments add up to more than general city purposes; two citywide lines at the bottom close the gap.<NoteMark l="b" />
        </Lead>
        <AskedVsProposed rows={depts} specialPurpose={spa} fringeOffset={offset} gcp={gcp} />
      </section>

      <section className="mt-20">
        <H2 id="changes">What the Mayor proposes to change most from 2026</H2>
        <BiggestChanges rows={depts} />
      </section>

      <SourcesList sources={src} notes={notes} />

      <footer className="mt-16 grid gap-10 border-t-2 border-ink pt-6 text-ink sm:grid-cols-2">
        <section aria-labelledby="how-to-use">
          <h2 id="how-to-use" className="text-lg font-bold">How to use this</h2>
          <p className="mt-2 leading-relaxed">
            Pick a question above, or look up your address. The small blue numbers lead to a list naming the exact budget
            page each figure comes from, so you can check it in the city’s own documents.
          </p>
        </section>
        <section aria-labelledby="how-built">
          <h2 id="how-built" className="text-lg font-bold">How this was built</h2>
          <p className="mt-2 leading-relaxed">
            The numbers were extracted from the two budget PDFs, checked against the budget’s own totals and a second
            independent reading, and reviewed by a person. No figure on this site is written by AI; each one comes from
            the database with its page.
          </p>
        </section>
      </footer>
    </main>
  )
}
