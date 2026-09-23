// Agent tools (docs/03 §3): thin wrappers around lib/db. Every figure the chat shows comes from one
// of these results, with its citation; the model never types a number it did not get from here.
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import { getDepartmentTotals, getHeadline } from '@/lib/db/overview'

export const getBudgetOverview = createTool({
  id: 'getBudgetOverview',
  description:
    'The headline numbers of the 2027 proposed budget with their 2026 adopted comparison: all city funds, general city purposes, the city property tax levy, and the tax rate per $1,000 of assessed value. Each figure carries its source page. Renders as a box score.',
  inputSchema: z.object({}),
  execute: async () => getHeadline(getDb(), BUDGET_VERSION),
})

export const getDepartments = createTool({
  id: 'getDepartments',
  description:
    'General city purposes departments with four stages each: 2025 actual, 2026 adopted, 2027 requested (what the department asked for) and 2027 proposed (the Mayor). Pass slugs to show only some departments (for example ["fire", "police"]); call with no slugs first if you do not know the slug. Each row carries its source page. Renders as a table or a chart of changes.',
  inputSchema: z.object({
    slugs: z.array(z.string()).optional().describe('Department slugs to include; omit for all departments'),
    view: z.enum(['stages', 'changes']).default('stages')
      .describe('"stages": asked-for versus proposed table; "changes": the largest proposed increases and decreases from 2026'),
  }),
  execute: async ({ slugs }) => {
    const all = await getDepartmentTotals(getDb(), BUDGET_VERSION)
    const rows = slugs?.length ? all.filter((d) => slugs.includes(d.slug)) : all
    return { rows, known: slugs?.length ? all.map((d) => ({ slug: d.slug, name: d.name })) : undefined }
  },
})

const OPS = {
  difference: (a: number, b: number) => b - a,
  percent_change: (a: number, b: number) => ((b - a) / a) * 100,
  share: (a: number, b: number) => (a / b) * 100,
  per: (a: number, b: number) => a / b,
} as const

export const calculate = createTool({
  id: 'calculate',
  description:
    'Exact arithmetic on figures copied from other tool results. difference = b - a; percent_change = (b - a) / a * 100; share = a / b * 100 (a as a percent of b); per = a / b. Use it for every change, percent or share you mention.',
  inputSchema: z.object({ op: z.enum(['difference', 'percent_change', 'share', 'per']), a: z.number(), b: z.number() }),
  execute: async ({ op, a, b }) => {
    if ((op === 'percent_change' && a === 0) || ((op === 'share' || op === 'per') && b === 0)) return { error: 'division by zero' }
    return { op, a, b, result: Number(OPS[op](a, b).toFixed(op === 'difference' ? 2 : 4)) }
  },
})
