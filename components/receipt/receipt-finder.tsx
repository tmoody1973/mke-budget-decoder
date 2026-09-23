'use client'
// Address → pick → own/rent → receipt. Accessible combobox (WAI-ARIA 1.2 pattern): arrow keys move,
// Enter picks, Escape closes. Condo buildings route to a typed assessed value.
import { useEffect, useId, useRef, useState } from 'react'

import type { AddressMatch } from '@/lib/db/parcels'
import type { Receipt } from '@/lib/receipt'

import { ReceiptTable, type Entered, type ParcelInfo } from './receipt-table'

type View = 'owner' | 'renter'
type Target = { kind: 'parcel'; taxkey: string; address: string }
  | { kind: 'manual'; address: string; assessed2026: number; assessed2025?: number; buildingUnits: number }
type Result = { receipt: Receipt; parcel: ParcelInfo } | { error: string }

const post = async <T,>(url: string, body: unknown, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  const json = await res.json().catch(() => ({ error: 'Something went wrong. Try again.' }))
  return (res.ok ? json : { error: json.error ?? 'Something went wrong. Try again.' }) as T
}

export function ReceiptFinder() {
  const [q, setQ] = useState('')
  const [matches, setMatches] = useState<AddressMatch[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [condo, setCondo] = useState<AddressMatch | null>(null)
  const [view, setView] = useState<View | null>(null) // asked, never assumed (decision 2026-09-23)
  const [answer, setAnswer] = useState<{ key: string; targetKey: string; result: Result } | null>(null)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const text = q.trim()
    if (text.length < 3 || target?.address === q || condo?.address === q) return
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await post<{ results?: AddressMatch[]; error?: string }>('/api/address', { q: text }, ctl.signal)
        setSearchError(r.error ?? null)
        setMatches(r.results ?? [])
        setActive(-1)
        setOpen(true)
      } catch { /* aborted by the next keystroke */ }
    }, 220)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q, target, condo])

  // The receipt on screen belongs to one (target, view); anything else is still loading.
  const key = target && view ? JSON.stringify([target, view]) : null
  const result = answer && answer.key === key ? answer.result : null
  const loading = key !== null && result === null
  // Switching Own / Rent keeps the current receipt on screen, dimmed, until the new one arrives.
  const targetKey = target ? JSON.stringify(target) : null
  const stale = loading && answer && answer.targetKey === targetKey ? answer.result : null
  const entered: Entered = target?.kind === 'manual' ? { assessed2026: target.assessed2026, assessed2025: target.assessed2025 } : null

  useEffect(() => {
    if (!target || !view || !key) return
    let live = true
    const body = target.kind === 'parcel' ? { taxkey: target.taxkey, view }
      : { assessed2026: target.assessed2026, assessed2025: target.assessed2025, buildingUnits: target.buildingUnits, view }
    post<Result>('/api/receipt', body)
      .catch(() => ({ error: 'The receipt is unavailable right now. Try again.' }))
      .then((r) => { if (live) setAnswer({ key, targetKey: JSON.stringify(target), result: r }) })
    return () => { live = false }
  }, [target, view, key])

  function pick(m: AddressMatch) {
    setQ(m.address)
    setOpen(false)
    setView(null)
    if (m.taxkey) { setCondo(null); setTarget({ kind: 'parcel', taxkey: m.taxkey, address: m.address }) }
    else { setTarget(null); setCondo(m) }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const n = matches?.length ?? 0
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % n) }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); setActive((a) => (a <= 0 ? n - 1 : a - 1)) }
    else if (e.key === 'Enter' && open && active >= 0 && matches) { e.preventDefault(); pick(matches[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const showList = open && q.trim().length >= 3 && matches !== null && target?.address !== q && condo?.address !== q
  const address = target?.address ?? condo?.address

  return (
    <div>
      <label htmlFor="address" className="block text-base font-semibold text-ink">Milwaukee street address</label>
      <div className="relative mt-2">
        <input
          ref={inputRef} id="address" type="text" inputMode="text" autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby="address-hint"
          value={q} placeholder="e.g. 2401 W Wisconsin Ave"
          onChange={(e) => { setQ(e.target.value); if (target) setTarget(null); setCondo(null) }}
          onKeyDown={onKey} onFocus={() => matches && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          className="w-full border-0 border-b-2 border-ink bg-transparent px-0 py-3 text-xl text-ink placeholder:text-ink-soft/80 focus:border-ref focus-visible:outline-none"
        />
        <p id="address-hint" className="mt-2 text-sm text-ink-soft">City of Milwaukee addresses only. We don’t store what you type.</p>
        {showList && (
          <ul id={listId} role="listbox" aria-label="Matching addresses"
            className="absolute inset-x-0 top-[3.6rem] z-10 border-x border-b-2 border-ink bg-paper">
            {searchError && <li className="px-3 py-3 text-sm text-ink" role="option" aria-selected={false} aria-disabled>{searchError}</li>}
            {!searchError && matches.length === 0 && (
              <li className="px-3 py-3 text-sm text-ink" role="option" aria-selected={false} aria-disabled>
                No Milwaukee address matches. Check the spelling, or leave off the unit number.
              </li>
            )}
            {matches.map((m, i) => (
              <li key={`${m.address}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(m) }}
                className={`flex cursor-pointer items-baseline justify-between gap-3 border-t border-rule px-3 py-3 ${i === active ? 'bg-mark' : ''}`}>
                <span className="text-ink">{m.address}</span>
                <span className="shrink-0 text-xs text-ink-soft">
                  {m.parcels > 1 ? `${m.parcels} condo units` : m.exactNumber ? '' : 'nearby'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {condo && <CondoEntry match={condo} onSubmit={(a26, a25) => setTarget({ kind: 'manual', address: condo.address, assessed2026: a26, assessed2025: a25, buildingUnits: condo.parcels })} />}

      {address && target && (
        <fieldset className="mt-8">
          <legend className="text-base font-semibold text-ink">At {address}, I…</legend>
          <div className="mt-3 grid grid-cols-2 border-2 border-ink">
            {(['owner', 'renter'] as const).map((v) => (
              <label key={v} className={`cursor-pointer py-3 text-center font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ref ${view === v ? 'bg-ink text-paper' : 'text-ink'}`}>
                <input type="radio" name="view" value={v} checked={view === v} onChange={() => setView(v)} className="sr-only" />
                {v === 'owner' ? 'Own this' : 'Rent here'}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div aria-live="polite" aria-busy={loading}>
        {loading && !stale && <p className="mt-8 text-ink-soft">Working out the receipt…</p>}
        {stale && 'receipt' in stale && (
          <div className="opacity-50"><span className="sr-only">Updating the receipt…</span>
            <Outcome receipt={stale.receipt} parcel={stale.parcel} entered={entered} /></div>
        )}
        {!loading && result && 'error' in result && <p className="mt-8 font-semibold text-ink">{result.error}</p>}
        {!loading && result && 'receipt' in result && <Outcome receipt={result.receipt} parcel={result.parcel} entered={entered} />}
      </div>
    </div>
  )
}

function Outcome({ receipt, parcel, entered }: { receipt: Receipt; parcel: ParcelInfo; entered: Entered }) {
  if (receipt.kind === 'estimate') return <ReceiptTable receipt={receipt} parcel={parcel} entered={entered} />
  const text = {
    exempt: 'This property is exempt from property tax, so there’s no tax estimate to show.',
    state_assessed: 'The State of Wisconsin assesses this property (manufacturing), so the city file doesn’t have enough to estimate its tax.',
    no_assessment: 'The city’s property file shows no taxable assessment for this parcel, so there’s nothing to estimate.',
    no_dwellings: 'The city’s file lists no homes on this parcel, so there’s no renter’s share to show.',
  }[receipt.kind]
  return <p className="mt-8 border-y-2 border-ink py-4 text-lg text-ink">{text}</p>
}

function CondoEntry({ match, onSubmit }: { match: AddressMatch; onSubmit: (a26: number, a25?: number) => void }) {
  const [a26, setA26] = useState('')
  const [a25, setA25] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const num = (s: string) => Number(s.replace(/[$,\s]/g, ''))
  return (
    <form className="mt-8 border-t-2 border-ink pt-4" onSubmit={(e) => {
      e.preventDefault()
      const v26 = num(a26), v25 = a25.trim() ? num(a25) : undefined
      if (!Number.isInteger(v26) || v26 <= 0) return setErr('Enter your 2026 assessed value in whole dollars, like 245,000.')
      if (v25 !== undefined && (!Number.isInteger(v25) || v25 <= 0)) return setErr('The 2025 value should be whole dollars too, or leave it blank.')
      setErr(null)
      onSubmit(v26, v25)
    }}>
      <p className="text-ink">
        {match.address} has {match.parcels} condo units, and the city’s file doesn’t list unit numbers.
        Enter your unit’s assessed value from your tax bill instead.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">2026 assessed value
          <input inputMode="numeric" value={a26} onChange={(e) => setA26(e.target.value)} required
            className="tabular mt-1 w-full border-0 border-b-2 border-ink bg-transparent py-2 text-lg font-normal focus:border-ref focus-visible:outline-none" />
        </label>
        <label className="block text-sm font-semibold text-ink">2025 assessed value <span className="font-normal text-ink-soft">(optional)</span>
          <input inputMode="numeric" value={a25} onChange={(e) => setA25(e.target.value)}
            className="tabular mt-1 w-full border-0 border-b-2 border-ink bg-transparent py-2 text-lg font-normal focus:border-ref focus-visible:outline-none" />
        </label>
      </div>
      {err && <p className="mt-3 text-sm font-semibold text-ink" role="alert">{err}</p>}
      <button type="submit" className="mt-5 border-2 border-ink bg-ink px-5 py-3 font-semibold text-paper hover:bg-ref hover:border-ref">
        Show the estimate
      </button>
    </form>
  )
}
