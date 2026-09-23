// Highlights cited figures in a PDF text layer (react-pdf customTextRenderer returns HTML).
// The PDF's text is escaped first, so nothing in the document can become markup.
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Wraps each whole-number occurrence of any term in <mark>. A term never matches inside a longer
 *  number: '343,937,125' does not match in '1,343,937,1250', and '7.29' does not match in '7.291'. */
export function markTerms(text: string, terms: string[]): string {
  const safe = escapeHtml(text)
  const wanted = terms.filter(Boolean).map(escapeHtml)
  if (!wanted.length) return safe
  const re = new RegExp(`(?<![\\d.,])(${wanted.map(escapeRe).join('|')})(?![\\d]|[.,]\\d)`, 'g')
  return safe.replace(re, '<mark>$1</mark>')
}
