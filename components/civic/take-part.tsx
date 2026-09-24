// "Have your say": the Council's budget schedule as a ruled timeline (DESIGN.md world).
// Pure: events, the current time and the cited legal deadline arrive as props.
import { CalendarPlus } from 'lucide-react'

import { TrackedLink } from '@/components/site/tracked-link'
import type { CivicEvent } from '@/lib/civic/events'
import { SOURCE } from '@/lib/civic/events'

const TZ = 'America/Chicago'
const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
const fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const allDayDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`) // noon UTC keeps the Central date stable

/** When an event is over: all-day ranges end after their last day; timed events a few hours after they start. */
function endsAt(e: CivicEvent) {
  return e.start.includes('T') ? new Date(new Date(e.start).getTime() + 4 * 3600_000) : new Date(`${e.end ?? e.start}T23:59:00-05:00`)
}

export function TakePart({ events, now, deadline }: { events: CivicEvent[]; now: Date; deadline: React.ReactNode }) {
  const next = events.find((e) => endsAt(e) > now)
  return (
    <div>
      <ol className="border-t-2 border-ink">
        {events.map((e) => {
          const past = endsAt(e) <= now
          const timed = e.start.includes('T')
          const when = timed ? fmtDay.format(new Date(e.start))
            : `${fmtDay.format(allDayDate(e.start))} to ${fmtDay.format(allDayDate(e.end ?? e.start))}`
          return (
            <li key={e.id} className={`grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[11rem_1fr] ${past ? 'opacity-60' : ''}`}>
              <div className="tabular">
                <p className="font-bold text-ink">{when}</p>
                {timed && <p className="text-sm text-ink-soft">{fmtTime.format(new Date(e.start))}</p>}
                {e === next && <p className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-ref">Next</p>}
                {past && <p className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">Past</p>}
              </div>
              <div>
                <p className="font-semibold text-ink">{e.title}</p>
                <p className="text-sm text-ink-soft">{e.place}</p>
                <p className="mt-1 text-sm text-ink">
                  {e.how}
                  {e.link && <> <a href={e.link.href} className="font-semibold text-ref underline underline-offset-4" target="_blank" rel="noopener">{e.link.label}</a></>}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-sm text-ink">{deadline}</p>
      <TrackedLink event="calendar_downloaded" href="/calendar/budget-2027.ics" className="mt-4 inline-flex items-center gap-2 border-2 border-ink px-4 py-2 font-semibold text-ink no-underline hover:border-ref hover:text-ref">
        <CalendarPlus aria-hidden className="size-4" strokeWidth={2} />Add all dates to my calendar
      </TrackedLink>
      <p className="mt-4 text-sm text-ink-soft">
        <span className="font-semibold text-ink">Source:</span> Common Council press release, “
        <a href={SOURCE.url} className="text-ref underline underline-offset-4" target="_blank" rel="noopener">{SOURCE.title}</a>,”
        {' '}{SOURCE.by}, September 22, 2026. Dates can change; the committee page has the latest schedule.
      </p>
    </div>
  )
}
