// CopilotKit runtime (AG-UI) for the chat on /ask. The Mastra agent runs in this process
// (MastraAgent.getLocalAgents, docs.copilotkit.ai/mastra/copilot-runtime#local-agents).
import { MastraAgent } from '@ag-ui/mastra'
import { CopilotRuntime, createCopilotRuntimeHandler, InMemoryAgentRunner } from '@copilotkit/runtime/v2'

import { mastra } from '@/lib/agent'
import { allow, clientKey } from '@/lib/rate-limit'

// ponytail: no accounts in v1, so one shared memory resource; per-visitor ids when threads persist.
const runtime = new CopilotRuntime({
  agents: MastraAgent.getLocalAgents({ mastra, resourceId: 'anonymous' }),
  runner: new InMemoryAgentRunner(),
})

const handler = createCopilotRuntimeHandler({ runtime, basePath: '/api/copilotkit' })

// Off unless CHAT_ENABLED=true (D19: the chat launches after its answer check), so nobody can
// spend model calls through the endpoint while the button is hidden.
const off = () => process.env.CHAT_ENABLED !== 'true'
const notFound = () => new Response('Not found', { status: 404 })

export const GET = (req: Request) => (off() ? notFound() : handler(req))
// Each chat turn is a paid model call: 10 per minute per visitor.
export const POST = (req: Request) => off() ? notFound()
  : allow(`chat:${clientKey(req)}`, 10, 60_000) ? handler(req) : Response.json({ error: 'Too many questions. Try again in a minute.' }, { status: 429 })
