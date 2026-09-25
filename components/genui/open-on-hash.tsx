'use client'
// When the address points at something inside a closed <details> (a source entry opened in a new tab,
// or a "Used for" link), open it so the target is visible, then let the browser scroll to it.
import { useEffect } from 'react'

export function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1))
      const el = id ? document.getElementById(id) : null
      let d = el?.closest('details')
      if (!el || !d) return
      while (d) { d.open = true; d = d.parentElement?.closest('details') ?? null }
      el.scrollIntoView({ block: 'center' })
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])
  return null
}
