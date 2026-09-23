// Overview (D15): answer the visitor's question first, trust material second.
import { ArrowDown } from 'lucide-react'

import {
  AskedVsProposed, BiggestChanges, RevenueMix, SectionBudgets, SourceLine,
} from '@/components/genui/budget-tables'
import { ReceiptFinder } from '@/components/receipt/receipt-finder'
import { BUDGET_VERSION, db } from '@/lib/db/client'
import { getDepartmentTotals, getHeadline, getRevenueMix, getSectionBudgets } from '@/lib/db/overview'
import { bigDollars, pct } from '@/lib/format'

const QUESTIONS = [
  { href: '#taxes', q: 'Are my property taxes going up?' },
  { href: '#spending', q: 'Where does the money go?' },
  { href: '#revenue', q: 'Where does the money come from?' },
  { href: '#departments', q: 'What did departments ask for, and what did they get?' },
  { href: '#changes', q: 'What changed the most from 2026?' },
]

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="scroll-mt-6 text-2xl font-bold tracking-[-0.01em] text-ink sm:text-3xl">{children}</h2>
)
const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 max-w-[62ch] leading-relaxed text-ink">{children}</p>
)

export default async function Overview() {
  const [h, sections, mix, depts] = await Promise.all([
    getHeadline(db, BUDGET_VERSION), getSectionBudgets(db, BUDGET_VERSION),
    getRevenueMix(db, BUDGET_VERSION), getDepartmentTotals(db, BUDGET_VERSION),
  ])
  const levyUp = h.levy.proposed2027 >= h.levy.adopted2026

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-14">
      <p className="text-sm font-semibold text-ink">MKE Budget Decoder</p>
      <h1 className="mt-6 text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">
        Milwaukee’s proposed 2027 budget, with every number traced to its page
      </h1>
      <p className="tabular mt-5 max-w-[62ch] text-lg leading-relaxed text-ink">
        The Mayor proposes spending <strong>{bigDollars(h.allFunds.proposed2027)}</strong> across all city funds in
        2027, including <strong>{bigDollars(h.gcp.proposed2027)}</strong> for general city services. This is a
        proposal: the Common Council can change it before adopting the budget in November.
      </p>
      <SourceLine cites={[h.allFunds.cite, { doc: 'summary', pdf_page: 4, printed_page: 'front matter' }]} />

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
        <Lead>
          It depends on your home. The city’s total property tax levy goes {levyUp ? 'up' : 'down'} from{' '}
          {bigDollars(h.levy.adopted2026)} to {bigDollars(h.levy.proposed2027)} ({pct(h.levy.adopted2026, h.levy.proposed2027)}),
          while the tax rate goes from ${h.rate.r2026} to ${h.rate.r2027} per $1,000 of assessed value, because the city’s total
          assessed value grew. Whether your bill rises depends on how your home’s assessment changed. Look it up:
        </Lead>
        <SourceLine cites={[h.levy.cite]} />
        <div className="mt-8"><ReceiptFinder /></div>
      </section>

      <section className="mt-20">
        <H2 id="spending">Where the money goes</H2>
        <Lead>
          The budget is divided into lettered sections. General city purposes pays for most departments; the others are
          pensions, debt, capital projects and funds with their own revenue, such as Water Works.
        </Lead>
        <SectionBudgets rows={sections} />
      </section>

      <section className="mt-20">
        <H2 id="revenue">Where the general city money comes from</H2>
        <Lead>
          The {bigDollars(h.gcp.proposed2027)} for general city purposes comes from these sources. Property tax is one of them,
          not the largest.
        </Lead>
        <RevenueMix rows={mix} />
      </section>

      <section className="mt-20">
        <H2 id="departments">What departments asked for, and what the Mayor proposed</H2>
        <Lead>
          Each department sent a request; the Mayor’s proposal is what reached the Council. Largest budgets first.
        </Lead>
        <AskedVsProposed rows={depts} />
      </section>

      <section className="mt-20">
        <H2 id="changes">What changed the most from 2026</H2>
        <BiggestChanges rows={depts} />
      </section>

      <footer className="mt-24 grid gap-10 border-t-2 border-ink pt-6 text-ink sm:grid-cols-2">
        <section aria-labelledby="how-to-use">
          <h2 id="how-to-use" className="text-lg font-bold">How to use this</h2>
          <p className="mt-2 leading-relaxed">
            Pick a question above, or look up your address. Every table names the budget page it comes from, so you can
            check any figure in the city’s own documents.
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
