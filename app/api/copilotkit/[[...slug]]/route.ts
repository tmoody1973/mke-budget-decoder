// CopilotKit runtime (AG-UI) for the chat panel. The Mastra agent runs in this process
// (MastraAgent.getLocalAgents, docs.copilotkit.ai/mastra/copilot-runtime#local-agents).
import { MastraAgent } from '@ag-ui/mastra'
import { after } from 'next/server'
import { CopilotRuntime, createCopilotRuntimeHandler, InMemoryAgentRunner } from '@copilotkit/runtime/v2'

import { mastra } from '@/lib/agent'
import { getDb } from '@/lib/db/client'
import { takeQuestion } from '@/lib/db/chat-usage'
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

// Daily cap on paid questions for the whole site (D20, D21). Measured 2.6 cents a question on Claude
// Sonnet 5 with caching, so 55 a day keeps a full month under ~$45. Override with CHAT_DAILY_LIMIT.
const dailyLimit = () => Number(process.env.CHAT_DAILY_LIMIT ?? 55)
const LIMIT_TEXT = 'I’ve answered all the questions I can for today, so I’m resting until tomorrow. Everything else on this site works without me: the charts and tables, every source page, and Your City Receipt.'

const MAX_QUESTION_CHARS = 500
const TOO_LONG_TEXT = `That’s a long message. Please ask your budget question in ${MAX_QUESTION_CHARS} characters or fewer, and I’ll look it up.`

type RunBody = { threadId?: string; runId?: string; messages?: { role?: string; content?: unknown }[] }
const lastQuestion = (b: RunBody) => {
  const m = [...(b.messages ?? [])].reverse().find((x) => x.role === 'user')
  return typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')
}

/** Answers with an ordinary assistant message in the AG-UI stream format, so it shows in the
 *  conversation like any reply (CopilotKit drops an error response without telling the visitor). */
function reply(body: RunBody, text: string) {
  const threadId = body.threadId ?? crypto.randomUUID(), runId = body.runId ?? crypto.randomUUID(), messageId = crypto.randomUUID()
  const events = [
    { type: 'RUN_STARTED', threadId, runId },
    { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: text },
    { type: 'TEXT_MESSAGE_END', messageId },
    { type: 'RUN_FINISHED', threadId, runId },
  ]
  return new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
  })
}

export const GET = (req: Request) => (off() ? notFound() : handler(req))

export async function POST(req: Request) {
  if (off()) return notFound()
  // Each chat turn is a paid model call: 10 per minute per visitor.
  if (!allow(`chat:${clientKey(req)}`, 10, 60_000)) return Response.json({ error: 'Too many questions. Try again in a minute.' }, { status: 429 })
  // Only a new question (POST …/agent/:id/run) counts toward the day; other calls are free.
  if (new URL(req.url).pathname.endsWith('/run')) {
    const body = (await req.clone().json().catch(() => ({}))) as RunBody
    if (lastQuestion(body).length > MAX_QUESTION_CHARS) return reply(body, TOO_LONG_TEXT) // not counted
    const ok = await takeQuestion(getDb(), dailyLimit()).catch(() => true) // a counter failure shouldn't block answers
    if (!ok) return reply(body, LIMIT_TEXT)
    // Serverless functions pause after responding; send this answer's trace first (Mastra docs).
    after(() => mastra.observability?.flush())
  }
  return handler(req)
}
