// Shared by the local answer check (evals/run.mts) and the Braintrust eval (evals/budget.eval.mts), so
// both grade the same way: required figures checked in code, required and forbidden ideas graded by a
// small model, and the cost of each answer from the agent's own token counts.
import { readFileSync } from 'node:fs'

import { parse } from 'yaml'

import { createBudgetGuide } from '@/lib/agent'

// `before`: earlier questions in the same conversation, asked first; only the answer to `q` is graded.
export type Case = { id: string; q: string; before?: string[]; expected_figures?: string[]; must_include?: string[]; must_not?: string[] }
export type Judgment = { include: { item: string; met: boolean }[]; not: { item: string; violated: boolean }[]; declined: boolean; note: string }
const JUDGE = 'claude-haiku-4-5-20251001'
export const GOLDEN_DATASET = 'Golden questions'

// $ per million tokens: input, cache write, cache read, output (Anthropic list prices and OpenRouter's
// model list, 2026-09-23). Unknown cache pricing is charged as full input, an upper bound.
export const PRICES: Record<string, { in: number; write: number; read: number; out: number }> = {
  'anthropic/claude-sonnet-5': { in: 2, write: 2.5, read: 0.2, out: 10 },
  'anthropic/claude-haiku-4-5': { in: 1, write: 1.25, read: 0.1, out: 5 },
  'openrouter/openai/gpt-5.6-luna': { in: 0.2, write: 0.2, read: 0.2, out: 1.2 },
  'openrouter/deepseek/deepseek-v4-flash': { in: 0.075, write: 0.075, read: 0.075, out: 0.15 },
  'openrouter/qwen/qwen3.8-flash': { in: 0.15, write: 0.15, read: 0.15, out: 0.47 },
}

export const loadCases = (only: string[] = []) =>
  (parse(readFileSync('evals/golden.yaml', 'utf8')) as Case[]).filter((c) => !only.length || only.some((p) => c.id.startsWith(p)))

/** Ways a figure can appear: as written, without $ and commas, as whole cents ($1,458.00 -> 145800),
 *  or, for "$143.7 million" / "$2.26 billion", any number in the text or data that rounds to it. */
function variants(fig: string): string[] {
  const out = new Set([fig.toLowerCase(), fig.replace(/[$,]/g, '').toLowerCase()])
  if (/\.\d{2}$/.test(fig)) out.add(fig.replace(/[$,.]/g, ''))
  if (/\.\d0$/.test(fig)) out.add(fig.replace(/[$,]/g, '').slice(0, -1)) // stored as 1.8 for $1.80
  if (fig.endsWith('%')) { out.add(`${parseFloat(fig).toFixed(1)}%`); out.add(`${fig.slice(0, -1)} percent`) }
  return [...out]
}
function roundsTo(hay: string, fig: string): boolean {
  const m = fig.match(/^\$?([\d.]+) (million|billion)$/i)
  if (!m) return false
  const scale = m[2].toLowerCase() === 'billion' ? 1e9 : 1e6, places = m[1].split('.')[1]?.length ?? 0
  return (hay.replace(/,/g, '').match(/\d{5,}/g) ?? []).some((d) => (Number(d) / scale).toFixed(places) === Number(m[1]).toFixed(places))
}
export const hasFigure = (hay: string, fig: string) => roundsTo(hay, fig) || variants(fig).some((v) => hay.includes(v))

export async function judge(c: Case, text: string, tools: string): Promise<Judgment> {
  try { return await judgeOnce(c, text, tools) } catch { return judgeOnce(c, text, tools) } // one retry, then the error stands
}

async function judgeOnce(c: Case, text: string, tools: string): Promise<Judgment> {
  const earlier = c.before?.length ? `Earlier questions in this conversation: ${JSON.stringify(c.before)}\n` : ''
  const prompt = `You grade an answer from a nonpartisan guide to the City of Milwaukee's 2027 proposed budget.
${earlier}Question: ${c.q}
Answer text shown to the user:
"""${text}"""
Data the answer's lookups returned (also shown to the user as cited cards; may be truncated):
"""${tools.slice(0, 6000)}"""
For each REQUIRED item, is it satisfied by the answer text or the shown data? For each FORBIDDEN item, does the answer do it?
DECLINED: does the answer say it could not find or cannot answer what was asked (rather than answering it)?
REQUIRED: ${JSON.stringify(c.must_include ?? [])}
FORBIDDEN: ${JSON.stringify(c.must_not ?? [])}
Reply with JSON only: {"include":[{"item":"...","met":true}],"not":[{"item":"...","violated":false}],"declined":false,"note":"one short sentence"}`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: JUDGE, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  })
  // A failed or partial grading throws, so the run records an error instead of a free pass.
  const body = (await res.json()) as { content?: { text: string }[] }
  const raw = body.content?.[0]?.text
  if (!res.ok || !raw) throw new Error(`judge failed (${res.status})`)
  const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Partial<Judgment>
  if ((j.include?.length ?? 0) < (c.must_include?.length ?? 0) || (j.not?.length ?? 0) < (c.must_not?.length ?? 0)) throw new Error('judge skipped criteria')
  return { include: j.include ?? [], not: j.not ?? [], declined: j.declined === true, note: j.note ?? '' }
}


// The parts of an agent run the check reads (Mastra's step shape; tool fields sit under payload in v1).
type Step = {
  toolCalls?: { toolName?: string; payload?: { toolName?: string } }[]
  toolResults?: { result?: unknown; payload?: { result?: unknown } }[]
  usage?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; cacheCreationInputTokens?: number }
}
type Run = { text: string; steps?: Step[] }

const toolDataOf = (steps: Step[]) => JSON.stringify(steps.flatMap((s) => (s.toolResults ?? []).map((t) => t.payload?.result ?? t.result)))

// Provider-neutral usage: inputTokens includes cached reads and writes on every provider.
function costOf(steps: Step[], price: (typeof PRICES)[string]) {
  let cost = 0
  for (const s of steps) {
    const u = s.usage ?? {}, read = u.cachedInputTokens ?? 0, write = u.cacheCreationInputTokens ?? 0
    cost += (((u.inputTokens ?? 0) - read - write) * price.in + write * price.write + read * price.read + (u.outputTokens ?? 0) * price.out) / 1e6
  }
  return cost
}

/** Runs one question through the agent on `model`; returns what the visitor would see plus cost. */
export async function answer(c: Case, model: string) {
  const price = PRICES[model]
  if (!price) throw new Error(`No price for ${model}; add it to PRICES`)
  const t0 = Date.now(), agent = createBudgetGuide(model)
  // Earlier turns go back in as plain text, without their lookup results: a slightly harder test than the
  // live chat, which also resends earlier tool calls. Cost counts every turn; grading sees the last.
  const history: ({ role: 'user'; content: string } | { role: 'assistant'; content: string })[] = []
  let earlierCost = 0, earlierData = ''
  for (const q of c.before ?? []) {
    const prev = (await agent.generate([...history, { role: 'user' as const, content: q }])) as unknown as Run
    earlierCost += costOf(prev.steps ?? [], price)
    earlierData += toolDataOf(prev.steps ?? [])
    history.push({ role: 'user', content: q }, { role: 'assistant', content: prev.text })
  }
  const r = (await agent.generate(history.length ? [...history, { role: 'user' as const, content: c.q }] : c.q)) as unknown as Run
  const steps = r.steps ?? []
  const tools = steps.flatMap((s) => (s.toolCalls ?? []).map((t) => t.payload?.toolName ?? t.toolName ?? ''))
  const toolData = toolDataOf(steps)
  const cost = earlierCost + costOf(steps, price)
  return { text: r.text as string, tools, toolData, earlierData, cents: +(cost * 100).toFixed(2), secs: Math.round((Date.now() - t0) / 1000) }
}

export const figuresFound = (c: Case, text: string, toolData: string) =>
  (c.expected_figures ?? []).map((f) => ({ f, found: hasFigure(`${text}\n${toolData}`.toLowerCase(), f) }))

// Dollar amounts ("$343.9 million", "$343.9M", "$1,458.00") and percentages the answer states.
const FIGURE = /\$\d+(?:,\d{3})*(?:\.\d+)?(?:\s(?:million|billion)|[MBK]\b)?|\b\d+(?:,\d{3})*(?:\.\d+)?\s(?:million|billion)\b|\d+(?:,\d{3})*(?:\.\d+)?%/g
// The tax rate's unit, in English or Spanish: "per $1,000 of assessed value", "each $1,000 of value", "por cada $1,000".
const RATE_UNIT = /(?:per|each|every|por cada)\s+\$1,000|\$1,000\s+(?:of|de)\s+(?:assessed\s+)?(?:value|valor|property)/gi
/** Figures in the answer text that appear nowhere in the lookups' data or the questions asked: the
 *  "unsourced figure" check. Numbers must come from a lookup (principle 1), so any hit is a defect, even when the arithmetic is right. */
export function unsupportedFigures(c: Case, text: string, toolData: string, earlierData = ''): string[] {
  // Values only: JSON keys ("year2026") are dropped, and numbers are read whole ("$2" is not in "$2,000").
  const hay = `${toolData}\n${earlierData}`.replace(/"[^"]*"\s*:/g, ' ') + `\n${c.q}\n${(c.before ?? []).join('\n')}`
  const clean = text.replace(RATE_UNIT, '')
  // "over $32 million" is true of $32,675,272: a bound word widens the match one step in its direction.
  const said = [...clean.matchAll(FIGURE)].map((m) => {
    const before = clean.slice(Math.max(0, m.index - 14), m.index).toLowerCase()
    const bound = /(over|more than|above)\s*$/.test(before) ? 'over' : /(nearly|almost|under|less than|below)\s*$/.test(before) ? 'under' : undefined
    return { f: m[0], bound } as const
  })
  // Prose in the data ("$218.2 million" in a reviewed fact) counts at full size, like a stored 218200000.
  const plain = hay.replace(/(\d),(?=\d{3})/g, '$1')
    .replace(/(\d+(?:\.\d+)?)\s*(million|billion)/gi, (_, n: string, u: string) => String(Number(n) * (/^b/i.test(u) ? 1e9 : 1e6)))
  const nums = (plain.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  const seen = new Set<string>()
  return said.filter(({ f, bound }) => !roundsFrom(nums, f.replace(/\s+/g, ' '), bound)).map(({ f }) => f).filter((f) => !seen.has(f) && !!seen.add(f))
}

/** Does any number in the data round to this figure at the precision it was stated? Dollars may be
 *  stored as dollars or cents; percentages as 8.9 or 0.089. */
function roundsFrom(nums: number[], fig: string, bound?: 'over' | 'under'): boolean {
  const m = fig.replace(/[$,]/g, '').match(/^([\d.]+)(%|\s(?:million|billion)|[MBK])?$/)
  // ponytail: a year like 2026 is never read as $20.26 in cents; a real 2,026-cent amount would be missed.
  if (!m) return false
  const v = Number(m[1]), places = m[1].split('.')[1]?.length ?? 0
  const unit = m[2]?.trim() ?? ''
  const scale = /^(billion|B)$/.test(unit) ? 1e9 : /^(million|M)$/.test(unit) ? 1e6 : unit === 'K' ? 1e3 : 1
  const step = 10 ** -places
  const same = (n: number) => bound === 'over' ? n >= v && n < v + step : bound === 'under' ? n <= v && n > v - step : Math.abs(n - v) <= step / 2 + 1e-9 // a tie ($7,165,000 as $7.16M) may round either way
  const isYear = (n: number) => Number.isInteger(n) && n >= 1990 && n <= 2040
  return nums.some((n) => same(n / scale) || (scale === 1 && !isYear(n) && same(n / 100)) || (m[2] === '%' && same(n * 100)))
}

export type Bucket = 'correct' | 'incomplete' | 'unsourced figure' | "couldn't answer"
/** GRASP's four outcomes (arXiv 2503.23299), with "hallucination" narrowed to what code can check: a
 *  figure no lookup returned. In priority order, an unsourced figure outranks a pass; a failed answer that said it couldn't find the thing is "couldn't answer";
 *  any other failure (a missing figure or idea, or a broken rule such as taking a side) is "incomplete". */
export function bucket(pass: boolean, madeUp: string[], declined: boolean): Bucket {
  if (madeUp.length) return 'unsourced figure'
  if (pass) return 'correct'
  return declined ? "couldn't answer" : 'incomplete'
}
