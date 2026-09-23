// "Add all dates to my calendar": the Council's 2027 budget schedule as an .ics file.
import { EVENTS } from '@/lib/civic/events'
import { buildIcs } from '@/lib/civic/ics'

export function GET() {
  return new Response(buildIcs(EVENTS), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="milwaukee-2027-budget.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
