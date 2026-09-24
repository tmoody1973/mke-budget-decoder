// Copies evals/golden.yaml into the Braintrust dataset "Golden questions" (D22). The YAML file stays
// the one source of truth: rows are upserted by question id and tagged "golden"; golden rows no longer
// in the file are removed. Rows added by hand in Braintrust (for example from a live trace) carry no
// answer key, have no "golden" tag and are left alone as an inbox to turn into YAML entries.
// Run: pnpm evals:sync   (needs BRAINTRUST_API_KEY; no model cost)
import { config } from 'dotenv'

config({ path: '.env.local' })
const { initDataset } = await import('braintrust')
const { BRAINTRUST_PROJECT } = await import('@/lib/agent')
const { GOLDEN_DATASET, loadCases } = await import('./scoring')

const cases = loadCases()
const ds = initDataset(BRAINTRUST_PROJECT, { dataset: GOLDEN_DATASET, description: 'The answer check: questions from docs/05 with required figures and behaviors (evals/golden.yaml).' })

const keep = new Set(cases.map((c) => c.id))
let removed = 0, inbox = 0
for await (const row of ds) {
  if (!row.tags?.includes('golden')) { inbox++; continue }
  if (!keep.has(row.id)) { await ds.delete(row.id); removed++ }
}
for (const c of cases) ds.insert({ id: c.id, input: c.q, expected: c, tags: ['golden'], metadata: { id: c.id } })
await ds.flush()
console.log(JSON.stringify({ dataset: GOLDEN_DATASET, upserted: cases.length, removed, inbox_rows_left_alone: inbox }))
process.exit(0)
