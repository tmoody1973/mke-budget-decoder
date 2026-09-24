// Overview dashboard: Front-Page Broadsheet layout (.impeccable/surfaces/app-page-tsx.md, D15 order).
import { AskedVsProposed, BiggestChanges, RevenueMix, SectionBudgets } from '@/components/genui/budget-tables'
import { BoxScore, BudgetTreemap, headlineScores, LevyVsRate, Movers, ShowTable } from '@/components/genui/charts'
import { Mark, NoteMark, SourcesList, sourceRegistry } from '@/components/genui/sources'
import { FindInBudget } from '@/components/civic/find-in-budget'
import { InTheNews } from '@/components/civic/in-the-news'
import { TakePart } from '@/components/civic/take-part'
import { ReceiptBand } from '@/components/receipt/receipt-band'
import { ReceiptFinder } from '@/components/receipt/receipt-finder'
import { EVENTS } from '@/lib/civic/events'
import { reviewedClaims } from '@/lib/civic/claims'
import { ARTICLES, TOPICS } from '@/lib/civic/news'
import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import {
  getBudgetFact, getDepartmentTotals, getGcpReconciliation, getHeadline, getRevenueMix, getSectionBudgets,
} from '@/lib/db/overview'
import { getTopicFigures } from '@/lib/db/news'
import type { Cite } from '@/lib/db/schema'
import { bigDollars } from '@/lib/format'

// Rendered per request: the page reads the database, and CI builds without one.
export const dynamic = 'force-dynamic'

const CALENDAR: Cite = { doc: 'summary', pdf_page: 4, printed_page: 'front matter' }

const PanelTitle = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="scroll-mt-6 border-t-2 border-ink pt-3 text-xl font-bold tracking-[-0.01em] text-ink">{children}</h2>
)

export default async function Overview() {
  const db = getDb()
  const [h, sectionRows, mixRows, deptRows, rec, deadlines, topicFigures] = await Promise.all([
    getHeadline(db, BUDGET_VERSION), getSectionBudgets(db, BUDGET_VERSION), getRevenueMix(db, BUDGET_VERSION),
    getDepartmentTotals(db, BUDGET_VERSION), getGcpReconciliation(db, BUDGET_VERSION), getBudgetFact(db, BUDGET_VERSION, 'legal-deadlines'),
    getTopicFigures(db, BUDGET_VERSION),
  ])

  // Number every source in reading order before rendering, so the marks and the list agree.
  const src = sourceRegistry()
  const intro = src.mark(h.allFunds.cite, { id: 'intro', label: 'the summary at the top' })
  const calendar = src.mark(CALENDAR, { id: 'intro', label: 'the summary at the top' })
  const scores = headlineScores(h, src)
  const rateDown = Number(h.rate.r2027) < Number(h.rate.r2026)
  const sections = sectionRows.map((r) => ({ ...r, id: `sec-${r.section}`, n: src.mark(r.cite, { id: `sec-${r.section}`, label: `section ${r.section}` }) }))
  const levyGcp = mixRows.find((r) => r.key === 'levy')!
  const gcpTotal = mixRows.reduce((x, r) => x + r.proposed2027, 0)
  const revGcpMark = src.mark(h.gcp.cite, { id: 'revenue-lead', label: 'the revenue summary' })
  const revLevyMark = src.mark(levyGcp.cite, { id: 'revenue-lead', label: 'the revenue summary' })
  const mix = [...mixRows].sort((a, b) => b.proposed2027 - a.proposed2027)
    .map((r) => ({ ...r, id: `rev-${r.key}`, n: src.mark(r.cite, { id: `rev-${r.key}`, label: r.label.split(' (')[0].toLowerCase() }) }))
  const depts = deptRows.map((r) => ({ ...r, id: `dept-${r.slug}`, n: src.mark(r.cite, { id: `dept-${r.slug}`, label: r.shortName ?? r.name }) }))
  const spa = { ...rec.specialPurpose, label: 'Special purpose accounts', id: 'dept-spa', n: src.mark(rec.specialPurpose.cite, { id: 'dept-spa', label: 'special purpose accounts' }) }
  const offset = { ...rec.fringeOffset, label: 'Fringe benefit offset', id: 'dept-offset', n: src.mark(rec.fringeOffset.cite, { id: 'dept-offset', label: 'the fringe benefit offset' }) }
  const gcp = { ...h.gcp, label: 'General city purposes', id: 'dept-gcp', n: src.mark(h.gcp.cite, { id: 'dept-gcp', label: 'general city purposes' }) }
  const withChange = depts.map((d) => ({ ...d, change: d.proposed2027 - d.adopted2026 }))
  const movers = [
    ...withChange.filter((d) => d.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
    ...withChange.filter((d) => d.change < 0).sort((a, b) => b.change - a.change).slice(-5),
  ].map((d) => ({ id: d.id, name: d.shortName ?? d.name, fullName: d.name, change: d.change, adopted2026: d.adopted2026, proposed2027: d.proposed2027, n: d.n }))
  const levyMark = src.mark(h.levy.cite, { id: 'taxes-lead', label: 'the property tax levy and rate' })
  const levyUp = h.levy.proposed2027 > h.levy.adopted2026
  // News topics sit before "Have your say", so their marks are numbered first.
  const topics = TOPICS.map((t) => ({
    id: t.id, title: t.title, question: t.question,
    figures: topicFigures[t.id].map((f) => ({ ...f, n: src.mark(f.cite, { id: f.id, label: f.label.split(',')[0].toLowerCase() }) })),
    pages: t.pages.map((p) => ({ n: src.mark(p.cite, { id: `topic-${t.id}`, label: `${t.title.toLowerCase()} coverage` }), label: p.label, printed: p.cite.printed_page })),
    articles: ARTICLES.filter((a) => a.topics.includes(t.id)).sort((a, b) => b.date.localeCompare(a.date) || a.outlet.localeCompare(b.outlet)),
  }))
  const claims = reviewedClaims().map((c) => ({ ...c,
    n: src.mark(c.budget.cite, { id: `claim-${c.id}`, label: 'a news figure' }),
    articles: c.sources.flatMap((x) => { const a = ARTICLES.find((y) => y.id === x.article); return a ? [{ ...a, quote: x.quote }] : [] }) }))
  const deadlineMark = src.mark(deadlines.cite, { id: 'take-part-deadline', label: 'the legal deadlines' })

  const blocks = sectionRows.map((r) => ({ key: r.section, letter: r.section, label: r.name, short: r.short, value: r.proposed2027, levy: r.taxRate2027 > 0, levyAmount: r.levy2027 }))
  const ups = withChange.filter((d) => d.change > 0).length, downs = withChange.filter((d) => d.change < 0).length
  const notes = [
    { l: 'a', text: 'The budget has no sections lettered E or L.' },
    { l: 'b', text: 'Special purpose accounts are citywide spending lines, such as worker’s compensation, that sit outside any department. The fringe benefit offset removes employee benefit costs that are budgeted twice, in special purpose accounts and again in department budgets, so the city does not levy for them twice.' },
  ]

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <header>
        <div>
          <h1 className="text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">
            Milwaukee’s proposed 2027 budget, traced to every page
          </h1>
          <p id="intro" className="row-target tabular -mx-1 mt-3 max-w-[78ch] px-1 text-lg leading-relaxed text-ink">
            The Mayor proposes {bigDollars(h.allFunds.proposed2027)} across all city funds, including{' '}
            {bigDollars(h.gcp.proposed2027)} for general city purposes.<Mark n={intro} q={[h.allFunds.proposed2027, h.gcp.proposed2027]} /> It is a proposal: the Common Council can
            change it before adopting the budget in November.<Mark n={calendar} />
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-0">
        <section aria-labelledby="spending" className="lg:col-span-8 lg:pr-8">
          <PanelTitle id="spending">Where the {bigDollars(h.allFunds.proposed2027)} would go</PanelTitle>
          <p className="mt-1 text-sm text-ink-soft">Each block is a budget section, sized by its 2027 proposed amount.<Mark n={sections[0].n} /></p>
          <div className="mt-3"><BudgetTreemap blocks={blocks} total={h.allFunds.proposed2027} n={sections[0].n} /></div>
          <ShowTable><SectionBudgets rows={sections} noteMark="a" /></ShowTable>
        </section>
        <aside aria-label="Headline numbers" className="-order-1 lg:order-none lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          <BoxScore scores={scores} />
        </aside>
      </div>

      <div className="mt-16 grid gap-12 lg:grid-cols-12 lg:gap-0">
        <section aria-labelledby="departments" className="lg:col-span-7 lg:pr-8">
          <PanelTitle id="departments">What departments asked for, and what the Mayor proposed</PanelTitle>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            Largest budgets first. Two citywide lines at the bottom take the departments to general city purposes.<NoteMark l="b" />
          </p>
          <AskedVsProposed rows={depts} specialPurpose={spa} fringeOffset={offset} gcp={gcp} />
        </section>
        <div className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
          <section aria-labelledby="revenue">
            <PanelTitle id="revenue">Where the general city money comes from</PanelTitle>
            <p id="revenue-lead" className="row-target tabular -mx-1 mt-2 px-1 text-sm leading-relaxed text-ink">
              {bigDollars(gcpTotal)} in all, largest source first.<Mark n={revGcpMark} q={[gcpTotal]} /> Property tax supplies{' '}
              {bigDollars(levyGcp.proposed2027)} ({((levyGcp.proposed2027 / gcpTotal) * 100).toFixed(1)}%) of it.<Mark n={revLevyMark} q={[levyGcp.proposed2027]} />
            </p>
            <RevenueMix rows={mix} />
          </section>
          <section aria-labelledby="changes" className="mt-12">
            <PanelTitle id="changes">What the Mayor proposes to change most</PanelTitle>
            <p className="mt-2 text-sm leading-relaxed text-ink">
            The {Math.min(5, ups)} largest proposed increases and the {Math.min(5, downs) === downs ? `${downs} proposed decreases` : `${Math.min(5, downs)} largest decreases`},
            by department, 2026 adopted to 2027 proposed.
          </p>
            <div className="mt-4"><Movers movers={movers} /></div>
            <ShowTable><BiggestChanges rows={depts} /></ShowTable>
          </section>
        </div>
      </div>

      <section aria-labelledby="taxes" className="mt-16 grid gap-10 lg:grid-cols-12 lg:gap-0">
        <div className="lg:col-span-5 lg:pr-8">
          <PanelTitle id="taxes">Are my property taxes going up?</PanelTitle>
          <p id="taxes-lead" className="row-target tabular -mx-1 mt-2 px-1 leading-relaxed text-ink">
            Under the Mayor’s proposal, the city’s property tax levy would {levyUp ? 'rise' : 'fall'} while the tax rate
            would {rateDown ? 'fall' : 'rise'}{levyUp && rateDown ? ', because the total assessed value of property in the city grew' : ''}.<Mark n={levyMark} q={[h.levy.adopted2026, h.levy.proposed2027, h.rate.r2026, h.rate.r2027]} />{' '}
            Whether the city’s share of your bill rises depends on how your home’s assessment changed compared with the citywide
            change. School, county, sewerage district and technical college taxes on the same bill are set separately.
          </p>
          <div className="mt-6"><LevyVsRate d={{ levy2026: h.levy.adopted2026, levy2027: h.levy.proposed2027, rate2026: h.rate.r2026, rate2027: h.rate.r2027 }} /></div>
          <ShowTable>
            <table className="tabular mt-4 w-full border-collapse text-[0.95rem]">
              <caption className="sr-only">City property tax levy and tax rate, 2026 adopted and 2027 proposed</caption>
              <thead>
                <tr className="border-y-2 border-ink text-left text-xs font-semibold uppercase tracking-normal sm:tracking-[0.06em]">
                  <th scope="col" className="py-2 pr-2 font-semibold">City-wide</th>
                  <th scope="col" className="py-2 pl-2 text-right font-semibold sm:pl-4">2026 adopted</th>
                  <th scope="col" className="py-2 pl-2 text-right font-semibold sm:pl-4">2027 proposed</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-rule">
                  <th scope="row" className="py-3 pr-2 text-left font-normal">Property tax levy<Mark n={levyMark} q={[h.levy.adopted2026, h.levy.proposed2027]} /></th>
                  <td className="py-3 pl-2 text-right sm:pl-4">{bigDollars(h.levy.adopted2026)}</td>
                  <td className="py-3 pl-2 text-right font-semibold sm:pl-4">{bigDollars(h.levy.proposed2027)}</td>
                </tr>
                <tr className="border-b border-rule">
                  <th scope="row" className="py-3 pr-2 text-left font-normal">Tax rate per $1,000<Mark n={levyMark} q={[h.rate.r2026, h.rate.r2027]} /></th>
                  <td className="py-3 pl-2 text-right sm:pl-4">${h.rate.r2026}</td>
                  <td className="py-3 pl-2 text-right font-semibold sm:pl-4">${h.rate.r2027}</td>
                </tr>
              </tbody>
            </table>
          </ShowTable>
        </div>
        <div className="lg:col-span-7 lg:border-l lg:border-rule lg:pl-8">
          <ReceiptBand>
            <h3 className="text-xl font-bold text-ink">Look up your city receipt</h3>
            <div className="mt-4"><ReceiptFinder /></div>
          </ReceiptBand>
        </div>
      </section>

      <section aria-labelledby="news" className="mt-16">
        <PanelTitle id="news">What’s in the news, and what the budget says</PanelTitle>
        <p className="mt-2 max-w-[78ch] text-sm leading-relaxed text-ink">
          The topics local coverage leads with. Figures come from the budget documents, not from the stories; headlines link to each outlet.
        </p>
        <InTheNews topics={topics} />
        <FindInBudget claims={claims} />
      </section>

      <section aria-labelledby="take-part" className="mt-16 grid gap-10 lg:grid-cols-12 lg:gap-0">
        <div className="lg:col-span-4 lg:pr-8">
          <PanelTitle id="take-part">Have your say before the Council votes</PanelTitle>
          <p className="mt-2 leading-relaxed text-ink">
            The Common Council reviews and can amend the Mayor’s proposal. There are two hearings where residents can speak,
            and every step is broadcast on the City Channel.
          </p>
        </div>
        <div className="lg:col-span-8 lg:border-l lg:border-rule lg:pl-8">
          <TakePart events={EVENTS} now={new Date()}
            deadline={<span id="take-part-deadline" className="row-target -mx-1 px-1">{deadlines.statement}<Mark n={deadlineMark} q={['November 14']} /></span>} />
        </div>
      </section>

      <SourcesList sources={src} notes={notes} />

      <footer className="mt-16 grid gap-10 border-t-2 border-ink pt-6 text-ink sm:grid-cols-2">
        <section aria-labelledby="how-to-use">
          <h2 id="how-to-use" className="text-lg font-bold">How to use this</h2>
          <p className="mt-2 max-w-[62ch] leading-relaxed">
            Start with the big picture at the top, or jump to a question. The small blue numbers lead to a list naming the
            exact budget page each figure comes from; every chart can be shown as a table.
          </p>
        </section>
        <section aria-labelledby="how-built">
          <h2 id="how-built" className="text-lg font-bold">How this was built</h2>
          <p className="mt-2 max-w-[62ch] leading-relaxed">
            The numbers were extracted from the two budget PDFs, checked against the budget’s own totals and a second
            independent reading, and reviewed by a person. No figure on this site is written by AI; each one comes from the
            database with its page.
          </p>
        </section>
      </footer>
    </main>
  )
}
