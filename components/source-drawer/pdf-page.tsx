'use client'
// One PDF page at the drawer's width, with the cited figures highlighted in the text layer.
// Loaded on demand (next/dynamic, no SSR) so the dashboard never pays for pdf.js.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'

import { markTerms } from '@/lib/highlight'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type Props = { file: string; page: number; terms: string[]; onHits: (n: number) => void }

export default function PdfPage({ file, page, terms, onHits }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const render = useCallback((item: { str: string }) => markTerms(item.str, terms), [terms])
  const found = () => {
    const marks = box.current?.querySelectorAll('mark') ?? []
    onHits(marks.length)
    marks[0]?.scrollIntoView({ block: 'center' })
  }
  const status = (text: string) => <p className="p-6 text-sm text-ink-soft">{text}</p>
  return (
    <div ref={box} className="pdf-page w-full">
      {width > 0 && (
        <Document file={file} loading={status('Loading the budget page…')} error={status('The budget page could not be loaded. Use the link above to open the PDF.')}>
          <Page pageNumber={page} width={width} customTextRenderer={render} renderAnnotationLayer={false}
            loading={status('Loading the budget page…')} onRenderTextLayerSuccess={found} />
        </Document>
      )}
    </div>
  )
}
