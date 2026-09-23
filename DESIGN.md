---
name: MKE Budget Decoder
description: The City of Milwaukee 2027 proposed budget, explained, with every number cited to its page.
colors:
  paper: "oklch(1 0 0)"
  ink: "oklch(0.29 0.06 262)"
  ink-soft: "oklch(0.42 0.045 262)"
  ref: "oklch(0.52 0.12 255)"
  rule: "oklch(0.9 0.012 262)"
  mark: "oklch(0.95 0.035 255)"
  fund: "oklch(0.88 0.045 255)"
typography:
  display:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.1rem (3rem from 640px)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum, lnum"
  score:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem (2.25rem from 1024px)"
    fontWeight: 700
    letterSpacing: "-0.01em"
    fontFeature: "tnum, lnum"
  headline:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body-lead:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  table:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    fontFeature: "tnum, lnum"
  amount:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    fontFeature: "tnum, lnum"
  small:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  none: "0px"
spacing:
  gutter: "16px"
  gutter-wide: "24px"
  row: "12px"
  block: "32px"
  section: "40px"
  chapter: "48px"
  measure: "42rem"
  band: "64px"
  page-wide: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.ref}"
    textColor: "{colors.paper}"
  segmented-option:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 0"
  segmented-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  input-underline:
    textColor: "{colors.ink}"
    typography: "{typography.body-lead}"
    rounded: "{rounded.none}"
    padding: "12px 0"
  suggestion-active:
    backgroundColor: "{colors.mark}"
    textColor: "{colors.ink}"
    padding: "12px"
  table-row:
    textColor: "{colors.ink}"
    typography: "{typography.table}"
    padding: "12px 0"
  footnote-mark:
    textColor: "{colors.ref}"
    size: "0.7em"
  note-mark:
    textColor: "{colors.ink-soft}"
    size: "0.7em"
  treemap-tile-levy:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "12px"
  treemap-tile-fund:
    backgroundColor: "{colors.fund}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px"
  chart-tooltip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px"
    width: "14rem"
  box-score-figure:
    textColor: "{colors.ink}"
    typography: "{typography.score}"
  show-table-summary:
    textColor: "{colors.ref}"
    typography: "{typography.small}"
---

# Design System: MKE Budget Decoder

## Overview

**Creative North Star: "The Blue Book Table"**

The system is a Wisconsin Blue Book statistical table set for a phone: exact figures in ruled columns on white paper, navy ink, and one reference blue that only ever means "this points somewhere." Reading surfaces are a single column of type and hairlines; the wide dashboard is columns of the same, divided by hairlines. There are no containers to look at, only numbers to read and footnotes that prove them.

Density is roomy rather than governmental: rows breathe (12px vertical padding), labels are plain words, and one table does the work that a dashboard would spread across a grid of cards. The world was built first on the City Receipt (`/receipt`) and is the incumbent for every new surface. The Overview dashboard (`/`) extends it to a wide page without leaving it: the same paper, ink and rules, arranged as a newspaper front page (a lead chart, a box score beside it, standings and movers below), with charts drawn as ruled almanac figures rather than dashboard widgets.

It deliberately refuses the card-grid civic dashboard, the dense government form, the fintech ad and the campaign flyer. Authority comes from ruling, alignment and citation, not from color, depth or decoration.

**Key Characteristics:**
- White paper, navy ink, one reference blue, one pale rule gray, one highlight wash, and one chart fill (Fund Blue) with a single meaning.
- Hairline row rules between heavy 2px head and total rules.
- Tabular lining figures, right-aligned, amounts set larger than their labels.
- Numbered sources and lettered notes, in reading order, each with a "Used for" back-link.
- Flat: no cards, no shadows, no rounded pills.
- Charts are ruled figures: opened by a 2px ink rule, zero-based, labeled in plain words, each with a "Show as table" disclosure.
- One motion: the footnote highlight fade.

## Colors

A near-monochrome navy-on-white almanac palette with a single blue reserved for reference.

### Primary
- **Almanac Navy Ink** (`ink`, about #1B2A4A): all primary text, figures, table head and total rules, the underline of input fields, the selected Own / Rent option and the primary button fill. It is both the text color and the rule color; the page is printed in one ink.

### Secondary
- **Reference Blue** (`ref`, about #3C6FB0): footnote source numerals, "Used for" back-links, the focus ring, the caret, the focused underline of fields, and the primary button hover. Nothing decorative is ever blue.

### Tertiary (chart fill)
- **Fund Blue** (`fund`): one meaning only, in charts: a budget section with no city property tax rate (paid from its own revenue). Always carries ink text, never paper text. Because it sits close to paper in lightness, every fund-blue shape (treemap tile, legend swatch) draws a 1px inset reference-blue ring so its edge meets non-text contrast. Sections with a tax rate are ink-filled; there is no third fill.

### Neutral
- **Offset Paper** (`paper`, white): the only ground. Also the text color on ink-filled controls.
- **Soft Ink** (`ink-soft`): secondary text (hints, 2026 comparison amounts, change column, lettered notes, assessed-value lines). Kept at or above 4.5:1 on paper.
- **Rule Gray** (`rule`, about #D9DEE7): 1px hairlines between table rows and between suggestion list items. Also the shadcn `--border` token.
- **Highlight Wash** (`mark`): the footnote/row highlight, the active suggestion row, and `::selection`. A pale tint of the reference blue, never a fill for resting content.

### City Receipt (the one exception)
- **Receipt Marigold** (`band`, about #FDBE45): the frame around the City Receipt lookup, on the Overview and on `/receipt`, and the background of the shareable receipt image. Nowhere else. It marks the one place on the site that is about *your* money (Tarik, 2026-09-23).
- **Receipt Paper** (`receipt`, about #FDFAF1): the warm sheet inside the marigold frame, with torn sawtooth edges top and bottom. All receipt content (text, marks, links, controls) sits on this paper, never directly on marigold, so contrast stays as on white paper.
- The shareable image (`app/api/receipt/image`) is a 1080x1350 thermal-receipt picture in IBM Plex Mono with hex twins of these tokens. It never shows an address or assessed value.

### Named Rules
**The One Ink Rule.** Text and structural rules share the same navy. Hierarchy comes from weight, size and rule thickness, not from extra colors.

**The Reference Blue Rule.** Blue means "this points to a source or takes you somewhere" (marks, links, jump-to links, the "Show as table" disclosure, focus, caret). If a blue element does not navigate, disclose or indicate focus, it is wrong. The single structural exception is the 1px inset ring that edges a Fund Blue shape.

**The One Meaning Rule.** Fund Blue means "no city property tax rate" and nothing else. Light blue is never reused for another series: decreases, prior-year (2026) comparison bars and other secondary marks use soft ink, and emphasis uses ink.

## Typography

**Body Font:** Libre Franklin (via `next/font`, exposed as `--font-franklin`, with ui-sans-serif and system-ui fallbacks)
**Display Font:** the same family at heavy weights
**Label/Mono Font:** none distinct; labels are Franklin in small uppercase

**Character:** Franklin Gothic is the face of American statistical almanacs; Libre Franklin is its open revival. One family carries everything, from an 800-weight title to 0.7em superscripts.

### Hierarchy
- **Display** (800, 2.1rem rising to 3rem at 640px, line-height 1.08, -0.02em): the page title only. Directly below it sits a lead paragraph; there is no kicker above it.
- **Figure** (700, 3rem, -0.02em, tabular lining): the single headline amount of a result (the 2027 estimate), followed by a 1.125rem medium soft-ink unit ("a year", "a month").
- **Score** (700, 1.875rem rising to 2.25rem at 1024px, -0.01em, tabular lining): the box-score figures on the dashboard, one per quoted number, each under a semibold 0.875rem label and above a soft-ink comparison line whose change phrase ("Up 8.9%") is semibold ink.
- **Headline** (700, 1.25rem, -0.01em): section heads inside a result ("Where the 2027 city property tax goes") and dashboard panel titles, which are full sentence-case questions or statements ("What the Mayor proposes to change most"), not labels.
- **Body lead** (400, 1.125rem, relaxed 1.625, max 60ch): the page's introductory paragraph and the address field's typed text.
- **Body** (400 / 600, 1rem): control labels, the change sentence, status and error lines. Errors are semibold ink, not red.
- **Table** (400, 0.95rem, tabular lining): row labels. **Amount** (1.05rem): figure cells, semibold for the proposed column and for totals; the table's grand total cell steps to 1.125rem bold.
- **Small** (400, 0.875rem, relaxed): hints, assessed-value lines, sources and notes.
- **Label** (600, 0.75rem, uppercase, 0.06em tracking): table column heads and the "Sources" / "Notes" heads. On phones, table heads drop to normal tracking so four-column tables fit 390px. These label structure below content; they never sit above a title as a kicker.
- **Chart text:** unit lines and axis captions at 0.75rem soft ink ("Millions of dollars"); bar value labels 0.75–0.875rem semibold ink, tabular.

### Named Rules
**The Tabular Figures Rule.** Every element that contains money, counts or percentages carries `tabular-nums lining-nums` (the `.tabular` class), and figure columns are right-aligned.

**The Amount Outranks Label Rule.** An amount is always set larger (1.05rem vs 0.95rem) or heavier than the label beside it. The reader's eye lands on the number, then reads what it is.

## Layout

A single reading column, `max-width: 42rem`, centered, with 16px side gutters on phones and 24px from 640px. Top padding is 40px (64px from 640px) and 96px at the bottom. Blocks stack with 32–48px between major parts (field to control 32px, control to result 40px, table to next section 48px).

Tables are full column width. On phones they show three columns (label, 2026, 2027); the Change column appears from 640px. Row cells use 12px vertical padding, 12px (16px from 640px) left padding on figure columns. Column heads may break onto two lines ("2026 / adopted") so figure columns stay narrow.

### Wide pages (the dashboard)
The Overview breaks out of the reading column to `max-width: 72rem` (the site header's nav matches it), with 16 / 24 / 32px gutters at phone / 640px / 1024px. From 1024px it is a 12-column grid in three bands, each band 64px below the last:
- **Lead:** the treemap panel over 8 columns, the box score over 4.
- **Inside columns:** departments over 7 columns; revenue then movers stacked over 5.
- **Taxes:** the levy-and-rate panel over 5 columns; the receipt lookup over 7.

Columns are divided by a 1px rule-gray vertical hairline with 32px padding on each side, never by gaps between boxes. Below 1024px every band stacks to one column, and the box score moves above the treemap so a phone reader gets the four quoted numbers first. The title and lead paragraph span the full width (lead max 78ch) above a jump-to row of reference-blue links. Sources and Notes follow all bands; the "How to use this" / "How this was built" footer closes the page in two columns from 640px under a 2px ink rule.

A label's last word is kept on the same line as its footnote marks (`whitespace-nowrap` tail), so a mark never begins a line.

## Elevation & Depth

Completely flat. There are no shadows anywhere, and no surface sits above another except the address suggestion list and the chart tooltip, both drawn as paper edged in ink (rules or a 1px border), not lifted. Structure is conveyed by rule weight: 1px rule-gray hairlines between rows, 2px ink rules above and below table heads, totals and the footer. State is conveyed by fills (ink fill for selected, the mark wash for highlighted), and a stale result is dimmed to 50% opacity while its replacement loads.

**The Ruled Not Raised Rule.** If something needs separating, rule it. Never add a shadow, a card, or a tinted panel.

## Shapes

Square corners throughout (0px). Buttons, the segmented control, the suggestion list and fields are rectangles; fields are not boxes at all but a single 2px underline. The only recurring geometry is the horizontal rule, in two weights. Footnote marks are superscript glyphs, not badges or pills.

## Components

### Buttons
- **Character:** a printed block of ink.
- **Shape:** square (0px), 2px ink border.
- **Primary:** ink fill, paper text, semibold, 12px 20px padding.
- **Hover / Focus:** fill and border switch to reference blue; focus shows the 2px reference-blue outline with 2px offset.

### Segmented Control (Own / Rent)
- **Style:** a two-column grid inside a 2px ink border, each option a full-width semibold label with 12px vertical padding.
- **State:** the selected option is ink-filled with paper text; unselected is ink on paper. The radio inputs are visually hidden; keyboard focus draws the reference-blue outline on the option label. Nothing is selected by default: the choice is asked, never assumed. Changing it re-sets the table in place, keeping the old result dimmed until the new one arrives.

### Inputs / Fields
- **Style:** no box, transparent background, a 2px ink bottom border, zero horizontal padding, 12px vertical padding. The address field sets text at 1.25rem; value fields at 1.125rem with tabular figures. Placeholder in soft ink at 80%.
- **Focus:** the underline turns reference blue and the global outline is suppressed, so an underline field shows only the underline.
- **Error:** a semibold ink sentence below the fields with `role="alert"`, written as an instruction ("Enter your 2026 assessed value in whole dollars, like 245,000.").

### Address Suggestions (combobox list)
- **Style:** absolutely positioned under the field, paper ground, 1px ink sides and a 2px ink bottom; items separated by rule-gray hairlines, 12px padding, a small soft-ink qualifier on the right ("3 condo units", "nearby").
- **State:** the keyboard-active item takes the mark wash. Empty and error states are plain sentences in the same list.

### Ruled Table (signature component)
- **Head:** 2px ink rules above and below; label typography (uppercase, 0.75rem, 0.06em).
- **Rows:** 1px rule-gray bottom hairline; row labels regular ink; the 2026 column in soft ink, the 2027 column semibold ink, change in soft ink with a signed figure.
- **Total:** 2px ink rules above and below; semibold label, the proposed total bold at 1.125rem. A second total row (per month) closes with its own 2px ink rule.
- **Anywhere:** a caption is always present for screen readers; the component has no hooks, so it renders identically outside the receipt (Explore pages, chat answers).

### Chart Panel (dashboard)
- **Opening:** a 2px ink top rule, then a bold sentence-case headline (1.25rem) and a one-line small caption saying what the marks encode, with its source mark. Never boxed, tinted or carded.
- **Grammar:** bars are zero-based; the unit is stated once in a right-aligned soft-ink line ("Millions of dollars, 2026 adopted to 2027 proposed"); values are printed beside the marks, so no gridlines or axes are needed. Every chart carries `role="img"` with a full-sentence label naming each value, and a "Show as table" disclosure behind it.
- **Show as table:** a native `details`/`summary` whose summary is semibold 0.875rem reference-blue underlined text with a reference-blue marker; opening it reveals the cited Ruled Table. The table is the chart's accessible version and carries the source marks.
- **Drawing:** Visx supplies layout math only (squarified treemap, linear scales); every mark is an HTML element positioned in percentages, so labels are real text that stays readable and wraps at any width.

### Budget Treemap (lead chart)
- **Tiles:** budget sections, squarified and sorted largest first, 8-unit inner gaps of paper between tiles. Ink fill with paper text for sections with a city property tax rate; Fund Blue with ink text and the 1px inset reference-blue ring for self-funded ones. Square corners.
- **Aspect:** 9:4 from 640px, 1000:1150 on phones; the two layouts are separate renders swapped by breakpoint.
- **Labels by size:** tiles are size containers, and container queries decide what fits: letter only (from 1.75rem square), then amount (from 4.5rem x 3rem), then "Letter. Short name" replacing the letter (from 5.5rem x 4.5rem), then share of all funds with a 1.75rem amount (from 12rem x 8.5rem). Tiles show short names; full names live in the tooltip, the key and the table.
- **Focus and tooltip:** every tile is focusable (`tabIndex=0`, full-sentence `aria-label`) with the focus outline drawn inset (-3px) so it shows against neighbors. Hover or focus reveals a 14rem paper tooltip with a 1px ink border and no shadow: full name, amount and share, and the tax-rate status in soft ink. It opens below or above, left- or right-aligned, to stay inside the chart.
- **Key:** under a two-swatch legend, a two-column list (one on phones) of letter (bold ink), full name (soft ink) and amount (ink, right-aligned), separated by rule hairlines. Zero-dollar sections are named in a line below as not shown.

### Box Score
- A definition list opened by a 2px ink rule, items divided by rule hairlines with 16px vertical padding: label, Score figure with its source mark, then the comparison line. Each item is a highlight target.

### Movers (diverging bars)
- One row per department on a rule hairline: short name in a 7.5rem (10rem from 1024px) column, then a bar growing from a 1px ink zero line. Increases are ink, decreases are soft ink, and the signed value sits at the bar's outer end; the scale keeps 14% margins each side for those labels. "Proposed decrease" and "Proposed increase" captions sit under the ends. Direction is carried by side and sign, never by red or green.

### Levy vs Rate (paired bars)
- Two small panels (side by side from 640px, stacked in the 5-column band until 1280px): a semibold title with its percentage change in soft ink, then a 2026 bar in soft ink over a 2027 bar in ink, each 20px tall, zero-based, scaled to at most 72% of the width so the value label fits after it.

### Label Bars (in tables)
- Revenue and section tables draw a 6px bar under each row label: an ink fill on a rule-gray track, proportional to the largest 2027 proposed row, noted in the unit line ("bars show 2027 proposed").

### Footnote Marks
- **Source mark:** a numbered superscript at 0.7em, semibold, reference blue, linking to `#fn-N`.
- **Note mark:** a lettered superscript at 0.7em, italic, soft ink, linking to `#note-x`.
- **Tap area:** the glyph stays small; an invisible 24px-tall hit area (7px above and below, 10px either side) sits around it. When a source mark is followed by a note mark, the two areas meet in the 3px gap between the glyphs instead of overlapping.
- **Highlight:** the targeted source, note or table row takes the mark wash and fades to paper.

### Sources and Notes (footer)
- **Style:** opens with a 2px ink rule and a semibold statement that the figures are an estimate of a proposal. Sources are an ordered list numbered in first-use order, the numeral in semibold reference blue; notes are lettered in reading order (heading note first, then rows top to bottom) with a semibold italic ink letter and soft-ink text.
- **Back-links:** every source and note ends with "Used for" followed by underlined reference-blue links to the rows that cite it, which fire the row highlight.

## Do's and Don'ts

### Do:
- **Do** separate content with rules: 1px `rule` hairlines between rows, 2px `ink` rules for heads, totals and the footer.
- **Do** set every figure with tabular lining numerals, right-aligned, and larger or heavier than its label.
- **Do** attach a numbered source mark to every figure row, and a lettered note wherever an assumption applies; list them in reading order with "Used for" back-links.
- **Do** give every mark an invisible 24px tap area, splitting the area at the gap when a source and note mark sit side by side.
- **Do** keep the global focus ring (2px reference blue, 2px offset) in the base layer so underline fields can opt out and show only the blue underline.
- **Do** use exactly one motion: `mark-fade` (1.6s, `cubic-bezier(0.16, 1, 0.3, 1)`) on a targeted footnote or row, with a static mark wash under `prefers-reduced-motion`.
- **Do** open every chart panel with a 2px ink rule and a sentence-case headline, start bars at zero, state the unit once, and put a "Show as table" disclosure behind every chart.
- **Do** let tiles show short names and put full names in the tooltip, key and table.
- **Do** keep brand colors and the font as tokens in `app/globals.css` and `app/layout.tsx` only, so branding can be swapped later.

### Don't:
- **Don't** use cards, shadows, tinted panels or rounded pills.
- **Don't** put a kicker or eyebrow above a title; the page opens with the title.
- **Don't** use reference blue for anything that is not a link, mark, disclosure, caret or focus state (the Fund Blue edge ring excepted).
- **Don't** reuse Fund Blue for any meaning but "no city property tax rate"; decreases and 2026 comparisons are soft ink.
- **Don't** draw chart labels inside SVG text or box a chart panel.
- **Don't** add a second accent color, including red or green for up and down; change is stated in words and a signed figure. The City Receipt's marigold frame is the single sanctioned exception; don't spread it to other panels.
- **Don't** add motion beyond the highlight fade.
