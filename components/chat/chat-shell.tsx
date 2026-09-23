'use client'
// The site's chat panel (P3, decided 2026-09-23): the page stays in the center and the chat opens
// beside it on wide screens (1280 px and up), or full screen on phones. Any component can open the
// panel or send it a question through useAsk(), so "Ask about this" links sit next to the figures.
import { CopilotChat, CopilotKit, useAgent, useCopilotKit } from '@copilotkit/react-core/v2'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import { Renderers } from './tool-renderers'

const AGENT = 'budgetGuide'
type Ask = { open: boolean; setOpen: (open: boolean) => void; ask: (question: string) => void }
const AskContext = createContext<Ask | null>(null)

export function useAsk() {
  const ctx = useContext(AskContext)
  if (!ctx) throw new Error('useAsk must be used inside ChatShell')
  return ctx
}

function Panel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false) // starts closed: on a laptop an open panel squeezes the charts
  const { agent } = useAgent({ agentId: AGENT })
  const { copilotkit } = useCopilotKit()
  const ask = useCallback((question: string) => {
    setOpen(true)
    if (agent.isRunning) return // one question at a time; the visitor can resend it from the box
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: question })
    void copilotkit.runAgent({ agent })
  }, [agent, copilotkit])
  const value = useMemo(() => ({ open, setOpen, ask }), [open, ask])

  return (
    <AskContext.Provider value={value}>
      <Renderers />
      <div className="flex min-h-full flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        {/* Kept mounted while closed, so the conversation survives closing the panel. */}
        <aside aria-label="Ask about the budget" hidden={!open}
          className="fixed inset-0 z-40 flex flex-col bg-paper xl:sticky xl:top-0 xl:z-auto xl:h-dvh xl:w-[26rem] xl:shrink-0 xl:border-l xl:border-rule">
          <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
            <div>
              <h2 className="font-bold text-ink">Ask about the budget</h2>
              <p className="mt-0.5 text-xs leading-snug text-ink-soft">
                Answers use the Mayor’s proposed budget documents; every figure links to its page. It’s a proposal the Common Council can change.
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close the chat"
              className="-mr-2 grid size-10 shrink-0 place-items-center text-ink hover:text-ref">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <CopilotChat agentId={AGENT} labels={{ chatInputPlaceholder: 'Ask about the proposed 2027 budget' }} />
          </div>
        </aside>
      </div>
    </AskContext.Provider>
  )
}

export function ChatShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent={AGENT} useSingleEndpoint={false}>
      <Panel>{children}</Panel>
    </CopilotKit>
  )
}

/** Header button that opens and closes the panel. */
export function AskButton() {
  const { open, setOpen } = useAsk()
  return (
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
      className="border-2 border-ink px-3 py-1.5 text-sm font-semibold text-ink hover:border-ref hover:text-ref">
      {open ? 'Close the chat' : <>Ask<span className="hidden sm:inline"> about the budget</span></>}
    </button>
  )
}

/** "Ask about this": opens the panel and sends a prepared question. */
export function AskLink({ question, children }: { question: string; children: React.ReactNode }) {
  const { ask } = useAsk()
  return (
    <button type="button" onClick={() => ask(question)} className="text-sm font-semibold text-ref underline underline-offset-4">
      {children}
    </button>
  )
}
