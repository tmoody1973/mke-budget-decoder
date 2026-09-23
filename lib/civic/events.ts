// The Common Council's 2027 budget schedule, transcribed from its press release (not a budget
// figure, so it cites the release, not the PDF). Times are Central; ISO strings carry the offset
// in force that day (CDT -05:00 until Nov 1, 2026; CST -06:00 after).
export const SOURCE = {
  title: 'Common Council Seeks Public Input During 2027 Budget Process',
  by: 'Ald. Marina Dimitrijevic, Chair of the Finance and Personnel Committee',
  date: '2026-09-22',
  url: 'https://urbanmilwaukee.com/pressrelease/common-council-seeks-public-input-during-2027-budget-process/',
  committee: 'https://city.milwaukee.gov/commoncouncil/Committee/Finance-and-Personnel.htm',
} as const

export type CivicEvent = {
  id: string
  title: string
  kind: 'input' | 'watch' | 'decision'
  start: string // ISO with offset, or YYYY-MM-DD for all-day
  end?: string // all-day ranges: last day, inclusive
  place: string
  how: string // plain words: how to take part or follow along
  link?: { label: string; href: string }
}

export const EVENTS: CivicEvent[] = [
  {
    id: 'department-presentations-2026', kind: 'watch', start: '2026-10-01', end: '2026-10-15',
    title: 'Departments present their budgets to the Finance and Personnel Committee',
    place: 'City Hall; broadcast on the City Channel (Spectrum 25, AT&T U-Verse 99) and city.milwaukee.gov/Channel25',
    how: 'Watch on TV or online. The full schedule is on the committee’s page.',
    link: { label: 'Committee schedule', href: SOURCE.committee },
  },
  {
    id: 'joint-hearing-2026-10-05', kind: 'input', start: '2026-10-05T18:30:00-05:00',
    title: 'Joint Public Hearing on the Mayor’s proposed 2027 budget',
    place: 'Common Council Chamber, City Hall, 200 E. Wells St.',
    how: 'Speak in person. This hearing is in person only.',
  },
  {
    id: 'input-hearing-2026-10-17', kind: 'input', start: '2026-10-17T09:30:00-05:00',
    title: 'Finance and Personnel Committee Public Input Hearing',
    place: 'Mitchell Library, 906 W. Historic Mitchell St.',
    how: 'Speak in person, or register in advance to give input virtually.',
    link: { label: 'Register to speak virtually', href: 'https://register.gotowebinar.com/register/723795768668226141' },
  },
  {
    id: 'amendments-2026-10-29', kind: 'watch', start: '2026-10-29T09:00:00-05:00',
    title: 'Council members’ budget amendments are heard',
    place: 'City Hall; broadcast on the City Channel',
    how: 'Watch. Amendments are filed under Common Council file #260001.',
  },
  {
    id: 'adoption-2026-11-06', kind: 'decision', start: '2026-11-06T09:00:00-06:00',
    title: 'Common Council adopts the 2027 budget',
    place: 'Common Council meeting, City Hall',
    how: 'Watch. This is the vote on the final budget.',
  },
]
