'use client'
// How the chat draws answers (render mode "tool-render"): each data tool call draws one of our cited
// components from the tool's own result, so every figure on screen traces to lib/db, not the model.
import { useConfigureSuggestions, useRenderTool } from '@copilotkit/react-core/v2'
import { z } from 'zod'

import { DeptSnapshot } from '@/components/genui/budget-tables'
import { BoxScore, headlineScores, Movers } from '@/components/genui/charts'
import { CardSources, sourceRegistry, type Sources } from '@/components/genui/sources'
import type { getDepartmentTotals, getHeadline } from '@/lib/db/overview'

type Headline = Awaited<ReturnType<typeof getHeadline>>
type Dept = Awaited<ReturnType<typeof getDepartmentTotals>>[number]

const SUGGESTIONS = [
  { title: 'The big picture', message: 'How big is the proposed 2027 budget, and how does it compare to this year?' },
  { title: 'Fire department', message: 'Why is the fire department budget changing?' },
  { title: 'Biggest changes', message: 'Which departments would get the biggest increases and decreases?' },
  { title: 'Property taxes', message: 'Is my city property tax going up?' },
]

/** One answer card: its own source numbering (the drawer looks inside `data-src-scope`). */
export function Card({ title, sources, children }: { title: string; sources: Sources; children: React.ReactNode }) {
  return (
    <figure data-src-scope className="my-3 border-t-2 border-ink bg-paper pt-2 text-ink">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {children}
      <CardSources sources={sources} />
    </figure>
  )
}

export const Pending = ({ what }: { what: string }) => <p className="my-2 text-sm text-ink-soft">Looking up {what} in the budget…</p>
export const Failed = () => <p className="my-2 text-sm text-ink-soft">That lookup did not return budget figures.</p>

export function parse<T>(result: string): T | null {
  try { return JSON.parse(result) as T } catch { return null }
}

export function Renderers() {
  useConfigureSuggestions({ suggestions: SUGGESTIONS, available: 'before-first-message' })

  useRenderTool({
    name: 'getBudgetOverview',
    parameters: z.object({}),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="the headline numbers" />
      const h = parse<Headline>(result)
      if (!h?.allFunds) return <Failed />
      const src = sourceRegistry()
      const scores = headlineScores(h, src)
      return <Card title="The Mayor’s proposed 2027 budget, compared with 2026 adopted" sources={src}><BoxScore scores={scores} /></Card>
    },
  }, [])

  useRenderTool({
    name: 'getDepartments',
    parameters: z.object({ slugs: z.array(z.string()).optional(), view: z.enum(['stages', 'changes']).optional() }),
    render: ({ status, parameters, result }) => {
      if (status !== 'complete') return <Pending what="department budgets" />
      const rows = parse<{ rows: Dept[] }>(result)?.rows
      if (!rows?.length) return <Failed />
      const src = sourceRegistry()
      const numbered = (list: Dept[]) => list.map((r) => ({ ...r, id: `dept-${r.slug}`, n: src.mark(r.cite, { id: `dept-${r.slug}`, label: r.shortName ?? r.name }) }))
      if (parameters.view === 'changes') {
        const ch = rows.map((d) => ({ ...d, change: d.proposed2027 - d.adopted2026 }))
        const shown = [
          ...ch.filter((d) => d.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
          ...ch.filter((d) => d.change < 0).sort((a, b) => b.change - a.change).slice(-5),
        ]
        const movers = numbered(shown).map((d, i) => ({ id: d.id, name: d.shortName ?? d.name, fullName: d.name, change: shown[i].change, adopted2026: d.adopted2026, proposed2027: d.proposed2027, n: d.n }))
        return <Card title="Largest proposed changes, 2026 adopted to 2027 proposed" sources={src}><div className="mt-3"><Movers movers={movers} /></div></Card>
      }
      const depts = numbered(rows)
      return <Card title="Department budgets, four stages" sources={src}><DeptSnapshot rows={depts} /></Card>
    },
  }, [])

  useRenderTool({ name: 'calculate', parameters: z.object({}).passthrough(), render: () => null }, [])
  return null
}
