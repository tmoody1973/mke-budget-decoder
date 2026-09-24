// The City Receipt's frame: a marigold band holding a sheet of receipt paper with torn edges.
// The one place the site uses a second color (DESIGN.md, City Receipt exception); content stays
// on paper so text, marks and links keep their contrast. It stays a paper receipt in the dark theme too.
export function ReceiptBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-object bg-band px-3 py-5 sm:px-6 sm:py-7">
      <div aria-hidden className="torn-top" />
      <div className="bg-receipt px-4 py-5 sm:px-6">{children}</div>
      <div aria-hidden className="torn-bottom" />
    </div>
  )
}
