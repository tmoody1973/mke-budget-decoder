// Money and figure formatting for the app. Amounts arrive as integer cents or whole dollars.
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const cents = (c: number) => usd.format(c / 100)
export const dollars = (d: number) => usd0.format(d)
/** '+$43.86' / '−$12.00' / '$0.00' (true minus sign, so screen readers and eyes agree) */
export const signedCents = (c: number) => (c > 0 ? `+${cents(c)}` : c < 0 ? `−${cents(-c)}` : cents(0))
export const pct = (from: number, to: number) =>
  from === 0 ? null : `${to >= from ? '+' : '−'}${Math.abs(((to - from) / from) * 100).toFixed(1)}%`
