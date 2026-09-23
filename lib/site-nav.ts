// Site pages and the Overview's section links, shared by the sticky header and the Overview.
export const PAGES = [['/', 'Overview'], ['/receipt', 'Your City Receipt'], ['/how-it-works', 'How it works']] as const
export const OVERVIEW_SECTIONS = [
  ['#revenue', 'Where it comes from'], ['#departments', 'Departments'], ['#changes', 'Biggest changes'],
  ['#taxes', 'Your property taxes'], ['#news', 'In the news'], ['#take-part', 'Have your say'],
] as const
