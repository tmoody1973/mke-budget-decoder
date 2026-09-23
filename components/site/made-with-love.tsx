// "Made with ♥ by Tarik Moody", the name linking to his LinkedIn. The heart is drawn like the logo, navy outline with a marigold fill.
import { Heart } from 'lucide-react'

export function MadeWithLove({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      Made with
      <Heart role="img" aria-label="love" className="size-[1.05em] shrink-0 fill-band text-ink" strokeWidth={2.25} />
      by{' '}
      <a href="https://www.linkedin.com/in/tarikmoody" target="_blank" rel="noopener noreferrer"
        className="text-ref underline underline-offset-4">Tarik Moody</a>
    </span>
  )
}
