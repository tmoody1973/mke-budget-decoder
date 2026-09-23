// @vitest-environment node
import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { chicagoDay, takeQuestion } from './chat-usage'
import * as s from './schema'

config({ path: '.env.local' })
const url = process.env.DATABASE_URL

it('chicagoDay uses Central time, not UTC', () => {
  expect(chicagoDay(new Date('2026-09-24T03:30:00Z'))).toBe('2026-09-23') // 10:30 pm CDT
})

describe.skipIf(!url)('takeQuestion (Neon)', () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const db = drizzle(pool, { schema: s })
  const day = '1999-01-01' // a test-only day, removed afterwards
  afterAll(async () => { await db.execute(sql`delete from chat_usage where day = ${day}`); await pool.end() })

  it('allows questions up to the limit, then refuses', async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => takeQuestion(db, 3, day)))
    expect(results.filter(Boolean)).toHaveLength(3) // parallel calls can't overshoot
    expect(await takeQuestion(db, 3, day)).toBe(false)
  }, 30_000)

  it('a limit of 0 refuses even the first question of a new day', async () => {
    expect(await takeQuestion(db, 0, '1999-01-02')).toBe(false)
    await db.execute(sql`delete from chat_usage where day = '1999-01-02'`)
  }, 30_000)
})
