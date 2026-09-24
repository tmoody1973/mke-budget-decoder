'use client'
// Chat cards for the table-shaped lookups: budget sections, revenues, fees, a receipt estimate,
// position changes, performance measures and line items. One ruled table (ChatTable) draws them all;
// every row carries a source mark for its own page.
import { useRenderTool } from '@copilotkit/react-core/v2'
import { z } from 'zod'

import { Mark, sourceRegistry, Tail } from '@/components/genui/sources'
import { ReceiptTable } from '@/components/receipt/receipt-table'
import type { Cite } from '@/lib/db/schema'
import { bigDollars, millions } from '@/lib/format'
import type { Receipt } from '@/lib/receipt'

import { Card, type CardFact, Failed, FactsList, Pending, parse } from './tool-renderers'

type Row = { key: string; label: string; cells: (string | null)[]; cite: Cite; strong?: boolean }

/** A compact ruled table for chat: a label column and right-aligned figure columns. */
function ChatTable({ head, rows, unit }: { head: string[]; rows: Row[]; unit?: string }) {
  const src = sourceRegistry()
  const marked = rows.map((r) => ({ ...r, n: src.mark(r.cite, { id: r.key, label: r.label }) }))
  return { src, table: (
    <div className="@container overflow-x-auto">
      {unit && <p className="mt-2 text-right text-xs text-ink-soft">{unit}</p>}
      <table className="tabular mt-1 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-ink text-left text-xs font-semibold uppercase text-ink">
            {head.map((h, i) => <th key={h} scope="col" className={`py-2 ${i === 0 ? 'pr-2' : 'pl-2 text-right'}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {marked.map((r) => (
            <tr key={r.key} className={`align-top ${r.strong ? 'border-y-2 border-ink font-semibold' : 'border-b border-rule'}`}>
              <th scope="row" className="py-2 pr-2 text-left font-normal"><Tail label={r.label}><Mark n={r.n} /></Tail></th>
              {r.cells.map((c, i) => <td key={i} className="py-2 pl-2 text-right">{c ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) }
}

const m = (v: number | null) => (v === null ? null : millions(v))

export function DataRenderers() {
  useRenderTool({
    name: 'getBudgetSections', parameters: z.object({}),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="the budget sections" />
      const got = parse<{ facts?: CardFact[]; sections: { section: string; label: string; cite: Cite; budget2026: number | null; budget2027: number | null; levy2027: number | null; rate2026: number | null; rate2027: number | null }[] }>(result)
      const secs = got?.sections
      if (!secs?.length) return <Failed />
      const { src, table } = ChatTable({ head: ['Section', '2026 budget', '2027 budget', '2027 levy', 'Rate / $1,000'], unit: 'Millions of dollars; rate in dollars',
        rows: secs.map((x) => ({ key: `sec-${x.section}`, label: x.section === 'TOTAL' ? 'All sections' : `${x.section}. ${x.label}`, cite: x.cite, strong: x.section === 'TOTAL',
          cells: [m(x.budget2026), m(x.budget2027), x.levy2027 ? m(x.levy2027) : null, x.rate2027 ? `$${x.rate2027.toFixed(2)}` : null] })) })
      return <Card title="Budget sections: spending, property tax levy and tax rate" sources={src}>{table}<FactsList facts={got?.facts} src={src} /></Card>
    },
  }, [])

  useRenderTool({
    name: 'getRevenues', parameters: z.object({ fund: z.string() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="revenue" />
      const d = parse<{ fund: string; facts?: CardFact[]; rows: { line: string; isTotal: boolean; adopted2026: number | null; requested2027: number | null; proposed2027: number | null; cite: Cite }[] }>(result)
      if (!d?.rows?.length) return <Failed />
      const { src, table } = ChatTable({ head: ['Revenue', '2026 adopted', '2027 requested', '2027 proposed'], unit: 'Millions of dollars',
        rows: d.rows.map((r, i) => ({ key: `rev-${i}`, label: r.line, cite: r.cite, strong: r.isTotal, cells: [m(r.adopted2026), m(r.requested2027), m(r.proposed2027)] })) })
      return <Card title={`Revenue: ${d.fund.replace(/-/g, ' ')}`} sources={src}>{table}<FactsList facts={d.facts} src={src} /></Card>
    },
  }, [])

  useRenderTool({
    name: 'getCityFees', parameters: z.object({}),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="city fees" />
      const fees = parse<{ fees: Record<string, { v2026: string; v2027: string; cite: Cite }> }>(result)?.fees
      if (!fees) return <Failed />
      const LABEL: Record<string, string> = { solid_waste: 'Garbage, per home a year', extra_cart: 'Extra garbage cart, a year', snow_ice: 'Snow and ice, per foot of frontage',
        street_lighting: 'Street lighting, per foot of frontage', sewer_stormwater_avg: 'Sewer and stormwater, average home a year' }
      const { src, table } = ChatTable({ head: ['Fee', '2026', '2027 proposed'],
        rows: Object.entries(fees).map(([k, f]) => ({ key: `fee-${k}`, label: LABEL[k] ?? k, cite: f.cite, cells: [`$${f.v2026}`, `$${f.v2027}`] })) })
      return <Card title="City fees for a household" sources={src}>{table}</Card>
    },
  }, [])

  useRenderTool({
    name: 'estimateCityCharges', parameters: z.object({ assessed2026: z.number(), assessed2025: z.number().optional(), units: z.number().optional(), view: z.string().optional() }),
    render: ({ status, parameters, result }) => {
      if (status !== 'complete') return <Pending what="the city charges" />
      const r = parse<{ receipt?: Receipt }>(result)?.receipt
      if (!r || r.kind !== 'estimate') return <Failed />
      return (
        <div data-src-scope className="my-3 text-sm">
          <ReceiptTable receipt={r} parcel={null} entered={{ assessed2026: parameters.assessed2026, assessed2025: parameters.assessed2025 }} />
        </div>
      )
    },
  }, [])

  useRenderTool({
    name: 'getPositionChanges', parameters: z.object({ slug: z.string() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="position changes" />
      const d = parse<{ totalPositions: { adopted2026: number | null; proposed2027: number | null; cite: Cite } | null; changes: { positions: string; title: string; reason: string | null; cite: Cite }[] }>(result)
      if (!d?.changes?.length) return <p className="my-2 text-sm text-ink-soft">The budget lists no position changes for this department.</p>
      const signed = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      const t = d.totalPositions
      const { src, table } = ChatTable({ head: ['Position', 'Change', 'Reason given'],
        rows: [
          ...(t && t.adopted2026 !== null && t.proposed2027 !== null ? [{ key: 'pos-total', label: `All budgeted positions: ${t.adopted2026.toLocaleString('en-US')} adopted for 2026 → ${t.proposed2027.toLocaleString('en-US')} proposed`, cite: t.cite, strong: true, cells: [signed(t.proposed2027 - t.adopted2026), null] }] : []),
          ...d.changes.map((c, i) => ({ key: `pos-${i}`, label: c.title, cite: c.cite, cells: [signed(Number(c.positions)), c.reason || '—'] })),
        ] })
      return <Card title="Position changes, with the budget’s reasons" sources={src}>{table}</Card>
    },
  }, [])

  useRenderTool({
    name: 'getPerformanceMeasures', parameters: z.object({ slug: z.string() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="performance measures" />
      const d = parse<{ measures: { measure: string; columns: string[]; values: (string | number)[]; cite: Cite }[] }>(result)
      if (!d?.measures?.length) return <p className="my-2 text-sm text-ink-soft">The budget lists no performance measures for this department.</p>
      const { src, table } = ChatTable({ head: ['Measure', ...(d.measures[0].columns ?? [])],
        rows: d.measures.map((x, i) => ({ key: `kpi-${i}`, label: x.measure, cite: x.cite, cells: (x.values ?? []).map((v) => (v === null ? null : String(v))) })) })
      return <Card title="Performance measures, as printed" sources={src}>{table}</Card>
    },
  }, [])

  useRenderTool({
    name: 'getCapitalProjects', parameters: z.object({ slug: z.string().optional(), query: z.string().optional() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="capital projects" />
      const d = parse<{ facts?: CardFact[]; projects: { name: string; dept: string | null; amount: number | null; amountText: string | null; note: string | null; cite: Cite }[] }>(result)
      if (!d?.projects?.length) return <p className="my-2 text-sm text-ink-soft">No capital projects matched.</p>
      const { src, table } = ChatTable({ head: ['Project', 'Department', '2027'],
        rows: d.projects.map((p, i) => ({ key: `cap-${i}`, label: p.name, cite: p.cite,
          cells: [p.dept, p.amount === null ? (p.amountText ? `“${p.amountText}” (as printed)` : '—') : bigDollars(p.amount)] })) })
      const notes = d.projects.filter((p) => p.note)
      return (
        <Card title="Capital projects in the 2027 proposal" sources={src}>
          {table}
          {notes.map((p) => <p key={p.name} className="mt-2 text-sm text-ink-soft">{p.name}: {p.note}</p>)}
          <FactsList facts={d.facts} src={src} />
        </Card>
      )
    },
  }, [])

  useRenderTool({
    name: 'searchBudgetLines', parameters: z.object({ query: z.string(), slug: z.string().optional() }),
    render: ({ status, result }) => {
      if (status !== 'complete') return <Pending what="line items" />
      const d = parse<{ query: string; byDepartment: boolean; lines: { dept: string; description?: string; lineCount?: number; adopted2026: number | null; requested2027: number | null; proposed2027: number | null; cite: Cite }[] }>(result)
      if (!d?.lines?.length) return <p className="my-2 text-sm text-ink-soft">No line items matched.</p>
      const total = d.lines.reduce((a, l) => a + (l.proposed2027 ?? 0), 0)
      const { src, table } = ChatTable({ head: [d.byDepartment ? 'Department' : 'Line item', '2026 adopted', '2027 requested', '2027 proposed'], unit: 'Millions of dollars',
        rows: d.lines.map((l, i) => ({ key: `li-${i}`, label: d.byDepartment ? `${l.dept} (${l.lineCount} lines)` : (l.description ?? ''), cite: l.cite,
          cells: [m(l.adopted2026), m(l.requested2027), m(l.proposed2027)] })) })
      return (
        <Card title={`Detailed budget lines matching “${d.query}”`} sources={src}>
          {table}
          <p className="tabular mt-2 text-sm">{bigDollars(total)} proposed in these lines. Scope: department line items in the Detailed budget.</p>
        </Card>
      )
    },
  }, [])

  return null
}
