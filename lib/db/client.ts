// One connection pool per server instance, opened on first use and reused across requests.
// Lazy so `next build` (and CI, which has no database) can load modules without DATABASE_URL.
// ponytail: add attachDatabasePool from @vercel/functions if Fluid compute idle connections become an issue.
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

let instance: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (instance) return instance
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  instance = drizzle(new Pool({ connectionString: url, max: 5 }), { schema })
  return instance
}

export const BUDGET_VERSION = '2027-proposed-3rd-run-2026-09-14'
