// Client analytics start (Next.js runs this file in the browser before the app). PostHog records the
// site's own events (lib/analytics.ts); Vercel Web Analytics counts page views separately (layout).
// Privacy (docs/07 §8, D22): all element text is masked, so a clicked address suggestion is never
// recorded; the receipt lookup is excluded outright (ph-no-capture); no session recordings.
import posthog from 'posthog-js'

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    defaults: '2025-11-30',
    person_profiles: 'identified_only', // no accounts on this site, so visitors stay anonymous
    mask_all_text: true,
    mask_all_element_attributes: true,
    disable_session_recording: true,
    capture_exceptions: true,
  })
} else if (process.env.NODE_ENV === 'development') {
  console.error('NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured')
}
