import type { Metadata } from 'next'

import { ReceiptFinder } from '@/components/receipt/receipt-finder'

export const metadata: Metadata = {
  title: 'Your City Receipt · MKE Budget Decoder',
  description: 'What the city charges your Milwaukee home under the Mayor’s proposed 2027 budget, with every rate cited to its page.',
}

export default function ReceiptPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      <h1 className="text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">
        Your City Receipt
      </h1>
      <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink">
        What the city would charge your home under the Mayor’s proposed 2027 budget, compared with 2026: property tax,
        garbage, snow, street lights and sewer. Every rate links to the budget page it comes from.
      </p>
      <div className="mt-10">
        <ReceiptFinder />
      </div>
    </main>
  )
}
