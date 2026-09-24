// Agent tools (docs/03 §3): thin wrappers around lib/db. Every figure the chat shows comes from one
// of these results, with its citation; the model never types a number it did not get from here.
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import { EVENTS } from '@/lib/civic/events'
import {
  findBudgetFacts, getBudgetSections as sections, getCapitalProjects as capital, getDepartmentBreakdown as breakdown, getPerformanceMeasures as measures,
  getPositionChanges as positions, getRevenues as revenues, lookupGlossary as glossary, searchBudgetLines as lines,
} from '@/lib/db/chat'
import { getReceiptRates } from '@/lib/db/receipt'
import { receiptFromBody } from '@/lib/receipt-request'
import { getBudgetFact, getDepartmentTotals, getHeadline } from '@/lib/db/overview'
import { searchBudgetText as search } from '@/lib/db/search'

/** Reviewed facts that match `words`, attached to a table lookup so the answer can quote them with
 *  their page even when the model doesn't ask for facts separately. */
const factsFor = (words: string) => findBudgetFacts(getDb(), BUDGET_VERSION, words, 3)

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
    'General city purposes departments with four stages each: 2025 actual, 2026 adopted, 2027 requested (what the department asked for) and 2027 proposed (the Mayor). Pass slugs to show only some departments (for example ["fire", "police"]); call with no slugs first if you do not know the slug. Each row carries its source page and the changes printed beside it: changeFromAdopted (proposed minus 2026 adopted), changeFromRequest (proposed minus what the department asked for; negative means the Mayor proposed less) and percentChangeFromAdopted. Quote these instead of calculating them. Renders as a table or a chart of changes.',
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
    'Exact arithmetic on figures copied from other tool results, for anything a lookup does not already give (department and line changes come with the lookups). difference = b - a; percent_change = (b - a) / a * 100; share = a / b * 100 (a as a percent of b); per = a / b. Use it for every change, percent or share you mention.',
  inputSchema: z.object({ op: z.enum(['difference', 'percent_change', 'share', 'per']), a: z.number(), b: z.number() }),
  execute: async ({ op, a, b }) => {
    if ((op === 'percent_change' && a === 0) || ((op === 'share' || op === 'per') && b === 0)) return { error: 'division by zero' }
    return { op, a, b, result: Number(OPS[op](a, b).toFixed(op === 'difference' ? 2 : 4)) }
  },
})

export const getDepartmentBreakdown = createTool({
  id: 'getDepartmentBreakdown',
  description:
    'What one department spends its money on, from its Summary table: salaries and wages, fringe benefits, operating costs, equipment, special funds, total, budgeted positions and full-time equivalents, and the revenue it brings in, each for 2025 actual, 2026 adopted, 2027 requested and 2027 proposed, with changeFromAdopted, changeFromRequest and percentChangeFromAdopted as printed. Use the department slug from getDepartments (for example "police"). Renders as a cited table.',
  inputSchema: z.object({ slug: z.string().describe('Department slug, e.g. "police", "fire", "library", "dpw-operations"') }),
  execute: async ({ slug }) => {
    const b = await breakdown(getDb(), BUDGET_VERSION, slug)
    if (!b) return { error: `No department with slug "${slug}". Call getDepartments to see the slugs.` }
    return { ...b, facts: await factsFor(b.name.replace(/Department( of)?|Division|-/g, ' ')) }
  },
})

export const searchBudgetText = createTool({
  id: 'searchBudgetText',
  description:
    'Search the budget\'s own words (the Proposed Plan and Executive Budget Summary) for passages that explain something: why a budget changed, what a program does, capital projects and new facilities, state law such as Act 12, reserves, the budget gap, parking, streets. Returns up to 5 passages with their pages. Use their wording and figures only as written; they render as a cited source list.',
  inputSchema: z.object({ query: z.string().min(3).describe('The question or topic in plain words') }),
  execute: async ({ query }) => {
    const [passages, facts] = await Promise.all([search(getDb(), BUDGET_VERSION, query), factsFor(query)])
    return { facts, passages }
  },
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

export const getBudgetSections = createTool({
  id: 'getBudgetSections',
  description:
    'Every budget section for 2026 adopted and 2027 proposed (Summary p.7): general city purposes, pensions, capital improvements, city debt (borrowing costs), contingent fund, Transportation Fund, grants, Water Works, sewer and others, with each section\'s property tax levy and its share of the tax rate per $1,000 of assessed value. Use it for "where does my property tax go", levy splits, capital budget and debt totals, and Water Works. Renders as a cited table.',
  inputSchema: z.object({}),
  execute: async () => ({ sections: await sections(getDb(), BUDGET_VERSION), facts: await factsFor('borrowing surge capital facility debt') }),
})

export const getRevenues = createTool({
  id: 'getRevenues',
  description:
    'Revenue by fund, four stages (2026 adopted, 2027 requested, 2027 proposed): "general" = general city purposes sources, their total (requested vs proposed) and the Tax Stabilization Fund withdrawal (reserves); "transportation-fund" = parking citations, permits, meters, towing, streetcar, scooters (p.190); "sewer-maintenance-fund"; "employee-retirement". Renders as a cited table.',
  inputSchema: z.object({ fund: z.enum(['general', 'transportation-fund', 'sewer-maintenance-fund', 'employee-retirement']) }),
  execute: async ({ fund }) => ({ fund, rows: await revenues(getDb(), BUDGET_VERSION, fund),
    facts: fund === 'general' ? await factsFor('reserves withdrawal stabilization amortization requested cut') : await factsFor(fund.replace(/-/g, ' ')) }),
})

export const getCityFees = createTool({
  id: 'getCityFees',
  description: 'City fees a household pays, 2026 and 2027 proposed: solid waste (garbage) per home, extra garbage cart, snow and ice and street lighting per foot of frontage, average household sewer and stormwater (p.159, 203). Renders as a cited table.',
  inputSchema: z.object({}),
  execute: async () => ({ fees: (await getReceiptRates(getDb(), BUDGET_VERSION)).fees }),
})

export const estimateCityCharges = createTool({
  id: 'estimateCityCharges',
  description:
    'Estimate what the city charges one home under the 2026 budget and the 2027 proposal from an assessed value the person gives (the same math as Your City Receipt): city property tax, garbage, snow and ice, street lighting (40 ft frontage assumed), sewer and stormwater, and where the property tax goes. view "renter" gives one unit\'s share of the building, paid by the owner. For an address lookup, point the person to Your City Receipt. Renders as a cited receipt.',
  inputSchema: z.object({
    assessed2026: z.number().int().positive().describe('2026 assessed value in whole dollars'),
    assessed2025: z.number().int().positive().optional().describe('2025 assessed value, if the person gave it'),
    units: z.number().int().min(1).max(999).default(1).describe('Homes in the building'),
    view: z.enum(['owner', 'renter']).default('owner'),
  }),
  execute: async ({ assessed2026, assessed2025, units, view }) => {
    const r = await receiptFromBody({ assessed2026, assessed2025, units, buildingUnits: units, view })
    return 'error' in r ? { error: r.error } : { receipt: r.receipt }
  },
})

export const getPositionChanges = createTool({
  id: 'getPositionChanges',
  description: 'A department\'s position changes as its Summary page lists them: title, number of positions added or eliminated, and the document\'s own reason (for example "Elimination of funded vacant positions"). Use it for layoffs, vacancies, 911 dispatchers, grant-funded or ARPA positions. Quote reasons exactly; never call an elimination a layoff unless the reason says so. Renders as a cited table.',
  inputSchema: z.object({ slug: z.string().describe('Department slug, e.g. "emergency-communications", "police"') }),
  execute: async ({ slug }) => {
    const [changes, b] = await Promise.all([positions(getDb(), BUDGET_VERSION, slug), breakdown(getDb(), BUDGET_VERSION, slug)])
    const total = b?.rows.find((r) => r.metric === 'positions')
    return { slug, totalPositions: total ? { adopted2026: total.adopted2026, proposed2027: total.proposed2027, cite: b!.cite } : null, changes }
  },
})

export const getPerformanceMeasures = createTool({
  id: 'getPerformanceMeasures',
  description: 'A department\'s performance measures exactly as printed, with their column labels (usually 2025 actual, 2026 projected, 2027 planned). Do not call a change better or worse unless the document does. Renders as a cited table.',
  inputSchema: z.object({ slug: z.string() }),
  execute: async ({ slug }) => ({ slug, measures: await measures(getDb(), BUDGET_VERSION, slug) }),
})

export const searchBudgetLines = createTool({
  id: 'searchBudgetLines',
  description:
    'Detailed budget line items (the line-by-line books): search by words in the line description ("overtime", "professional services", "information technology", "consultant") or by an account number ("634000"). Without a department it totals the matching lines by department. Every line and total carries changeFromAdopted and changeFromRequest; quote those. Scope: the Detailed budget\'s department line items. Renders as a cited table.',
  inputSchema: z.object({ query: z.string().min(3), slug: z.string().optional().describe('Limit to one department') }),
  execute: async ({ query, slug }) => ({ query, ...(await lines(getDb(), BUDGET_VERSION, query, slug)) }),
})

export const getCapitalProjects = createTool({
  id: 'getCapitalProjects',
  description:
    'Capital projects the department pages describe, with amounts: new buildings (Midtown library, facilities), IT systems, police vehicles, water mains, sewers, trees, port, blight programs. Filter by department slug or words ("library", "water", "police"). Totals of these are department capital items, not the whole capital budget (use getBudgetSections for that). Renders as a cited table.',
  inputSchema: z.object({ slug: z.string().optional(), query: z.string().optional().describe('Words to match in the project, its description or its department') }),
  execute: async ({ slug, query }) => ({ projects: await capital(getDb(), BUDGET_VERSION, { slug, query }), facts: query ? await factsFor(query) : [] }),
})
