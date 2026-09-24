// The answer check as a Braintrust experiment (D22): same questions (evals/golden.yaml) and the same
// grading (evals/scoring.ts), logged to the Braintrust project so runs can be compared side by side.
// Run: pnpm evals:bt   (EVAL_MODEL=... to try another model; needs BRAINTRUST_API_KEY). About $1.50.
import { config } from 'dotenv'

config({ path: '.env.local' })
const { Eval } = await import('braintrust')
const { BRAINTRUST_PROJECT, CHAT_MODEL } = await import('@/lib/agent')
const { answer, figuresFound, judge, loadCases } = await import('./scoring')
type Case = import('./scoring').Case
type Out = Awaited<ReturnType<typeof answer>>

const MODEL = process.env.EVAL_MODEL ?? CHAT_MODEL
const cases = loadCases(process.argv.slice(2))
const judged = new Map<string, ReturnType<typeof judge>>() // one grading call per answer, shared by two scorers
const judgeOnce = (c: Case, o: Out) => judged.get(c.id) ?? judged.set(c.id, judge(c, o.text, o.toolData)).get(c.id)!

await Eval(BRAINTRUST_PROJECT, {
  experimentName: `${MODEL.split('/').pop()} · ${new Date().toISOString().slice(0, 16)}`,
  metadata: { model: MODEL },
  maxConcurrency: 3,
  data: cases.map((c) => ({ input: c.q, expected: c, metadata: { id: c.id } })),
  task: async (_input, { expected }) => answer(expected as Case, MODEL),
  scores: [
    ({ output, expected }) => {
      const f = figuresFound(expected as Case, output.text, output.toolData)
      return f.length ? { name: 'figures', score: f.filter((x) => x.found).length / f.length, metadata: { missing: f.filter((x) => !x.found).map((x) => x.f) } } : null
    },
    async ({ output, expected }) => {
      const j = await judgeOnce(expected as Case, output)
      return j.include.length ? { name: 'required ideas', score: j.include.filter((x) => x.met).length / j.include.length, metadata: { note: j.note } } : null
    },
    async ({ output, expected }) => {
      const j = await judgeOnce(expected as Case, output)
      return j.not.length ? { name: 'no forbidden behavior', score: j.not.some((x) => x.violated) ? 0 : 1, metadata: { violated: j.not.filter((x) => x.violated).map((x) => x.item) } } : null
    },
    ({ output }) => ({ name: 'under 3 cents', score: output.cents <= 3 ? 1 : 0, metadata: { cents: output.cents, secs: output.secs } }),
  ],
})
