// Money and figure formatting for the app. Amounts arrive as integer cents or whole dollars.
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const cents = (c: number) => usd.format(c / 100)
export const dollars = (d: number) => usd0.format(d)
/** '+$43.86' / '−$12.00' / '$0.00' (true minus sign, so screen readers and eyes agree) */
export const signedCents = (c: number) => (c > 0 ? `+${cents(c)}` : c < 0 ? `−${cents(-c)}` : cents(0))
export const pct = (from: number, to: number) =>
  from === 0 ? null : `${to >= from ? '+' : '−'}${Math.abs(((to - from) / from) * 100).toFixed(1)}%`
/** 2261087412 → '$2.26 billion'; 846796205 → '$846.8 million'; 5000000 → '$5.0 million' */
export const bigDollars = (d: number) =>
  Math.abs(d) >= 1e9 ? `$${(d / 1e9).toFixed(2)} billion` : Math.abs(d) >= 1e6 ? `$${(d / 1e6).toFixed(1)} million` : dollars(d)
/** Signed whole-dollar change with a true minus: '+$31.1 million' / '−$1.9 million' */
export const signedBig = (d: number) => (d > 0 ? `+${bigDollars(d)}` : d < 0 ? `−${bigDollars(-d)}` : '$0')
/** Almanac figure in millions for tables headed "millions of dollars": 846796205 → '846.8'; 37458 → '0.04' */
export const millions = (d: number) => {
  const m = Math.abs(d) / 1e6
  return `${d < 0 ? '−' : ''}${m.toLocaleString('en-US', { minimumFractionDigits: m < 0.1 && m > 0 ? 2 : 1, maximumFractionDigits: m < 0.1 && m > 0 ? 2 : 1 })}`
}
export const signedMillions = (d: number) => (d > 0 ? `+${millions(d)}` : millions(d))
