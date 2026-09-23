---
version: 1
slug: "app-receipt-page-tsx"
primary_target: "app/receipt/page.tsx"
related_targets: []
---

# Surface brief: City Receipt (`/receipt`)

Scope and mode: Operate (the task: get an estimated city receipt for an address), with Read for the short explanations. Audience: Milwaukee residents on a phone from a news link; journalists checking figures. Success: address → pick → own/rent → 2026 vs 2027 city charges, the change, where the property tax goes, every number footnoted to its budget page, in under a minute. Must not feel like a fintech ad, a government form, a campaign, or a toy.

Unresolved: whether the receipt also lives inline on the Overview page (planned in D15); services-per-resident section not built yet.

## Direction contract

THESIS: The receipt as a Wisconsin Blue Book table: exact figures in ruled columns, every rate footnoted to its budget page. It refuses both the card-grid civic dashboard and the dense government form: roomy rows, plain words, one table doing all the work.

OWN-WORLD: White offset-paper ground; ink navy for text and rules; one reference blue only for footnote marks, links and focus; pale rule gray. Hairline horizontal rules, no cards, no shadows, no rounded pills. Tabular lining figures, right-aligned, amounts larger than labels. Footnote superscripts are the only ornament.

STORY: The visitor types an address, picks it, says whether they own or rent, and reads what the city charges in 2026 and in the Mayor's proposed 2027, what changed and why, and where the property tax goes. Any footnote opens its source page. They leave knowing it is an estimate of a proposal, not a bill.

FIRST VIEWPORT: At 390 px: a small-caps kicker and one-line title; the address field full width with suggestions directly under it. After a pick: the address line, an Own / Rent segmented control, then the table's total row set large first (2027 estimate, change vs 2026 as a signed figure with words), then the ruled 2026 | 2027 rows, then footnotes.

FORM: Blue Book statistical table; #1 on my ordered list (the pick card); seed key 7e429c2f. Signature interaction: tapping a footnote mark highlights its citation line and the row it belongs to; the Own / Rent control re-sets the table in place. Motion grammar: one short highlight fade, nothing else.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
