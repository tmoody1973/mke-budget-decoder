// Agent tools (docs/03 §3): thin wrappers around lib/db. Every figure the chat shows comes from one
// of these results, with its citation; the model never types a number it did not get from here.
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import { EVENTS } from '@/lib/civic/events'
import { findBudgetFacts, getDepartmentBreakdown as breakdown, lookupGlossary as glossary } from '@/lib/db/chat'
import { getBudgetFact, getDepartmentTotals, getHeadline } from '@/lib/db/overview'
import { searchBudgetText as search } from '@/lib/db/search'

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

export const getDepartmentBreakdown = createTool({
  id: 'getDepartmentBreakdown',
  description:
    'What one department spends its money on, from its Summary table: salaries and wages, fringe benefits, operating costs, equipment, special funds, total, budgeted positions and full-time equivalents, and the revenue it brings in, each for 2025 actual, 2026 adopted, 2027 requested and 2027 proposed. Use the department slug from getDepartments (for example "police"). Renders as a cited table.',
  inputSchema: z.object({ slug: z.string().describe('Department slug, e.g. "police", "fire", "library", "dpw-operations"') }),
  execute: async ({ slug }) => (await breakdown(getDb(), BUDGET_VERSION, slug)) ?? { error: `No department with slug "${slug}". Call getDepartments to see the slugs.` },
})

export const searchBudgetText = createTool({
  id: 'searchBudgetText',
  description:
    'Search the budget\'s own words (the Proposed Plan and Executive Budget Summary) for passages that explain something: why a budget changed, what a program does, capital projects and new facilities, state law such as Act 12, reserves, the budget gap, parking, streets. Returns up to 5 passages with their pages. Use their wording and figures only as written; they render as a cited source list.',
  inputSchema: z.object({ query: z.string().min(3).describe('The question or topic in plain words') }),
  execute: async ({ query }) => ({ passages: await search(getDb(), BUDGET_VERSION, query) }),
})

export const getBudgetFacts = createTool({
  id: 'getBudgetFacts',
  description:
    'Human-reviewed facts from the budget on topics people ask about: Act 12 (the sales tax, school resource officers), police recruit classes, State Shared Revenue, the Tax Stabilization Fund withdrawal, cuts from department requests, the Expenditure Restraint program, the resident survey, the legal deadlines. Prefer these over searchBudgetText when one matches. Render as cited quotes.',
  inputSchema: z.object({ query: z.string().min(2).describe('Topic words, e.g. "Act 12 police"') }),
  execute: async ({ query }) => ({ facts: await findBudgetFacts(getDb(), BUDGET_VERSION, query) }),
})

export const lookupGlossary = createTool({
  id: 'lookupGlossary',
  description: 'Plain-language definition of a budget term (levy, fringe benefits, special purpose accounts, FTE and others). Use it before defining a term yourself. Renders as a cited definition.',
  inputSchema: z.object({ term: z.string().min(2) }),
  execute: async ({ term }) => ({ entries: await glossary(getDb(), BUDGET_VERSION, term) }),
})

export const getHearingCalendar = createTool({
  id: 'getHearingCalendar',
  description: 'The Common Council\'s 2027 budget schedule: department presentations, the public hearing, the Finance and Personnel Committee input hearing, amendments and the adoption vote, with dates, places and how to take part; plus the legal deadlines from the budget. Renders as a dated list.',
  inputSchema: z.object({}),
  execute: async () => {
    const deadlines = await getBudgetFact(getDb(), BUDGET_VERSION, 'legal-deadlines')
    return { events: EVENTS, deadlines: { statement: deadlines.statement, cite: deadlines.cite } }
  },
})
