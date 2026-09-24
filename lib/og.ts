// Shared pieces for the site's generated images (link preview, launch post): brand colors as hex (the
// image renderer can't read CSS variables), Libre Franklin at fixed weights, the logo, and the section
// figures from Summary p.7, read from the database like every other number on the site.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { BUDGET_VERSION, getDb } from '@/lib/db/client'
import { getHeadline, getSectionBudgets } from '@/lib/db/overview'

export const C = { ink: '#1a2b49', inkSoft: '#404d66', band: '#fdbe45', paper: '#fdfaf1', rule: '#e3ddcb' }

// Literal paths, so the deploy bundles just these files (a computed path makes it trace the whole project).
export async function ogFonts() {
  const [regular, semi, extra] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/LibreFranklin-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/LibreFranklin-SemiBold.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/LibreFranklin-ExtraBold.ttf')),
  ])
  return [
    { name: 'Franklin', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Franklin', data: semi, weight: 600 as const, style: 'normal' as const },
    { name: 'Franklin', data: extra, weight: 800 as const, style: 'normal' as const },
  ]
}
export const logoSrc = async () => `data:image/png;base64,${(await readFile(join(process.cwd(), 'assets/logo-160.png'))).toString('base64')}`

/** The biggest sections by 2027 proposed spending, plus everything else (total minus those, all p.7). */
export async function sectionShares(top = 5) {
  const db = getDb()
  const [h, sections] = await Promise.all([getHeadline(db, BUDGET_VERSION), getSectionBudgets(db, BUDGET_VERSION)])
  const sorted = [...sections].sort((a, b) => b.proposed2027 - a.proposed2027)
  const plain: Record<string, string> = { D: 'Debt payments', C: 'Capital projects' } // clearer than the budget's shorthand
  const head = sorted.slice(0, top).map((s) => ({ label: plain[s.section] ?? s.short, amount: s.proposed2027 }))
  const rest = h.allFunds.proposed2027 - head.reduce((a, s) => a + s.amount, 0)
  return { total: h.allFunds.proposed2027, rows: [...head, { label: 'Everything else', amount: rest }], page: h.allFunds.cite.printed_page }
}

export const billions = (d: number) => `$${(d / 1e9).toFixed(2)} billion`
export const millionsShort = (d: number) => `$${(d / 1e6).toFixed(1)}M`
