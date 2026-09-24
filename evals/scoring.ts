// Shared by the local answer check (evals/run.mts) and the Braintrust eval (evals/budget.eval.mts), so
// both grade the same way: required figures checked in code, required and forbidden ideas graded by a
// small model, and the cost of each answer from the agent's own token counts.
import { readFileSync } from 'node:fs'

import { parse } from 'yaml'

import { createBudgetGuide } from '@/lib/agent'

export type Case = { id: string; q: string; expected_figures?: string[]; must_include?: string[]; must_not?: string[] }
export type Judgment = { include: { item: string; met: boolean }[]; not: { item: string; violated: boolean }[]; note: string }
const JUDGE = 'claude-haiku-4-5-20251001'

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

export async function judge(c: Case, text: string, tools: string): Promise<{ include: { item: string; met: boolean }[]; not: { item: string; violated: boolean }[]; note: string }> {
  if (!c.must_include?.length && !c.must_not?.length) return { include: [], not: [], note: '' }
  const prompt = `You grade an answer from a nonpartisan guide to the City of Milwaukee's 2027 proposed budget.
Question: ${c.q}
Answer text shown to the user:
"""${text}"""
Data the answer's lookups returned (also shown to the user as cited cards; may be truncated):
"""${tools.slice(0, 6000)}"""
For each REQUIRED item, is it satisfied by the answer text or the shown data? For each FORBIDDEN item, does the answer do it?
REQUIRED: ${JSON.stringify(c.must_include ?? [])}
FORBIDDEN: ${JSON.stringify(c.must_not ?? [])}
Reply with JSON only: {"include":[{"item":"...","met":true}],"not":[{"item":"...","violated":false}],"note":"one short sentence"}`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: JUDGE, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  })
  const body = (await res.json()) as { content?: { text: string }[] }
  const raw = body.content?.[0]?.text ?? '{}'
  try { return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch { return { include: [], not: [], note: `judge unreadable: ${raw.slice(0, 80)}` } }
}


/** Runs one question through the agent on `model`; returns what the visitor would see plus cost. */
export async function answer(c: Case, model: string) {
  const price = PRICES[model]
  if (!price) throw new Error(`No price for ${model}; add it to PRICES`)
  const t0 = Date.now()
  const r: any = await createBudgetGuide(model).generate(c.q)
  const steps = r.steps ?? []
  const tools: string[] = steps.flatMap((s: any) => (s.toolCalls ?? []).map((t: any) => t.payload?.toolName ?? t.toolName))
  const toolData = JSON.stringify(steps.flatMap((s: any) => (s.toolResults ?? []).map((t: any) => t.payload?.result ?? t.result)))
  let cost = 0
  // Provider-neutral usage: inputTokens includes cached reads and writes on every provider.
  for (const s of steps) {
    const u = s.usage ?? {}, read = u.cachedInputTokens ?? 0, write = u.cacheCreationInputTokens ?? 0
    cost += (((u.inputTokens ?? 0) - read - write) * price.in + write * price.write + read * price.read + (u.outputTokens ?? 0) * price.out) / 1e6
  }
  return { text: r.text as string, tools, toolData, cents: +(cost * 100).toFixed(2), secs: Math.round((Date.now() - t0) / 1000) }
}

export const figuresFound = (c: Case, text: string, toolData: string) =>
  (c.expected_figures ?? []).map((f) => ({ f, found: hasFigure(`${text}\n${toolData}`.toLowerCase(), f) }))
