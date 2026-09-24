// Site events (D22). One place names every event so the list stays small and reviewable; it is also
// written out in .posthog-events.json. Never pass addresses, assessed values, question text or any
// other personal detail as a property. A missing PostHog key makes track() a no-op.
import posthog from 'posthog-js'

type Events = {
  receipt_view_chosen: { view: 'owner' | 'renter' }
  receipt_shown: { kind: string; view: 'owner' | 'renter'; lookup: 'address' | 'typed_value' }
  receipt_image_saved: { method: 'share_sheet' | 'download'; view: string }
  chat_opened: { from: 'header' }
  chat_topic_question: { topic: string }
  source_opened: { doc: string; page: number }
  calendar_downloaded: Record<string, never>
  news_article_opened: { outlet: string; topic: string }
}

export function track<E extends keyof Events>(event: E, props: Events[E]) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.capture(event, props)
}
