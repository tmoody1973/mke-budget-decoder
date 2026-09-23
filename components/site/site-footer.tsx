// Site-wide footer: the credit, the method page, and a plain statement of what this site is not.
import Link from 'next/link'

import { MadeWithLove } from './made-with-love'

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <MadeWithLove className="font-semibold text-ink" />
        <p>
          An independent guide, not an official City of Milwaukee website.{' '}
          <Link href="/how-it-works" className="text-ref underline underline-offset-4">How it works</Link>
        </p>
      </div>
    </footer>
  )
}
