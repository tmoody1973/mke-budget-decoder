// RFC 5545 calendar file for the budget schedule, so residents can add every date at once.
import type { CivicEvent } from './events'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const day = (ymd: string) => ymd.replace(/-/g, '')
const nextDay = (ymd: string) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }

/** Folds a content line at 75 octets, continuation lines starting with a space (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder()
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = '' }
    cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}

export function buildIcs(events: CivicEvent[], stamp = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Milwaukee Budget Decoder//2027 budget calendar//EN', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Milwaukee 2027 budget: take part']
  for (const e of events) {
    const allDay = !e.start.includes('T')
    lines.push('BEGIN:VEVENT', `UID:${e.id}@mke-budget-decoder`, `DTSTAMP:${utc(stamp)}`,
      allDay ? `DTSTART;VALUE=DATE:${day(e.start)}` : `DTSTART:${utc(new Date(e.start))}`,
      ...(allDay ? [`DTEND;VALUE=DATE:${day(nextDay(e.end ?? e.start))}`] : []),
      `SUMMARY:${esc(e.title)}`, `LOCATION:${esc(e.place)}`, `DESCRIPTION:${esc(allDay ? e.how : `${e.how} End time not announced.`)}`,
      ...(e.link ? [`URL:${e.link.href}`] : []), 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
