import { describe, expect, it } from 'vitest'

import { buildIcs } from './ics'
import { EVENTS } from './events'

const ics = buildIcs(EVENTS, new Date('2026-09-23T12:00:00Z'))
const block = (uid: string) => ics.split('BEGIN:VEVENT').find((b) => b.includes(`UID:${uid}`)) ?? ''

describe('budget calendar (.ics)', () => {
  it('is a valid calendar with one event per entry and CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(EVENTS.length)
    expect(ics.includes('\n') && !/[^\r]\n/.test(ics)).toBe(true)
  })
  it('converts Central time to UTC, across the Nov 1 daylight-saving change', () => {
    expect(block('joint-hearing-2026-10-05@mke-budget-decoder')).toContain('DTSTART:20261005T233000Z') // 6:30 pm CDT
    expect(block('adoption-2026-11-06@mke-budget-decoder')).toContain('DTSTART:20261106T150000Z') // 9 am CST
  })
  it('stores the department presentations as an all-day range, end exclusive', () => {
    const b = block('department-presentations-2026@mke-budget-decoder')
    expect(b).toContain('DTSTART;VALUE=DATE:20261001')
    expect(b).toContain('DTEND;VALUE=DATE:20261016')
  })
  it('escapes commas and semicolons in text fields', () => {
    expect(block('joint-hearing-2026-10-05@mke-budget-decoder')).toContain('LOCATION:Common Council Chamber\\, City Hall\\, 200 E. Wells St.')
  })
  it('folds lines longer than 75 octets', () => {
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })
})
