'use client'
// Save or share the receipt as a 1080x1350 picture. The server redraws it from the same request the
// screen used (/api/receipt/image), without the address. Phones get the share sheet (Instagram,
// messages); computers download the file.
import { useState } from 'react'

const FILE = 'my-milwaukee-city-receipt-2027.png'

export function ShareImage({ body }: { body: Record<string, unknown> }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')

  async function run() {
    setState('working')
    try {
      const res = await fetch('/api/receipt/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(String(res.status))
      const file = new File([await res.blob()], FILE, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ files: [file], title: 'My Milwaukee city receipt' }).catch(() => {}) // closing the sheet is not an error
      } else {
        const url = URL.createObjectURL(file)
        const a = Object.assign(document.createElement('a'), { href: url, download: FILE })
        a.click()
        URL.revokeObjectURL(url)
      }
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="mt-6">
      <button type="button" onClick={run} disabled={state === 'working'}
        className="border-2 border-ink bg-ink px-5 py-3 font-semibold text-paper hover:border-ref hover:bg-ref disabled:opacity-60">
        {state === 'working' ? 'Making your image…' : 'Save or share as an image'}
      </button>
      <p className="mt-2 text-sm text-ink-soft">
        {state === 'error' ? 'The image didn’t work this time. Try again in a minute.' : 'A receipt-style picture for social media. It leaves out your address.'}
      </p>
    </div>
  )
}
