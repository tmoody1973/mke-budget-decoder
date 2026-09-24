// How it works: about the project, how the numbers are checked, and how the City Receipt is
// calculated. Method text follows docs/02 (pipeline, golden numbers) and docs/07 (receipt math);
// every rate shown is read from the database with its page, like the rest of the site.
import type { Metadata } from 'next'

import { Mark, SourcesList, sourceRegistry } from '@/components/genui/sources'
import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import { getRevenueLineByFund } from '@/lib/db/chat'
import { getSectionBudgets } from '@/lib/db/overview'
import { getReceiptRates } from '@/lib/db/receipt'
import { bigDollars } from '@/lib/format'
import evalRun from '@/evals/summary.json'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'How it works · Milwaukee Budget Decoder',
  description: 'What Milwaukee Budget Decoder is, how its numbers are checked against the budget documents, and how the City Receipt is calculated.',
}

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="mt-14 border-t-2 border-ink pt-3 text-xl font-bold tracking-[-0.01em] text-ink">{children}</h2>
)
// The four outcomes of the answer check (evals/run.mts, D23), latest full run on the production model.
const OUTCOMES = [
  ['correct', 'Correct', 'Right figures and points, and it followed the rules'],
  ['incomplete', 'Incomplete', 'Missed a figure or point, or broke a rule such as taking a side'],
  ['unsourced figure', 'Unsourced figure', 'Stated a number no lookup returned, even when the arithmetic was right'],
  ["couldn't answer", 'Couldn’t answer', 'Said it couldn’t find what was asked'],
] as const
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-3 leading-relaxed text-ink">{children}</p>

export default async function HowItWorks() {
  const [rates, sectionRows, salesTax] = await Promise.all([getReceiptRates(getDb(), BUDGET_VERSION),
    getSectionBudgets(getDb(), BUDGET_VERSION), getRevenueLineByFund(getDb(), BUDGET_VERSION, 'Local Sales Tax')])
  const src = sourceRegistry()
  const f = rates.fees
  const rows: { id: string; label: string; unit: string; a: string; b: string; n: number; note?: string }[] = [
    { id: 'rate-total', label: 'City property tax rate', unit: 'per $1,000 of assessed value', a: rates.total.r2026, b: rates.total.r2027, n: src.mark(rates.total.cite, { id: 'rate-total', label: 'the tax rate' }) },
    ...rates.components.map((c) => ({ id: `rate-${c.section}`, label: `  …for ${c.label}`, unit: 'per $1,000', a: c.r2026, b: c.r2027,
      n: src.mark(c.cite, { id: `rate-${c.section}`, label: 'the rate split' }) })),
    { id: 'fee-solid-waste', label: 'Solid waste (garbage) fee', unit: 'per home a year', a: f.solid_waste.v2026, b: f.solid_waste.v2027, n: src.mark(f.solid_waste.cite, { id: 'fee-solid-waste', label: 'city fees' }) },
    { id: 'fee-extra-cart', label: 'Extra garbage cart', unit: 'per cart a year', a: f.extra_cart.v2026, b: f.extra_cart.v2027, n: src.mark(f.extra_cart.cite, { id: 'fee-extra-cart', label: 'city fees' }) },
    { id: 'fee-snow', label: 'Snow and ice', unit: 'per foot of street frontage', a: f.snow_ice.v2026, b: f.snow_ice.v2027, n: src.mark(f.snow_ice.cite, { id: 'fee-snow', label: 'city fees' }) },
    { id: 'fee-lighting', label: 'Street lighting', unit: 'per foot of street frontage', a: f.street_lighting.v2026, b: f.street_lighting.v2027, n: src.mark(f.street_lighting.cite, { id: 'fee-lighting', label: 'city fees' }) },
    { id: 'fee-sewer', label: 'Sewer and stormwater', unit: 'average home a year', a: f.sewer_stormwater_avg.v2026, b: f.sewer_stormwater_avg.v2027, n: src.mark(f.sewer_stormwater_avg.cite, { id: 'fee-sewer', label: 'the sewer charge' }),
      note: 'The 2026 amount is worked out from the budget’s stated change, not printed directly.' },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <h1 className="text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">How it works</h1>
      <nav aria-label="On this page" className="mt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {[['#about', 'About'], ['#numbers', 'How the numbers are checked'], ['#accuracy', 'How well the chat answers'], ['#receipt', 'How we calculate your receipt']].map(([h, l]) => (
            <li key={h}><a href={h} className="font-semibold text-ref underline underline-offset-4">{l}</a></li>
          ))}
        </ul>
      </nav>

      {/* Written from Tarik's own answers (2026-09-24); his words, his edits. */}
      <H2 id="about">About</H2>
      <P>
        I built Milwaukee Budget Decoder to make the city’s budget easier to get into and understand. Each year the budget
        arrives as two long PDFs, hundreds of pages of tables and numbers, and it’s overwhelming even for people who want to follow along.
      </P>
      <P>
        I’ve lived in Milwaukee for more than 19 years and have worked at Radio Milwaukee that whole time; today I’m its Director of
        Digital Strategy and Innovation. This is a personal project, not a Radio Milwaukee product. For the past two years I’ve been
        learning to build products with AI, through more than 20 hackathons and several launched projects, and this site follows the
        rule I care most about: AI helps explain, but every number comes from the budget documents and links to its page.
      </P>
      <P>
        It’s for anyone who wants to be engaged with what Milwaukee is doing. If you spot a mistake, tell me on{' '}
        <a href="https://www.linkedin.com/in/tarikmoody" className="text-ref underline underline-offset-4">LinkedIn</a>.
      </P>
      <P>
        Everything here describes a <strong>proposal</strong>. The Common Council reviews and amends the budget before adopting it in
        November, so the numbers can still change. The site explains what the documents say; it doesn’t argue for or against any
        spending choice.
      </P>

      <H2 id="numbers">How the numbers are checked</H2>
      <P>
        Every figure comes from two documents the city published: the Proposed Plan and Executive Budget Summary (224 pages) and the
        Proposed Detailed Budget (455 pages). A program reads their tables into a database, and each row keeps its address in the
        documents: which book, which PDF page, which printed page and, for line items, which line.
      </P>
      <P>
        Twenty key figures, such as the all-funds total, the tax rate and the Police budget, were read by hand from the documents.
        Every change to the site is checked against them, and against the documents’ own totals (departments add up to their section,
        sections add up to the budget). If any check fails, the change can’t go live.
      </P>
      <P>
        Plain-language definitions and background facts were written from the documents and reviewed by a person before publishing.
        Where the documents disagree with themselves, the site shows the printed figure and says so in a note.
      </P>
      <P>
        The chat works on the same rule. The AI model picks which lookup to run and writes the sentences around the result; the
        figures come from the database with their pages, never from the model. It can still word things poorly, so check any
        figure you plan to use against its source page. The code is public on{' '}
        <a href="https://github.com/tmoody1973/mke-budget-decoder" className="text-ref underline underline-offset-4">GitHub</a>.
      </P>
      <P>How the budget PDFs become cited answers:</P>
      <ol className="mt-3 list-decimal space-y-2 pl-6 leading-relaxed text-ink">
        <li>The city’s two budget PDFs are the only source.</li>
        <li>A Python program reads their pages once, splitting them into figures (tables and line items) and narrative text.</li>
        <li>The figures are loaded into the database, each with its page. The number checks above test them against the documents’ own totals, and if any check fails, nothing new goes live.</li>
        <li>The narrative text is cut into passages and indexed so it can be searched by meaning and by keyword, each passage keeping its page.</li>
        <li>Pages and the chat read exact figures from the database tables, and background from the passage search.</li>
      </ol>
      <P>How the chat answers a question:</P>
      <ol className="mt-3 list-decimal space-y-2 pl-6 leading-relaxed text-ink">
        <li>You type a question in the chat panel.</li>
        <li>The site checks it first: questions are limited to 500 characters, and there are limits per visitor and per day to keep costs down.</li>
        <li>The AI model (Anthropic’s Claude) reads the question and picks from 16 read-only lookups, such as department totals, fees or a text search.</li>
        <li>The lookups return figures from the database with their pages. The model writes the sentences around them.</li>
        <li>The answer shows the figures as tables with source links. Each step is logged privately so wrong answers can be found and fixed.</li>
      </ol>
      <P>
        The same two paths as diagrams (best on a larger screen):{' '}
        <a href="/diagrams/rag.html" className="text-ref underline underline-offset-4">the budget data</a> and{' '}
        <a href="/diagrams/agent.html" className="text-ref underline underline-offset-4">the chat</a>.
      </P>

      <H2 id="accuracy">How well the chat answers</H2>
      <P>
        The chat is tested on {evalRun.questions} questions residents and journalists ask, including {evalRun.followUps} follow-ups
        asked partway through a conversation. Where a question has a known answer, the figures are checked against ones read from the
        documents by hand, and every answer is checked against rules such as staying neutral. A computer check also flags any dollar amount or percentage that didn’t come from a lookup.
      </P>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-[0.95rem]">
          <caption className="pb-2 text-left text-base font-semibold text-ink">Latest test, {new Date(`${evalRun.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</caption>
          <thead>
            <tr className="border-y-2 border-ink text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink">
              <th scope="col" className="py-2 pr-2">Outcome</th>
              <th scope="col" className="py-2 pl-2 text-right">Answers</th>
              <th scope="col" className="py-2 pl-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {OUTCOMES.map(([key, label, meaning]) => {
              const n = evalRun.buckets[key]
              return (
                <tr key={key} className="border-b border-rule align-top">
                  <th scope="row" className="py-2.5 pr-2 text-left font-normal text-ink">
                    <span className="font-semibold">{label}</span>
                    <span className="block text-sm text-ink-soft">{meaning}</span>
                  </th>
                  <td className="tabular py-2.5 pl-2 text-right text-ink">{n}</td>
                  <td className="tabular py-2.5 pl-2 text-right font-semibold text-ink">{Math.round((100 * n) / evalRun.questions)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <P>
        For comparison, researchers testing a chatbot for the Lexington, Massachusetts town budget reported 78% correct{' '}
        (<a href="https://arxiv.org/abs/2503.23299" className="text-ref underline underline-offset-4">GRASP, 2025</a>). Their questions
        were different, so read that as a rough guide, not a ranking. The{' '}
        <a href="https://github.com/tmoody1973/mke-budget-decoder/blob/main/evals/golden.yaml" className="text-ref underline underline-offset-4">test questions</a>{' '}
        are public.
      </P>

      <H2 id="receipt">How we calculate your receipt</H2>
      <P>Your City Receipt estimates what the city charges one property, under the 2026 budget and under the Mayor’s proposal for 2027.</P>
      <ol className="mt-3 list-decimal space-y-2 pl-6 leading-relaxed text-ink">
        <li>We find the property in the city’s Master Property File (MPROP), the public list of every parcel and its assessed value.</li>
        <li><strong>City property tax:</strong> the 2026 assessment times the proposed 2027 rate, divided by 1,000. The 2026 figure uses
          the 2025 assessment and the 2026 rate.</li>
        <li><strong>Where it goes:</strong> the same assessment times each part of the rate (city operations, debt, pensions and so on).
          Only this split is exact; property tax isn’t set aside for individual departments.</li>
        <li><strong>City charges:</strong> the garbage fee for each home (when the city collects garbage there), snow and ice and street
          lighting by the foot of street frontage, and the average household sewer and stormwater charge.</li>
        <li><strong>Renters</strong> see the building’s total divided by its number of homes. The owner pays it; the budget doesn’t show
          how much of it reaches rent, so the receipt doesn’t guess.</li>
      </ol>

      <div className="tabular mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-[0.95rem]">
          <caption className="pb-2 text-left text-base font-semibold text-ink">The rates and charges the receipt uses</caption>
          <thead>
            <tr className="border-y-2 border-ink text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink">
              <th scope="col" className="py-2 pr-2">Item</th>
              <th scope="col" className="py-2 pl-2 text-right">2026</th>
              <th scope="col" className="py-2 pl-2 text-right">2027 proposed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} id={r.id} className="row-target border-b border-rule align-top">
                <th scope="row" className="py-2.5 pr-2 text-left font-normal text-ink">
                  {r.label.trimStart()}<Mark n={r.n} q={[r.a, r.b]} />
                  <span className="block text-sm text-ink-soft">{r.unit}{r.note ? `. ${r.note}` : ''}</span>
                </th>
                <td className="py-2.5 pl-2 text-right text-ink-soft">${r.a}</td>
                <td className="py-2.5 pl-2 text-right font-semibold text-ink">${r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 id="debt-pensions" className="mt-8 font-bold text-ink">Why debt and pensions look bigger on the Overview</h3>
      {(() => {
        // Summary p.7 prints each section's total and the part the property tax levy pays; p.163 the sales tax for pensions.
        const debt = sectionRows.find((r) => r.section === 'D')!, pensions = sectionRows.find((r) => r.section === 'B')!
        const pensionSalesTax = salesTax.find((r) => r.fund === 'employee-retirement')
        const n7 = src.mark(debt.cite, { id: 'debt-pensions', label: 'section totals and levies' })
        const n163 = pensionSalesTax ? src.mark(pensionSalesTax.cite, { id: 'pension-sales-tax', label: 'the sales tax for pensions' }) : null
        return (
          <P>
            The Overview shows what each budget section costs in total. The receipt shows only the part paid by the city property tax.
            City debt costs {bigDollars(debt.proposed2027)} in the 2027 proposal, and {bigDollars(debt.levy2027)} of it comes from the
            property tax<Mark n={n7} q={[debt.proposed2027, debt.levy2027]} />; other money pays the rest. Pensions cost{' '}
            {bigDollars(pensions.proposed2027)}, of which {bigDollars(pensions.levy2027)} comes from the property tax
            {pensionSalesTax?.proposed2027 && n163 !== null
              ? <> and {bigDollars(pensionSalesTax.proposed2027)} from the city’s sales tax<Mark n={n163} q={[pensionSalesTax.proposed2027]} /></>
              : null}. That’s why the debt total can rise while the debt part of your tax rate falls: most of the increase is paid by
            other money, and the rate is the levy divided by the city’s total assessed value, which grew.
          </P>
        )
      })()}

      <h3 className="mt-8 font-bold text-ink">What the receipt assumes</h3>
      <ul className="mt-2 list-disc space-y-1 pl-6 leading-relaxed text-ink">
        <li>40 feet of street frontage, the typical property the budget itself uses, because the property file has no frontage.</li>
        <li>City garbage service for homes with one to four units; larger buildings usually hire private haulers.</li>
        <li>One garbage cart, and an average household’s sewer and stormwater charge (actual charges depend on water use).</li>
        <li>Condo buildings list no unit numbers in the property file, so condo owners type in their unit’s assessed value.</li>
      </ul>
      <h3 className="mt-6 font-bold text-ink">What it leaves out</h3>
      <P>
        Only the city’s part of a property tax bill. Milwaukee Public Schools, Milwaukee County, the Metropolitan Sewerage District
        (MMSD) and Milwaukee Area Technical College (MATC) set their own taxes, and state credits reduce the bill. Tax-exempt and
        state-assessed properties get no estimate.
      </P>
      <h3 className="mt-6 font-bold text-ink">Privacy</h3>
      <P>
        The addresses you type aren’t stored or logged. Owner names and mailing addresses from the property file are never loaded.
        The shareable receipt image leaves out the address and the assessed value.
      </P>

      <SourcesList sources={src} />
    </main>
  )
}
