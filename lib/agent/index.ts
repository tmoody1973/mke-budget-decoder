// The budgetGuide agent (docs/03), embedded in this Next.js process and bridged to CopilotKit by
// app/api/copilotkit. The Mastra record key `budgetGuide` is the agent name the chat provider uses.
import { Agent } from '@mastra/core/agent'
import { Mastra } from '@mastra/core'

import { systemPrompt } from './system-prompt'
import { calculate, getBudgetOverview, getDepartments } from './tools'

// ponytail: P3.0 spike has 3 tools; the prompt names more (facts, glossary, search, calendar, scope picker).
// Drop this note as each one is built.
const SPIKE_TOOLS = `<available_tools>
This build has only getBudgetOverview, getDepartments and calculate. The budget-facts, glossary, text-search and calendar tools and the scope picker are not built yet: if a question needs one, say that part is not available in this preview and answer what you can. For hearings and deadlines, point to the "Have your say" section on the Overview page.
</available_tools>`

const budgetGuide = new Agent({
  id: 'budgetGuide',
  name: 'Milwaukee Budget Decoder',
  instructions: `${systemPrompt('tool-render')}\n\n${SPIKE_TOOLS}`,
  model: 'anthropic/claude-sonnet-5',
  tools: { getBudgetOverview, getDepartments, calculate },
})

export const mastra = new Mastra({ agents: { budgetGuide } })
