// One connection pool per server instance, opened at module scope and reused across requests.
// ponytail: add attachDatabasePool from @vercel/functions when deploying to Vercel (Fluid compute).
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

export const db = drizzle(new Pool({ connectionString: url, max: 5 }), { schema })
export const BUDGET_VERSION = '2027-proposed-3rd-run-2026-09-14'
