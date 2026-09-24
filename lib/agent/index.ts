// The budgetGuide agent (docs/03), embedded in this Next.js process and bridged to CopilotKit by
// app/api/copilotkit. The Mastra record key `budgetGuide` is the agent name the chat provider uses.
import { Agent } from '@mastra/core/agent'
import { Mastra } from '@mastra/core'

import { systemPrompt } from './system-prompt'
import {
  calculate, estimateCityCharges, getBudgetFacts, getBudgetOverview, getBudgetSections, getCityFees, getDepartmentBreakdown, getDepartments,
  getHearingCalendar, getPerformanceMeasures, getPositionChanges, getRevenues, lookupGlossary, searchBudgetLines, searchBudgetText,
} from './tools'

// What each tool is called in the prompt's plain words (system-prompt.ts speaks of "the budget-facts
// tool", "the glossary tool" and so on).
const TOOLS = `<tools>
- Headline totals, levy and tax rate: getBudgetOverview. Departments and their four stages: getDepartments. What a department spends on (salaries, benefits, positions): getDepartmentBreakdown.
- Budget sections, the levy and tax-rate split ("where my property tax goes"), capital budget, debt, Water Works: getBudgetSections. Revenue by fund, reserves withdrawal, parking and streetcar revenue, requested vs proposed total: getRevenues. How much the Mayor cut from department requests overall: getRevenues with fund "general" (total requested vs proposed). Household fees: getCityFees. A personal estimate from an assessed value: estimateCityCharges.
- Position changes and their reasons (vacancies, layoffs, 911, grants): getPositionChanges. Performance measures: getPerformanceMeasures. Line items such as overtime, consultants or an account number: searchBudgetLines.
- The budget-facts tool: getBudgetFacts. The glossary tool: lookupGlossary. The text-search tool: searchBudgetText. The calendar tool: getHearingCalendar. Arithmetic: calculate.
- Prefer a lookup that returns the figure over searchBudgetText; use text search for "why" questions, programs, capital projects and new buildings, streets and state law. Try it before saying the documents don't cover something.
- Never name these tools, mention "tools", or call anything a preview in your answer. If a lookup finds nothing, say the budget documents don't appear to cover it and suggest where to ask.
</tools>

<this_site>
Milwaukee Budget Decoder is an independent guide by Tarik Moody, not an official City of Milwaukee website. Its figures were read from the two budget PDFs into a database, checked against the budget's own totals and twenty figures read by hand, and reviewed by a person; the How it works page explains the method and the City Receipt math. For questions about how the figures were checked, say so and point to How it works.
</this_site>`

export const CHAT_MODEL = 'anthropic/claude-sonnet-5'

/** The budget guide on a given model; the eval runner compares models with everything else equal. */
export const createBudgetGuide = (model: string = CHAT_MODEL) => new Agent({
  id: 'budgetGuide',
  name: 'Milwaukee Budget Decoder',
  // Marked for Anthropic prompt caching: the tool list and this prompt (~6,500 tokens) are the same on
  // every call, so repeat calls within 5 minutes read them at a tenth of the input price.
  instructions: {
    role: 'system',
    content: `${systemPrompt('tool-render')}\n\n${TOOLS}`,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  },
  model,
  // Per-question ceiling (D20 guardrails): at most 5 rounds of lookups plus the final answer, and
  // about 1,200 words out per model call, so no single question can run up the bill.
  defaultOptions: { maxSteps: 6, modelSettings: { maxOutputTokens: 1600 } },
  tools: {
    getBudgetOverview, getDepartments, getDepartmentBreakdown, getBudgetSections, getRevenues, getCityFees, estimateCityCharges,
    getPositionChanges, getPerformanceMeasures, searchBudgetLines, searchBudgetText, getBudgetFacts, lookupGlossary, getHearingCalendar, calculate,
  },
})

export const mastra = new Mastra({ agents: { budgetGuide: createBudgetGuide() } })
