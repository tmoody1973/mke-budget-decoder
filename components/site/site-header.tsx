'use client'
// Sticky site header (2026-09-23): site pages and the Ask button stay in reach while scrolling.
// Wide screens show the links inline; phones get a menu button that opens a stacked list, which on
// the Overview also carries the page's section links ("On this page").
import { Menu, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AskButton } from '@/components/chat/chat-shell'
import { OVERVIEW_SECTIONS, PAGES } from '@/lib/site-nav'

export function SiteHeader() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const link = (href: string, label: string, cls: string) => (
    <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={path === href ? 'page' : undefined}
      className={`${cls} ${path === href ? 'font-semibold text-ink no-underline' : 'text-ref underline underline-offset-4'}`}>{label}</Link>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper">
      <nav aria-label="Site" className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 text-ink no-underline">
          <Image src="/logo.png" alt="" width={40} height={40} priority className="size-9 sm:size-10" />
          <span className="text-[0.95rem] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[1.05rem]">Milwaukee<br />Budget Decoder</span>
        </Link>
        <span className="flex items-center gap-5">
          <span className="hidden items-center gap-5 text-sm md:flex">{PAGES.slice(1).map(([h, l]) => link(h, l, ''))}</span>
          <AskButton />
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-menu"
            aria-label={open ? 'Close the menu' : 'Open the menu'} className="-mr-2 grid size-10 place-items-center text-ink md:hidden">
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </span>
      </nav>
      {path === '/' && (
        <nav aria-label="Sections of this page" className="hidden border-t border-rule md:block">
          <ul className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-sm sm:px-6 lg:px-8">
            {OVERVIEW_SECTIONS.map(([h, l]) => (
              <li key={h}><a href={h} className="font-semibold text-ref underline underline-offset-4 hover:text-ink">{l}</a></li>
            ))}
          </ul>
        </nav>
      )}
      <div id="site-menu" hidden={!open} className="border-t border-rule px-4 pb-5 md:hidden">
        <ul className="divide-y divide-rule">
          {PAGES.map(([h, l]) => <li key={h}>{link(h, l, 'block py-3 text-base')}</li>)}
        </ul>
        {path === '/' && (
          <>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.06em] text-ink">On this page</p>
            <ul className="mt-1 divide-y divide-rule">
              {OVERVIEW_SECTIONS.map(([h, l]) => (
                <li key={h}><a href={h} onClick={() => setOpen(false)} className="block py-3 text-ref underline underline-offset-4">{l}</a></li>
              ))}
            </ul>
          </>
        )}
      </div>
    </header>
  )
}
