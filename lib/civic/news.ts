// "What's in the news" (docs/09 step 2): news coverage grouped by topic. Articles are listed as
// headline, outlet, date and link only, never quoted and never used as data; the figures on each
// topic come from the budget database (lib/db/news.ts). Edited by hand; each article and its topic
// tags are reviewed by Tarik before they count as reviewed (reviewedBy stays null until then).
import type { Cite } from '@/lib/db/schema'

export type TopicId = 'roads' | 'parking' | 'taxes-fees' | 'public-safety' | 'buildings' | 'gap'

export type Article = {
  id: string; outlet: string; headline: string; date: string; url: string
  topics: TopicId[]; reviewedBy: string | null
}

// Headlines and dates as the outlets published them (checked 2026-09-23).
export const ARTICLES: Article[] = [
  {
    id: 'um-streets', outlet: 'Urban Milwaukee', date: '2026-09-20',
    headline: 'Mayor’s Budget Proposal Includes Record Amount For Local Streets',
    url: 'https://urbanmilwaukee.com/2026/09/20/mayors-budget-proposal-includes-record-amount-for-local-streets/',
    topics: ['roads', 'parking'], reviewedBy: null,
  },
  {
    id: 'fox6-overview', outlet: 'FOX6 News', date: '2026-09-22',
    headline: 'Milwaukee mayor introduces $2.2 billion budget proposal for 2027',
    url: 'https://www.fox6now.com/news/milwaukee-mayor-2-2-billion-budget-proposal-2027',
    topics: ['roads', 'parking', 'taxes-fees', 'public-safety', 'buildings', 'gap'], reviewedBy: null,
  },
  {
    id: 'wisn-parking', outlet: 'WISN 12', date: '2026-09-22',
    headline: 'Milwaukee mayor’s 2027 budget proposal includes higher parking fees',
    url: 'https://www.wisn.com/article/milwaukee-mayor-cavalier-johnson-2027-budget-proposal/73839277',
    topics: ['parking', 'taxes-fees', 'roads'], reviewedBy: null,
  },
]

const summary = (pdf_page: number, printed_page: string): Cite => ({ doc: 'summary', pdf_page, printed_page })

/** Topics in the order the coverage leads with them. `pages` are where the budget itself discusses the topic. */
export const TOPICS: { id: TopicId; title: string; pages: { cite: Cite; label: string }[] }[] = [
  { id: 'roads', title: 'Roads', pages: [
    { cite: summary(138, '128'), label: 'street, bridge and alley programs' },
    { cite: summary(184, '174'), label: 'street spending since 2019' },
  ] },
  { id: 'parking', title: 'Parking', pages: [{ cite: summary(202, '192'), label: 'Parking Services' }] },
  { id: 'taxes-fees', title: 'Taxes and fees', pages: [] },
  { id: 'public-safety', title: 'Public safety', pages: [] },
  { id: 'buildings', title: 'New buildings', pages: [] },
  { id: 'gap', title: 'The budget gap', pages: [{ cite: summary(11, '1'), label: 'why the city faces a gap each year' }] },
]
