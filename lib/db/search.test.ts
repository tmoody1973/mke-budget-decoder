// @vitest-environment node
// Budget text search: the questions residents actually ask find the passage that answers them.
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import * as s from './schema'
import { anyWords, focusPassage, searchBudgetText } from './search'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL
const VERSION = '2027-proposed-3rd-run-2026-09-14'

it('anyWords joins a question into an any-word query', () => {
  expect(anyWords('What new buildings?')).toBe('what or new or buildings')
  expect(anyWords('!!')).toBe('')
})

it('focusPassage keeps the matching sentence of a long passage and stays under the limit', () => {
  const filler = 'The department continues routine work on many programs across the city. '.repeat(40)
  const text = `${filler}Branch Library New Construction: The 2027 capital budget provides $2,000,000 to begin a new branch library in the Midtown neighborhood. ${filler}`
  const out = focusPassage(text, 'What new library buildings are planned?', 600)
  expect(out).toContain('$2,000,000')
  expect(out.length).toBeLessThanOrEqual(640)
  expect(focusPassage('Short passage.', 'anything')).toBe('Short passage.')
})

describe.skipIf(!url)('searchBudgetText (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  afterAll(() => pool.end())

  it('"new buildings" finds facilities capital projects and the Midtown library passage', async () => {
    const hits = await searchBudgetText(db, VERSION, 'What new buildings are in the proposed 2027 budget? new library construction')
    expect(hits.some((h) => h.text.includes('Midtown'))).toBe(true) // Library, Summary p.100
    expect(hits.some((h) => h.text.includes('FACILITIES CAPITAL PROJECTS'))).toBe(true) // DPW, p.128
    expect(hits.every((h) => !/search_budget_lines|get_department|structured data/.test(h.text))).toBe(true) // no pointer cards
    expect(hits.every((h) => !h.context.startsWith('City of Milwaukee'))).toBe(true)
  }, 30_000)

  it('keyword-only search still finds Act 12 passages without an embedding key', async () => {
    const saved = process.env.VOYAGE_API_KEY
    delete process.env.VOYAGE_API_KEY
    try {
      const hits = await searchBudgetText(db, VERSION, 'Act 12 police staffing')
      expect(hits.length).toBeGreaterThan(0)
      expect(hits.some((h) => /Act 12/.test(h.text))).toBe(true)
    } finally { process.env.VOYAGE_API_KEY = saved }
  }, 30_000)
})
