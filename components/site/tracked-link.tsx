'use client'
// A plain link that records one site event when clicked, for server-rendered components that can't
// attach handlers themselves (the calendar download, news headlines).
import { track } from '@/lib/analytics'

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  ({ event: 'calendar_downloaded' } | { event: 'news_article_opened'; outlet: string; topic: string })

export function TrackedLink(props: Props) {
  const anchor = { ...props } as Record<string, unknown>
  for (const k of ['event', 'outlet', 'topic']) delete anchor[k]
  return (
    <a {...(anchor as React.AnchorHTMLAttributes<HTMLAnchorElement>)} onClick={() =>
      props.event === 'news_article_opened' ? track('news_article_opened', { outlet: props.outlet, topic: props.topic }) : track('calendar_downloaded', {})} />
  )
}
