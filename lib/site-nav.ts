// Site pages and the Overview's section links, shared by the sticky header and the Overview.
export const PAGES = [['/', 'Overview'], ['/receipt', 'Your City Receipt'], ['/how-it-works', 'How it works']] as const
export const OVERVIEW_SECTIONS = [
  ['#revenue', 'Where it comes from'], ['#departments', 'Departments'], ['#changes', 'Biggest changes'],
  ['#taxes', 'Your property taxes'], ['#news', 'In the news'], ['#take-part', 'Have your say'],
] as const
/** Every Overview heading the "you're in" bar can name, including the treemap at the top. */
export const HERE_SECTIONS = [['#spending', 'Where it goes'], ...OVERVIEW_SECTIONS] as const

/** The section the reader is in: of the headings already scrolled up past the line (px from the top
 *  of the window), the lowest one. Goes by position, not list order, because phones stack the page
 *  in a different order than the nav lists it. Null above the first heading. */
export function currentSection(tops: readonly (readonly [string, number | null])[], line: number): string | null {
  let best: string | null = null, bestTop = -Infinity
  for (const [label, top] of tops) if (top !== null && top <= line && top > bestTop) { best = label; bestTop = top }
  return best
}
