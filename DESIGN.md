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
---

# Design System: MKE Budget Decoder

## Overview

**Creative North Star: "The Blue Book Table"**

The system is a Wisconsin Blue Book statistical table set for a phone: exact figures in ruled columns on white paper, navy ink, and one reference blue that only ever means "this points somewhere." Every surface is a single column of type and hairlines. There are no containers to look at, only numbers to read and footnotes that prove them.

Density is roomy rather than governmental: rows breathe (12px vertical padding), labels are plain words, and one table does the work that a dashboard would spread across a grid of cards. The world was built first on the City Receipt (`/receipt`) and is the incumbent for every new surface.

It deliberately refuses the card-grid civic dashboard, the dense government form, the fintech ad and the campaign flyer. Authority comes from ruling, alignment and citation, not from color, depth or decoration.

**Key Characteristics:**
- White paper, navy ink, one reference blue, one pale rule gray, one highlight wash.
- Hairline row rules between heavy 2px head and total rules.
- Tabular lining figures, right-aligned, amounts set larger than their labels.
- Numbered sources and lettered notes, in reading order, each with a "Used for" back-link.
- Flat: no cards, no shadows, no rounded pills.
- One motion: the footnote highlight fade.

## Colors

A near-monochrome navy-on-white almanac palette with a single blue reserved for reference.

### Primary
- **Almanac Navy Ink** (`ink`, about #1B2A4A): all primary text, figures, table head and total rules, the underline of input fields, the selected Own / Rent option and the primary button fill. It is both the text color and the rule color; the page is printed in one ink.

### Secondary
- **Reference Blue** (`ref`, about #3C6FB0): footnote source numerals, "Used for" back-links, the focus ring, the caret, the focused underline of fields, and the primary button hover. Nothing decorative is ever blue.

### Neutral
- **Offset Paper** (`paper`, white): the only ground. Also the text color on ink-filled controls.
- **Soft Ink** (`ink-soft`): secondary text (hints, 2026 comparison amounts, change column, lettered notes, assessed-value lines). Kept at or above 4.5:1 on paper.
- **Rule Gray** (`rule`, about #D9DEE7): 1px hairlines between table rows and between suggestion list items. Also the shadcn `--border` token.
- **Highlight Wash** (`mark`): the footnote/row highlight, the active suggestion row, and `::selection`. A pale tint of the reference blue, never a fill for resting content.

### Named Rules
**The One Ink Rule.** Text and structural rules share the same navy. Hierarchy comes from weight, size and rule thickness, not from extra colors.

**The Reference Blue Rule.** Blue means "this points to a source or takes you somewhere" (marks, links, focus, caret). If a blue element does not navigate or indicate focus, it is wrong.

## Typography

**Body Font:** Libre Franklin (via `next/font`, exposed as `--font-franklin`, with ui-sans-serif and system-ui fallbacks)
**Display Font:** the same family at heavy weights
**Label/Mono Font:** none distinct; labels are Franklin in small uppercase

**Character:** Franklin Gothic is the face of American statistical almanacs; Libre Franklin is its open revival. One family carries everything, from an 800-weight title to 0.7em superscripts.

### Hierarchy
- **Display** (800, 2.1rem rising to 3rem at 640px, line-height 1.08, -0.02em): the page title only. Directly below it sits a lead paragraph; there is no kicker above it.
- **Figure** (700, 3rem, -0.02em, tabular lining): the single headline amount of a result (the 2027 estimate), followed by a 1.125rem medium soft-ink unit ("a year", "a month").
- **Headline** (700, 1.25rem, -0.01em): section heads inside a result ("Where the 2027 city property tax goes").
- **Body lead** (400, 1.125rem, relaxed 1.625, max 60ch): the page's introductory paragraph and the address field's typed text.
- **Body** (400 / 600, 1rem): control labels, the change sentence, status and error lines. Errors are semibold ink, not red.
- **Table** (400, 0.95rem, tabular lining): row labels. **Amount** (1.05rem): figure cells, semibold for the proposed column and for totals; the table's grand total cell steps to 1.125rem bold.
- **Small** (400, 0.875rem, relaxed): hints, assessed-value lines, sources and notes.
- **Label** (600, 0.75rem, uppercase, 0.06em tracking): table column heads and the "Sources" / "Notes" heads. These label structure below content; they never sit above a title as a kicker.

### Named Rules
**The Tabular Figures Rule.** Every element that contains money, counts or percentages carries `tabular-nums lining-nums` (the `.tabular` class), and figure columns are right-aligned.

**The Amount Outranks Label Rule.** An amount is always set larger (1.05rem vs 0.95rem) or heavier than the label beside it. The reader's eye lands on the number, then reads what it is.

## Layout

A single reading column, `max-width: 42rem`, centered, with 16px side gutters on phones and 24px from 640px. Top padding is 40px (64px from 640px) and 96px at the bottom. Blocks stack with 32–48px between major parts (field to control 32px, control to result 40px, table to next section 48px).

Tables are full column width. On phones they show three columns (label, 2026, 2027); the Change column appears from 640px. Row cells use 12px vertical padding, 12px (16px from 640px) left padding on figure columns. Column heads may break onto two lines ("2026 / adopted") so figure columns stay narrow.

A label's last word is kept on the same line as its footnote marks (`whitespace-nowrap` tail), so a mark never begins a line.

## Elevation & Depth

Completely flat. There are no shadows anywhere, and no surface sits above another except the address suggestion list, which is drawn as paper with ink side and bottom rules, not lifted. Structure is conveyed by rule weight: 1px rule-gray hairlines between rows, 2px ink rules above and below table heads, totals and the footer. State is conveyed by fills (ink fill for selected, the mark wash for highlighted), and a stale result is dimmed to 50% opacity while its replacement loads.

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
- **Do** keep brand colors and the font as tokens in `app/globals.css` and `app/layout.tsx` only, so branding can be swapped later.

### Don't:
- **Don't** use cards, shadows, tinted panels or rounded pills.
- **Don't** put a kicker or eyebrow above a title; the page opens with the title.
- **Don't** use reference blue for anything that is not a link, mark, caret or focus state.
- **Don't** add a second accent color, including red or green for up and down; change is stated in words and a signed figure.
- **Don't** add motion beyond the highlight fade.
