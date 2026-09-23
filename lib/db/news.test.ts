// @vitest-environment node
// Golden figures for the news topics, checked by hand against the Summary PDF on 2026-09-23.
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { getTopicFigures } from './news'
import * as s from './schema'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL
const VERSION = '2027-proposed-3rd-run-2026-09-14'

describe.skipIf(!url)('news topic figures (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  afterAll(() => pool.end())

  it('returns cited figures for each topic that has them', async () => {
    const t = await getTopicFigures(db, VERSION)
    const police = t['public-safety'].find((f) => f.id === 'news-police')!
    expect([police.adopted2026, police.proposed2027]).toEqual([310_111_835, 343_937_125])
    expect(t.buildings[0].proposed2027).toBe(2_000_000) // Summary p.103: Branch Library New Construction
    expect(t.buildings[0].cite.printed_page).toBe('103')
    expect(t['taxes-fees'].find((f) => f.id === 'news-solid-waste')).toMatchObject({ adopted2026: 271.8, proposed2027: 280 })
    expect(t.gap).toEqual([])
    for (const list of Object.values(t)) for (const f of list) expect(f.cite.pdf_page).toBeGreaterThan(0)
  }, 30_000) // several queries over one pooled connection
})
