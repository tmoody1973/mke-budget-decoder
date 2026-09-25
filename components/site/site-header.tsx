'use client'
// Sticky site header (2026-09-23): site pages and the Ask button stay in reach while scrolling.
// Wide screens show the links inline; phones get a menu button that opens a stacked list, which on
// the Overview also carries the page's section links ("On this page"). On the Overview, phones also get a
// "You're in …" bar naming the current section (D26); tapping it opens that list.
import { Menu, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AskButton } from '@/components/chat/chat-shell'
import { currentSection, HERE_SECTIONS, OVERVIEW_SECTIONS, PAGES } from '@/lib/site-nav'

import { MadeWithLove } from './made-with-love'
import { ThemeToggle } from './theme-toggle'

// A heading counts as passed once it is in the top 30% of the window: below the sticky header, and
// below where an in-page jump parks it (scroll padding plus the heading's own margin).
const HERE_LINE = 0.3

/** The Overview section the reader is in, by heading position; null above the first heading. */
function useCurrentSection(on: boolean) {
  const [here, setHere] = useState<string | null>(null)
  useEffect(() => {
    if (!on) return
    const heads = HERE_SECTIONS.map(([h, l]) => [document.querySelector(h), l] as const)
    const update = () => setHere(currentSection(heads.map(([el, l]) => [l, el ? el.getBoundingClientRect().top : null] as const), innerHeight * HERE_LINE))
    let frame = 0
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => { cancelAnimationFrame(frame); removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll) }
  }, [on])
  return on ? here : null
}

export function SiteHeader() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const here = useCurrentSection(path === '/')
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
        <span className="mr-auto hidden border-l border-rule pl-4 text-xs text-ink-soft lg:block"><MadeWithLove /></span>
        <span className="flex items-center gap-5">
          <span className="hidden items-center gap-5 text-sm md:flex">{PAGES.slice(1).map(([h, l]) => link(h, l, ''))}</span>
          <AskButton />
          <ThemeToggle />
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
              <li key={h}><a href={h} aria-current={l === here ? 'location' : undefined}
                className={`font-semibold underline-offset-4 hover:text-ink ${l === here ? 'text-ink underline decoration-2' : 'text-ref underline'}`}>{l}</a></li>
            ))}
          </ul>
        </nav>
      )}
      {here && !open && (
        <button type="button" onClick={() => setOpen(true)} aria-controls="site-menu"
          className="flex w-full items-center justify-between gap-3 border-t border-rule bg-section-tint px-4 py-2 text-left text-sm md:hidden">
          <span className="min-w-0 truncate"><span className="text-ink-soft">You’re in </span><span className="font-semibold text-ink">{here}</span></span>
          <span className="shrink-0 font-semibold text-ref underline underline-offset-4">Jump to a section</span>
        </button>
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
                <li key={h}><a href={h} onClick={() => setOpen(false)} aria-current={l === here ? 'location' : undefined}
                  className={`block py-3 underline underline-offset-4 ${l === here ? 'font-semibold text-ink' : 'text-ref'}`}>{l}{l === here ? ' (you’re here)' : ''}</a></li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-5 border-t border-rule pt-4 text-sm text-ink-soft"><MadeWithLove /></p>
      </div>
    </header>
  )
}
