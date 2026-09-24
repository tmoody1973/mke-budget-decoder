// "Find it in the budget" claims (docs/09 step 3), read from pipeline/data/news_claims.yaml, where the
// pipeline test holds each budget-side figure to its page. Only human-reviewed claims are returned.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parse } from 'yaml'

import type { Cite } from '@/lib/db/schema'

import type { TopicId } from './news'

export type ClaimLabel = 'matches' | 'rounded' | 'not_in_budget' | 'different_measure'
export type Claim = {
  id: string; topic: TopicId; label: ClaimLabel
  sources: { article: string; quote: string }[]
  budget: { text: string; cite: Cite }
  note?: string; reviewed_by: string | null
}

export const LABEL_TEXT: Record<ClaimLabel, string> = {
  matches: 'Matches the budget', rounded: 'Rounded', not_in_budget: 'Not in the budget documents', different_measure: 'A different measure',
}

export function reviewedClaims(): Claim[] {
  const all = parse(readFileSync(join(process.cwd(), 'pipeline/data/news_claims.yaml'), 'utf8')) as Claim[]
  return all.filter((c) => c.reviewed_by)
}
