import '@copilotkit/react-core/v2/styles.css'

import { AskChat } from '@/components/chat/ask-chat'

export const metadata = { title: 'Ask about the budget · MKE Budget Decoder' }

export default function AskPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ink">Ask about the proposed 2027 budget</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Answers come from the Mayor’s proposed budget documents. Every figure links to its page. It is a proposal; the Common Council can change it.
      </p>
      <AskChat />
    </main>
  )
}
