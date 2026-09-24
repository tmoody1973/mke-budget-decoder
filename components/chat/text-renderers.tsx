'use client'
// Chat cards for the lookups that return words rather than totals: a department's breakdown, budget
// passages, reviewed facts, glossary entries and the hearing calendar. Each card numbers its own
// sources, so every page the answer leans on opens in the PDF drawer.
import { useRenderTool } from '@copilotkit/react-core/v2'
import { z } from 'zod'

import { DeptBreakdown } from '@/components/genui/budget-tables'
import { Mark, sourceRegistry } from '@/components/genui/sources'
import type { CivicEvent } from '@/lib/civic/events'
import type { BreakdownRow } from '@/lib/db/chat'
import type { Cite } from '@/lib/db/schema'
import type { Passage } from '@/lib/db/search'

import { Card, type CardFact, Failed, FactsList, Pending, parse } from './tool-renderers'

const excerpt = (t: string, n = 220) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n).replace(/\s\S*$/, '')}…` : s }
const TZ = 'America/Chicago'
const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
const fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const when = (e: CivicEvent) => e.start.length === 10
  ? `${fmtDay.format(new Date(`${e.start}T12:00:00Z`))}${e.end ? ` – ${fmtDay.format(new Date(`${e.end}T12:00:00Z`))}` : ''}`
  : `${fmtDay.format(new Date(e.start))}, ${fmtTime.format(new Date(e.start))}`

export function TextRenderers() {
  useRenderTool({
    name: 'getDepartmentBreakdown',
    parameters: z.object({ slug: z.string() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="what the department spends on" />
      const b = parse<{ name: string; cite: Cite; rows: BreakdownRow[]; facts?: CardFact[] }>(result)
      if (!b?.rows?.length) return <Failed />
      const src = sourceRegistry()
      const lines = b.rows.map((r) => ({ ...r, id: `bd-${r.metric}`, n: src.mark(b.cite, { id: `bd-${r.metric}`, label: r.label }) }))
      return <Card title={`${b.name}: what the money pays for`} sources={src}><DeptBreakdown lines={lines} /><FactsList facts={b.facts} src={src} /></Card>
    },
  }, [])

  useRenderTool({
    name: 'searchBudgetText',
    parameters: z.object({ query: z.string() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="what the documents say" />
      const got = parse<{ passages: Passage[]; facts?: CardFact[] }>(result)
      const passages = got?.passages
      if (!passages?.length && !got?.facts?.length) return <p className="my-2 text-sm text-ink-soft">The budget text didn’t turn up a matching passage.</p>
      const src = sourceRegistry()
      return (
        <Card title="From the budget’s own words" sources={src}>
          <FactsList facts={got?.facts} src={src} />
          <ul className="mt-2 space-y-2">
            {(passages ?? []).map((p) => (
              <li key={p.id} className="border-b border-rule pb-2 text-sm leading-relaxed">
                <span className="block text-xs font-semibold text-ink-soft">{p.context}{p.heading ? ` · ${p.heading}` : ''}</span>
                {excerpt(p.text)}<Mark n={src.mark(p.cite, { id: p.id, label: p.heading ?? 'passage' })} />
              </li>
            ))}
          </ul>
        </Card>
      )
    },
  }, [])

  useRenderTool({
    name: 'getBudgetFacts',
    parameters: z.object({ query: z.string() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="the reviewed facts" />
      const facts = parse<{ facts: { id: string; statement: string; context: string | null; cite: Cite }[] }>(result)?.facts
      if (!facts?.length) return null // nothing matched; the answer goes on to search the text
      const src = sourceRegistry()
      return (
        <Card title="What the budget states" sources={src}>
          <ul className="mt-2 space-y-2">
            {facts.map((f) => (
              <li key={f.id} className="border-b border-rule pb-2 text-sm leading-relaxed">
                {f.statement}<Mark n={src.mark(f.cite, { id: f.id, label: f.id })} />
                {f.context && <span className="mt-1 block text-ink-soft">{f.context}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )
    },
  }, [])

  useRenderTool({
    name: 'lookupGlossary',
    parameters: z.object({ term: z.string() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return null
      const entries = parse<{ entries: { term: string; definition: string; ours: boolean; cite: Cite }[] }>(result)?.entries
      if (!entries?.length) return null
      const src = sourceRegistry()
      return (
        <Card title="Definition" sources={src}>
          <dl className="mt-2 space-y-2 text-sm leading-relaxed">
            {entries.slice(0, 1).map((e) => (
              <div key={e.term}>
                <dt className="font-semibold">{e.term}</dt>
                <dd>{e.definition}<Mark n={src.mark(e.cite, { id: `gl-${e.term}`, label: e.term })} />
                  {e.ours && <span className="block text-xs text-ink-soft">Our plain-language wording; the budget uses the term without defining it.</span>}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )
    },
  }, [])

  useRenderTool({
    name: 'getHearingCalendar',
    parameters: z.object({}),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="the Council’s schedule" />
      const cal = parse<{ events: CivicEvent[]; deadlines: { statement: string; cite: Cite } }>(result)
      if (!cal?.events?.length) return <Failed />
      const src = sourceRegistry()
      return (
        <Card title="The Common Council’s budget schedule" sources={src}>
          <ol className="mt-2 text-sm leading-relaxed">
            {cal.events.map((e) => (
              <li key={e.id} className="border-b border-rule py-2">
                <span className="tabular block font-semibold">{when(e)}</span>
                {e.title}<span className="block text-ink-soft">{e.place}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm">{cal.deadlines.statement}<Mark n={src.mark(cal.deadlines.cite, { id: 'deadlines', label: 'legal deadlines' })} /></p>
        </Card>
      )
    },
  }, [])

  return null
}
