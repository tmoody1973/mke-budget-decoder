// "Find it in the budget" (docs/09 step 3): figures from local coverage beside what the budget
// documents print, with a neutral label. The label describes the relationship; it doesn't judge the
// reporting (D17). Ruled rows, the label as words, never color alone.
import { Mark } from '@/components/genui/sources'
import { type Claim, LABEL_TEXT } from '@/lib/civic/claims'
import type { Article } from '@/lib/civic/news'

export type ShownClaim = Claim & { n: number; articles: (Article & { quote: string })[] }

export function FindInBudget({ claims }: { claims: ShownClaim[] }) {
  if (!claims.length) return null
  return (
    <section aria-labelledby="find-in-budget" className="mt-12">
      <h3 id="find-in-budget" className="border-t-2 border-ink pt-3 text-lg font-bold text-ink">Find it in the budget</h3>
      <p className="mt-1 max-w-[78ch] text-sm leading-relaxed text-ink">
        Figures from the coverage, set beside what the budget documents print. The labels describe how the two relate; they don’t judge the reporting.
      </p>
      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {claims.map((c) => (
          <li key={c.id} id={`claim-${c.id}`} className="row-target grid gap-3 py-4 md:grid-cols-[10rem_1fr_1fr] md:gap-6">
            <p className="text-sm font-semibold text-ink">{LABEL_TEXT[c.label]}</p>
            <div className="space-y-2 text-sm leading-relaxed">
              {c.articles.map((a) => (
                <p key={a.id}>
                  <span className="text-ink">“{a.quote}”</span>{' '}
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-ref underline underline-offset-2">{a.outlet}</a>
                </p>
              ))}
            </div>
            <div className="text-sm leading-relaxed text-ink">
              <p className="tabular">{c.budget.text.replace(/"([^"]+)"/g, '“$1”')}<Mark n={c.n} /></p>
              {c.note && <p className="mt-1 text-ink-soft">{c.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
