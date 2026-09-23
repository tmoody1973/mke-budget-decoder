// Daily chat cap (D20): one row per Central-time day. takeQuestion atomically adds one question if the
// day is still under the limit, so parallel server instances can't overshoot it.
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as s from './schema'

type Db = NodePgDatabase<typeof s>

export const chicagoDay = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

/** Counts one question for `day`; false when the day already has `limit` questions. */
export async function takeQuestion(db: Db, limit: number, day = chicagoDay()): Promise<boolean> {
  const r = await db.execute(sql`
    insert into chat_usage (day, questions) select ${day}, 1 where ${limit} > 0
    on conflict (day) do update set questions = chat_usage.questions + 1
    where chat_usage.questions < ${limit}
    returning questions`)
  return r.rows.length > 0
}
