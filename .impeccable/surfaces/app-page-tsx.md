---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Surface brief: Overview dashboard (`/`)

Scope and mode: Operate (scan the budget at a glance, then drill into tables), with Read for the one-line explanations. Audience: residents on a phone from a news link; journalists and council staff on a laptop. Success on a laptop: the whole budget legible in one screen (where it goes, the headline numbers), with departments, revenue, biggest changes and the tax lookup one scroll below, every figure cited. Must not feel like a fintech ad, a government form, a campaign or a toy. World: Blue Book Table (DESIGN.md), unchanged.

Unresolved: department detail pages (later P2); related news stories (none sourced; never fabricated).

## Direction contract

THESIS: A newspaper front page for the budget: one lead chart carries the story, a box score beside it gives the four numbers people quote, and the inside columns are standings and movers. It refuses the uniform card grid of civic dashboards and the single scrolling column of the previous page.

OWN-WORLD: White paper, navy ink, one reference blue, pale rules (DESIGN.md). Columns divided by hairline vertical rules, panels opened by a 2px ink rule and a small uppercase label, never boxed. The treemap uses two families only: navy for sections paid for partly by property tax, a light blue tint for self-funded sections. Tabular Libre Franklin figures everywhere.

STORY: The visitor sees how big the proposal is and where it goes, reads the four headline numbers, then scans where the money comes from, which departments asked for more than they got, and what moved most. They can look up their own address, and any figure leads to its budget page.

FIRST VIEWPORT: At 1440 x 900: title and one-line summary across the top with a jump-to row; below, a two-thirds-width treemap of the 2027 budget by section with its legend, and a one-third box score column (all funds, general city purposes, property tax levy, tax rate), each with its 2026 comparison and source mark. On a phone the box score comes first, then the treemap.

FORM: Front-Page Broadsheet; #5 on my ordered list of seven structures; seed key c3a65e2f. Signature interaction: every chart has a "Show as table" disclosure that swaps in the cited table, and hovering or focusing a treemap block names the section, amount and share. Motion grammar: the existing single highlight fade for source marks; nothing else moves.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
