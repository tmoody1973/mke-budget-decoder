// Answer check for the budget chat (docs/05, docs/03 §evals): runs every case in evals/golden.yaml
// through the real agent, checks required figures in code, grades must_include / must_not with a
// small model, and writes evals/results/<stamp>.json plus a table. Costs roughly $1-1.50 a run.
// Usage: pnpm evals                       (all cases, production model)
//        pnpm evals A10 B6                (only ids starting with these)
//        EVAL_MODEL=openrouter/deepseek/deepseek-v4-flash pnpm evals   (same agent, another model)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { config } from 'dotenv'
import { parse } from 'yaml'

config({ path: '.env.local' })
const { CHAT_MODEL, createBudgetGuide } = await import('@/lib/agent')
const MODEL = process.env.EVAL_MODEL ?? CHAT_MODEL
const agent = createBudgetGuide(MODEL)

type Case = { id: string; q: string; expected_figures?: string[]; must_include?: string[]; must_not?: string[] }
const JUDGE = 'claude-haiku-4-5-20251001'
// $ per million tokens: input, cache write, cache read, output (Anthropic list prices and OpenRouter's
// model list, 2026-09-23). Unknown cache pricing is charged as full input, an upper bound.
const PRICES: Record<string, { in: number; write: number; read: number; out: number }> = {
  'anthropic/claude-sonnet-5': { in: 2, write: 2.5, read: 0.2, out: 10 },
  'anthropic/claude-haiku-4-5': { in: 1, write: 1.25, read: 0.1, out: 5 },
  'openrouter/openai/gpt-5.6-luna': { in: 0.2, write: 0.2, read: 0.2, out: 1.2 },
  'openrouter/deepseek/deepseek-v4-flash': { in: 0.075, write: 0.075, read: 0.075, out: 0.15 },
  'openrouter/qwen/qwen3.8-flash': { in: 0.15, write: 0.15, read: 0.15, out: 0.47 },
}
const PRICE = PRICES[MODEL]
if (!PRICE) throw new Error(`No price for ${MODEL}; add it to PRICES`)

const only = process.argv.slice(2)
const cases = (parse(readFileSync('evals/golden.yaml', 'utf8')) as Case[]).filter((c) => !only.length || only.some((p) => c.id.startsWith(p)))

/** Ways a figure can appear: as written, without $ and commas, as whole cents ($1,458.00 -> 145800),
 *  or, for "$143.7 million" / "$2.26 billion", any number in the text or data that rounds to it. */
function variants(fig: string): string[] {
  const out = new Set([fig.toLowerCase(), fig.replace(/[$,]/g, '').toLowerCase()])
  if (/\.\d{2}$/.test(fig)) out.add(fig.replace(/[$,.]/g, ''))
  if (fig.endsWith('%')) { out.add(`${parseFloat(fig).toFixed(1)}%`); out.add(`${fig.slice(0, -1)} percent`) }
  return [...out]
}
function roundsTo(hay: string, fig: string): boolean {
  const m = fig.match(/^\$?([\d.]+) (million|billion)$/i)
  if (!m) return false
  const scale = m[2].toLowerCase() === 'billion' ? 1e9 : 1e6, places = m[1].split('.')[1]?.length ?? 0
  return (hay.replace(/,/g, '').match(/\d{5,}/g) ?? []).some((d) => (Number(d) / scale).toFixed(places) === Number(m[1]).toFixed(places))
}
const hasFigure = (hay: string, fig: string) => roundsTo(hay, fig) || variants(fig).some((v) => hay.includes(v))

async function judge(c: Case, text: string, tools: string): Promise<{ include: { item: string; met: boolean }[]; not: { item: string; violated: boolean }[]; note: string }> {
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

async function runCase(c: Case) {
  const t0 = Date.now()
  try {
    const r: any = await agent.generate(c.q)
    const steps = r.steps ?? []
    const toolNames = steps.flatMap((s: any) => (s.toolCalls ?? []).map((t: any) => t.payload?.toolName ?? t.toolName))
    const toolData = JSON.stringify(steps.flatMap((s: any) => (s.toolResults ?? []).map((t: any) => t.payload?.result ?? t.result)))
    const hay = `${r.text}\n${toolData}`.toLowerCase()
    const figures = (c.expected_figures ?? []).map((f) => ({ f, found: hasFigure(hay, f) }))
    const j = await judge(c, r.text, toolData)
    let cost = 0
    // Provider-neutral usage: inputTokens includes cached reads and writes on every provider.
    for (const s of steps) {
      const u = s.usage ?? {}, read = u.cachedInputTokens ?? 0, write = u.cacheCreationInputTokens ?? 0
      cost += (((u.inputTokens ?? 0) - read - write) * PRICE.in + write * PRICE.write + read * PRICE.read + (u.outputTokens ?? 0) * PRICE.out) / 1e6
    }
    const pass = figures.every((x) => x.found) && j.include.every((x) => x.met) && j.not.every((x) => !x.violated)
    return { id: c.id, q: c.q, pass, figures, include: j.include, not: j.not, note: j.note, tools: toolNames, cents: +(cost * 100).toFixed(2), secs: Math.round((Date.now() - t0) / 1000), text: r.text }
  } catch (e) {
    return { id: c.id, q: c.q, pass: false, error: String(e).slice(0, 200), tools: [], cents: 0, secs: Math.round((Date.now() - t0) / 1000) }
  }
}

const results: Awaited<ReturnType<typeof runCase>>[] = []
for (let i = 0; i < cases.length; i += 3) results.push(...(await Promise.all(cases.slice(i, i + 3).map(runCase))))

mkdirSync('evals/results', { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
writeFileSync(`evals/results/${stamp}.json`, JSON.stringify({ model: MODEL, results }, null, 2))
for (const r of results) {
  const miss = [...(('figures' in r && r.figures) || []).filter((x) => !x.found).map((x) => `fig:${x.f}`),
    ...(('include' in r && r.include) || []).filter((x) => !x.met).map((x) => `needs:${x.item}`),
    ...(('not' in r && r.not) || []).filter((x) => x.violated).map((x) => `DID:${x.item}`), ...('error' in r ? [`error:${r.error}`] : [])]
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id.padEnd(24)} ${String(r.cents).padStart(5)}c  [${r.tools.join(',')}]${miss.length ? `\n      ${miss.join('\n      ')}` : ''}`)
}
const passed = results.filter((r) => r.pass).length, cents = results.reduce((a, r) => a + r.cents, 0)
console.log(`\n${MODEL}: ${passed}/${results.length} passed · ${(cents / results.length).toFixed(2)}c average per question · $${(cents / 100).toFixed(2)} total · evals/results/${stamp}.json`)
process.exit(0)
