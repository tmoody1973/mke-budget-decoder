'use client'
// Theme choice in the site header: System, Light or Dark. A disclosure (like the phone menu) holding
// native radio buttons, so arrow keys and screen readers work without extra code (WCAG 2.1 AA).
import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

import { applyTheme, THEME_KEY, type ThemeChoice } from '@/lib/theme'

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'Match my device', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

const read = (): ThemeChoice => {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}
// The saved choice as an external store: "system" on the server, the real choice in the browser, and
// updates from other tabs (the storage event) or from this toggle (a local event).
const CHANGED = 'theme-choice'
const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGED, onChange)
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(CHANGED, onChange) }
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, read, () => 'system' as ThemeChoice)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // "Match my device" follows the system setting live, e.g. when macOS or Windows switches at sunset.
  useEffect(() => {
    applyTheme(choice)
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])

  const choose = (value: ThemeChoice) => {
    try { if (value === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, value) } catch { /* private window */ }
    applyTheme(value) // applies even when storage is blocked
    window.dispatchEvent(new Event(CHANGED))
  }

  const Current = OPTIONS.find((o) => o.value === choice)!.Icon
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={panelId}
        aria-label={`Theme: ${OPTIONS.find((o) => o.value === choice)!.label}`}
        className="grid size-10 place-items-center text-ink hover:text-ref">
        <Current aria-hidden className="size-5" strokeWidth={2} />
      </button>
      <div id={panelId} hidden={!open} className="absolute right-0 top-full z-40 mt-2 w-52 border border-ink bg-paper p-3 text-sm text-ink">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.06em]">Theme</legend>
          {OPTIONS.map(({ value, label, Icon }) => (
            <label key={value} className="mt-1 flex cursor-pointer items-center gap-2.5 py-1.5">
              <input type="radio" name={`${panelId}-theme`} value={value} checked={choice === value} onChange={() => choose(value)}
                className="size-4 accent-[var(--ref)]" />
              <Icon aria-hidden className="size-4 text-ink-soft" strokeWidth={2} />
              <span className={choice === value ? 'font-semibold' : ''}>{label}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  )
}
