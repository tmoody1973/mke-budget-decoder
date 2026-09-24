// Answer check for the budget chat (docs/05, docs/03 §evals): runs every case in evals/golden.yaml
// through the real agent and grades it (evals/scoring.ts), writing evals/results/<stamp>.json plus a
// table. Costs roughly $1-1.50 a run. The same check runs in Braintrust: pnpm evals:bt.
// Usage: pnpm evals                       (all cases, production model)
//        pnpm evals A10 B6                (only ids starting with these)
//        EVAL_MODEL=openrouter/deepseek/deepseek-v4-flash pnpm evals   (same agent, another model)
import { mkdirSync, writeFileSync } from 'node:fs'
import { config } from 'dotenv'

config({ path: '.env.local' })
const { CHAT_MODEL } = await import('@/lib/agent')
const { answer, figuresFound, judge, loadCases } = await import('./scoring')
type Case = import('./scoring').Case
const MODEL = process.env.EVAL_MODEL ?? CHAT_MODEL
const cases = loadCases(process.argv.slice(2))

async function runCase(c: Case) {
  try {
    const a = await answer(c, MODEL)
    const figures = figuresFound(c, a.text, a.toolData)
    const j = await judge(c, a.text, a.toolData)
    const pass = figures.every((x) => x.found) && j.include.every((x) => x.met) && j.not.every((x) => !x.violated)
    return { id: c.id, q: c.q, pass, figures, include: j.include, not: j.not, note: j.note, tools: a.tools, cents: a.cents, secs: a.secs, text: a.text }
  } catch (e) {
    return { id: c.id, q: c.q, pass: false, error: String(e).slice(0, 200), tools: [] as string[], cents: 0, secs: 0 }
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
