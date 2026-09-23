// "What's in the news, and what the budget says" (docs/09 step 2). Each topic pairs the budget's own
// cited figures and pages with the coverage about it. Articles are headline, outlet, date and link
// only; no figure here comes from an article (DESIGN.md ruled blocks, no cards).
import { AskLink } from '@/components/chat/chat-shell'
import { Mark } from '@/components/genui/sources'
import type { Article } from '@/lib/civic/news'
import type { TopicFigure } from '@/lib/db/news'
import { bigDollars, pct } from '@/lib/format'

export type NewsTopic = {
  id: string; title: string; question: string
  figures: (TopicFigure & { n: number })[]
  pages: { n: number; label: string; printed: string }[]
  articles: Article[]
}

const fmtDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
const money = (f: TopicFigure, v: number) =>
  f.kind === 'dollars' ? bigDollars(v) : `$${v.toFixed(2)}`

function Figure({ f }: { f: TopicFigure & { n: number } }) {
  const change = f.adopted2026 === null ? null : pct(f.adopted2026, f.proposed2027)
  return (
    <li id={f.id} className="row-target -mx-1 border-b border-rule px-1 py-2">
      <p className="text-sm text-ink-soft">{f.label}</p>
      <p className="tabular mt-0.5 text-ink">
        <span className="text-lg font-bold">{money(f, f.proposed2027)}</span>
        <Mark n={f.n} q={[f.adopted2026 ?? '', f.proposed2027].filter((v) => v !== '').map((v) => (f.kind === 'dollars' ? v : Number(v).toFixed(2)))} />
        <span className="ml-1 text-sm text-ink-soft">
          {f.adopted2026 === null ? 'proposed for 2027' : `proposed, ${change} from ${money(f, f.adopted2026)} in 2026`}
        </span>
      </p>
    </li>
  )
}

export function InTheNews({ topics }: { topics: NewsTopic[] }) {
  return (
    <div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((t) => (
        <section key={t.id} aria-labelledby={`topic-${t.id}`} className="border-t-2 border-ink pt-3">
          <h3 id={`topic-${t.id}`} className="text-lg font-bold text-ink">{t.title}</h3>
          {t.figures.length > 0 && <ul className="mt-2">{t.figures.map((f) => <Figure key={f.id} f={f} />)}</ul>}
          {t.pages.length > 0 && (
            <p className="mt-3 text-sm leading-relaxed text-ink">
              {t.figures.length === 0 && 'Our data doesn’t have a 2027 figure for this yet. '}
              In the budget:{' '}
              {t.pages.map((p, i) => (
                <span key={p.n}>{i > 0 && '; '}{p.label}, page {p.printed}<Mark n={p.n} /></span>
              ))}.
            </p>
          )}
          <p className="mt-3"><AskLink question={t.question}>Ask about {t.title.toLowerCase()}</AskLink></p>
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-[0.06em] text-ink">Coverage</h4>
          <ul className="mt-1 space-y-2">
            {t.articles.map((a) => (
              <li key={a.id} className="text-sm leading-snug">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-ref underline underline-offset-2">{a.headline}</a>
                <span className="block text-ink-soft">{a.outlet} · {fmtDate.format(new Date(`${a.date}T12:00:00Z`))}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
