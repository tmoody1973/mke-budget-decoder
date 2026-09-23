'use client'
// Tapping a source mark opens the cited budget page beside the figure (DESIGN.md source marks).
// Marks stay plain links to the Sources list, so without JavaScript, or with Cmd/Ctrl-click,
// they still jump there. Non-modal on wide screens so the figure and its page sit side by side.
import { X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const PdfPage = dynamic(() => import('./pdf-page'), {
  ssr: false, loading: () => <p className="p-6 text-sm text-ink-soft">Loading the page viewer…</p>,
})

const FILES = { summary: '/pdf/summary.pdf', detailed: '/pdf/detailed.pdf' } as const
const NAMES = { summary: 'Proposed Plan and Executive Budget Summary', detailed: 'Proposed Detailed Budget' } as const
type Source = { doc: keyof typeof FILES; pdfPage: number; where: string; terms: string[]; trigger: HTMLElement }

export function SourceDrawer() {
  const [src, setSrc] = useState<Source | null>(null)
  const [hits, setHits] = useState<number | null>(null)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#src-"], a[href^="#fn-"]')
      const li = a && document.getElementById(a.getAttribute('href')!.slice(1))
      const doc = li?.dataset.doc as Source['doc'] | undefined
      if (!a || !li || !doc || !(doc in FILES)) return
      e.preventDefault()
      setHits(null)
      setSrc({ doc, pdfPage: Number(li.dataset.pdfPage), where: li.dataset.where ?? '', trigger: a,
        terms: (a.dataset.q ?? '').split('|').filter(Boolean) })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (!src) return
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  function dismiss() {
    const back = src?.trigger
    setSrc(null)
    back?.focus()
  }

  if (!src) return null
  const file = `${FILES[src.doc]}#page=${src.pdfPage}`
  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="source-title"
      className="fixed inset-0 z-50 flex flex-col border-ink bg-paper text-ink sm:inset-y-0 sm:left-auto sm:w-[min(44rem,55vw)] sm:border-l-2">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-4 py-3 sm:px-6">
        <div>
          <h2 id="source-title" className="text-lg font-bold">Source: {src.where}</h2>
          <p className="text-sm text-ink-soft">City of Milwaukee 2027 {NAMES[src.doc]}</p>
          <p className="tabular mt-1 text-sm" aria-live="polite">
            {src.terms.length === 0 ? 'The whole page is the source for this figure.'
              : hits === null ? `Looking for ${src.terms.join(' and ')}…`
                : hits > 0 ? <>Highlighted on this page: <span className="font-semibold">{src.terms.join(', ')}</span></>
                  : <>The figure {src.terms.join(', ')} isn’t printed in exactly that form here; it is computed from this page.</>}
          </p>
          <a href={file} target="_blank" rel="noopener" className="mt-1 inline-block text-sm font-semibold text-ref underline underline-offset-4">
            Open the full PDF at this page
          </a>
        </div>
        <button ref={close} type="button" onClick={dismiss} aria-label="Close the source page"
          className="-m-2 p-2 text-ink hover:text-ref">
          <X aria-hidden className="size-6" strokeWidth={2} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-rule/40 p-3 sm:p-4">
        <div className="bg-paper">
          <PdfPage key={`${src.doc}-${src.pdfPage}-${src.terms.join()}`} file={FILES[src.doc]} page={src.pdfPage} terms={src.terms} onHits={setHits} />
        </div>
      </div>
    </aside>
  )
}
