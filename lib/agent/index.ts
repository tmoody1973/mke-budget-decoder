// The budgetGuide agent (docs/03), embedded in this Next.js process and bridged to CopilotKit by
// app/api/copilotkit. The Mastra record key `budgetGuide` is the agent name the chat provider uses.
import { Agent } from '@mastra/core/agent'
import { Mastra } from '@mastra/core'

import { systemPrompt } from './system-prompt'
import { calculate, getBudgetFacts, getBudgetOverview, getDepartmentBreakdown, getDepartments, getHearingCalendar, lookupGlossary, searchBudgetText } from './tools'

// What each tool is called in the prompt's plain words (system-prompt.ts speaks of "the budget-facts
// tool", "the glossary tool" and so on).
const TOOLS = `<tools>
- Headline totals, levy and tax rate: getBudgetOverview. Departments and their four stages: getDepartments. What a department spends on (salaries, benefits, positions): getDepartmentBreakdown.
- The budget-facts tool: getBudgetFacts. The glossary tool: lookupGlossary. The text-search tool: searchBudgetText. The calendar tool: getHearingCalendar. Arithmetic: calculate.
- For "why" questions, programs, capital projects, new buildings, streets, parking or state law, call searchBudgetText (and getBudgetFacts) before saying the documents don't cover something.
- Never name these tools, mention "tools", or call anything a preview in your answer. If a lookup finds nothing, say the budget documents don't appear to cover it and suggest where to ask.
</tools>`

const budgetGuide = new Agent({
  id: 'budgetGuide',
  name: 'Milwaukee Budget Decoder',
  // Marked for Anthropic prompt caching: the tool list and this prompt (~6,500 tokens) are the same on
  // every call, so repeat calls within 5 minutes read them at a tenth of the input price.
  instructions: {
    role: 'system',
    content: `${systemPrompt('tool-render')}\n\n${TOOLS}`,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  },
  model: 'anthropic/claude-sonnet-5',
  // Per-question ceiling (D20 guardrails): at most 5 rounds of lookups plus the final answer, and
  // about 1,200 words out per model call, so no single question can run up the bill.
  defaultOptions: { maxSteps: 6, modelSettings: { maxOutputTokens: 1600 } },
  tools: { getBudgetOverview, getDepartments, getDepartmentBreakdown, searchBudgetText, getBudgetFacts, lookupGlossary, getHearingCalendar, calculate },
})

export const mastra = new Mastra({ agents: { budgetGuide } })
