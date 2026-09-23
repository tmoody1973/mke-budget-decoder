# Plan — MKE Budget Decoder P0 + P1 (stop at P1.8 green + P1.9 report generated)

## Context

The 2027 Proposed budget (Summary 224 pp, Detailed 455 pp) has to become typed, cited data before any UI or agent exists (CLAUDE.md principles 1, 2, 6; docs/04 "build the pipeline before any UI"). This run delivers P0 (setup) and P1 through P1.9: every table in docs/02 §8 extracted to `data/processed/`, the narrative chunker finished, the reconciliation suite (G1–G20 + structural sums + Summary↔Detailed cross-checks) green, and a human-review HTML report generated for Tarik to spot-check. **Not in this run:** P1.10 (Voyage embeddings / DB load), anything in P2+. Nothing is pushed to GitHub or deployed.

What I verified before planning (not assumed):
- Detailed BMD-2 header columns match docs/02 §3 exactly on PDF pages 3, 121, 301, 401 (e.g. ACCOUNT x0=148, proposed DOLLARS x1=750). Footer on 450/455 pages: `<DEPT> <page id> 3rd Run 9/14/26`. 49 section prefixes (110 Administration … 590 Settlement); `420` = Detailed-side GCP total, `430` = detailed revenue listing.
- Rollup rows carry account codes (`006000 NET SALARIES & WAGES TOTAL*`, `006100` fringe, `006300`, `006800`), so "has an account code" ≠ line item.
- Position lines: title with footnote markers `(X)(Y)(J)`, pay range, units+dollars, blank cells meaningful. Footnote definitions appear lower on the page.
- Summary p.7 prints its own rounding inconsistencies (Contingent rate $0.11→$0.11 shown as "$-0.01"; levy rate change "$-0.33" in subtotal vs "$-0.32" in total). Store as printed; log.
- Police Summary p.116 matches G13 exactly; services table uses "-" for empty → NULL.
- **Reusable code exists in `~/Documents/Projects/mke-budget-commons`, not Budget Compass** (Budget Compass extracts via an LLM — violates principle 1, not ported). `parsers/city_detailed.py` already has a `REQUESTED_LAYOUT` for the 2027 Requested book with the same 7 value columns incl. 2027 proposed. docs/02 §9's "70% empty-cell filter" does not exist in either repo → logged as a spec correction.
- CopilotKit (8) and OpenUI skills are already installed globally in `~/.claude/skills`.

## Tarik's decisions (2026-09-22)
- **Neon:** create a free-tier Neon project with pgvector now and run the migration in P0.3. Connection string goes in `.env.local` only (gitignored).
- **Session:** this plan runs in a **new** agit session, `tmoody1973/mke-budget-decoder@2026-09-22`, not in the planning session (which was recorded to kaziva). The new session starts by reading CLAUDE.md, this file, and the mke-budget-commons files named below, then begins at P0.1.
- **Mode:** ship straight through, with two Socratic stops of one question each. Stop 1 is before writing the P1.3 hierarchy and double-counting logic: ask Tarik how he'd stop the BCU summary block from being counted twice. Stop 2 is before P1.8: ask what a cross-document mismatch would mean, a parser bug or a document error, and how he'd tell which. After each answer, confirm and move on without re-quizzing.

## P0 — Setup

| ID | Work | Notes |
|---|---|---|
| P0.1 | Next.js (App Router, TS strict, Tailwind, shadcn), pnpm, Vitest, Playwright. `pipeline/` as a uv project, Python **3.12** pinned, pytest, pdfplumber, pandas, pyarrow, pyyaml. | `create-next-app` refuses a non-empty dir → scaffold in scratchpad, move files in. Minimal: no sample pages beyond the default. |
| P0.2 | Skills already installed; re-run both install commands to confirm current versions, **read** `openui` + `copilotkit-setup`/`-agui` SKILL.md and note anything that affects the schema (e.g. OpenUI `Query` result shape needing `citations`). | No CopilotKit/OpenUI code written in this run. |
| P0.3 | Drizzle schema for every table in docs/02 §4 + docs/05 additions + `concepts`, `dept_crosswalk`, `position_lines`; `budget_versions` FK everywhere. `drizzle-kit generate` produces SQL migration. | Create Neon project `mke-budget-decoder` (free tier), enable `vector` extension, apply migration. Confirm the project name with Tarik right before creating it (external resource). |
| P0.4 | PDFs already in `data/raw/`; decisions.md/open-questions.md exist. Add `.gitignore` (review PNGs, `.env*`, node_modules, .venv). | |

Done when: `pnpm dev` serves, `cd pipeline && uv run pytest` runs, migration applies (or is generated, per your answer).

## P1 — Data pipeline

Layout: `pipeline/extract/*.py` (one module per output), `pipeline/common/` (pdf word helpers, money/number parsing, citation builder, `budget_version` config), `pipeline/data/departments.yaml` (hand-curated), outputs to `data/processed/*.parquet|.jsonl|.json`. One entrypoint `uv run python -m extract.all`.

### P1.3 Detailed BMD-2 parser (`extract/detailed_lines.py`) — port, don't rewrite
Port from `mke-budget-commons/parsers/city_detailed.py`: `Layout`/`Column` dataclasses, `derive_bands` (per-page DOLLARS/UNITS header x1 anchors), `_nearest` (assign right-aligned numbers by x1), `_merge_split_numbers`, `parse_amount` (parens → negative), `classify`, `_join_wrapped_positions`, `SECTION_HEADERS`/`_SECTION_AFTER_ANCHOR`, `FOOTNOTE_RE`; and `reconcile_city.py`'s `reconcile_unit` pattern + `crosswalks/source_inconsistencies.yml` mechanism (a printed-total error is only suppressed if both printed and summed values still match the recorded ones).

Changes for this document:
1. `PROPOSED_LAYOUT` based on `REQUESTED_LAYOUT` (same 7 columns), zone limits re-measured on this PDF; assert per page that derived anchors are within ±2 pt of docs/02 §3 table, else fail loudly.
2. **Rows keyed by the printed line number (1–26)** in the left margin, not by `round(top/3)` buckets: each numbered line is an anchor; words within ±4 pt of its `top` join it. Gives `line_no` for citations for free (G20 is "110.1 line 10").
3. Footer → `dept`, `printed_page` (`110.1`), `run_label`; `pdf_page` from index.
4. Row types → columns on `line_items`: `row_type` ∈ {heading, account, rollup (reserved `00xxxx` codes + TOTAL/Total Before Adjustments/SPECIAL FUNDS-with-values), count (positions/FTE rows), position, adjustment, deduction, note}; `is_subtotal`, `is_position`, `is_deduction`, `footnote_flag` (asterisk stripped, raw kept), `note` attached to the preceding line.
5. **Hierarchy** as a stack carried across pages within a section: dept → BCU → `(SUMMARY 1 BCU=n DU)` block vs each decision unit → category. Store `hierarchy_path` plus `block` ∈ {bcu_summary, decision_unit}. This is what prevents double counting: the BCU summary block restates its decision units.
6. Values: integer dollars, `Decimal` units; blank → NULL, never 0.
7. Position lines also written to `position_lines` (title, footnote codes, pay range, units/dollars per stage).
Scope: all 450 footer pages, incl. capital (480), revenue listing (430), special funds (510–590). Non-BMD-2 pages (610 borrowing, 620 clarification) are detected and skipped with a logged count.

### P1.1 / P1.2 / P1.4 Summary tables (`extract/summary_tables.py`)
Coordinate parsing with pdfplumber words (not regex over text, per docs/02 §2): column anchors from each table's header row, labels from the left band, numbers by x1.
- p.7 `section_totals` (A–N × budget/non_levy/levy + rates, as printed incl. the rounding quirks); p.8–10 comparisons; p.13 `positions_summary`; p.14–16 FTE tables.
- Department template: pages found by title → `departments.yaml` slug (DPW's three "DEPARTMENT OF PUBLIC WORKS" pages disambiguated by division name on the page; continuation pages follow the running header). Emits `dept_summary` (metrics per docs/02 §4), `services` (wrapped descriptions reassembled by vertical proximity; "-" → NULL), `kpis` (labels as printed: 2024 Actual / 2025 Projected / 2026 Planned), `capital_projects` (name + amount parsed from bullet text), `position_changes` (wrapped reasons joined).
- P1.4 `revenues`: Source of Funds p.156–161 + Detailed 430.x listing + special revenue fund lines (e.g. Transportation p.190).

### P1.5 Narrative chunker — extend `pipeline/extract/narrative_chunks.py` (keep pdftotext flow mode)
Per docs/06 §10, in place, keeping its structure:
1. Replace raw page-title `dept` with slug lookup from `departments.yaml` (handles "DEPARTMENT OF PUBLIC WORKS – INFRASTRUCTURE SERVICES DIVISION" variants).
2. Special-revenue-fund pages with `dept=None` → assign by Summary page range from `dept_crosswalk`.
3. Prose-with-subheadings (DCD, DPW-ISD, Administration): short Title-Case lines ending without punctuation become `heading` instead of being merged.
4. Add `parent_section_id`, `linked_tables`; `budget_version` from config (not hard-coded).
5. Table cards (one per extracted dept_summary/services/kpis/position_changes table and section-level table, naming the future tool, e.g. `get_department('police')`) and chart cards (the five charts in docs/02 §6, "underlying data not in document text").
6. Small correctness fixes found on read: module-global `CURRENT_PAGE` → pass page explicitly; `l_is_title`/dead `pass` branch removed; write to `data/processed/chunks.jsonl`.
7. Emit `dept_crosswalk.json` (summary PDF page range, detailed prefix, org codes, fund codes — org/fund codes collected from `line_items`).
Tests: Police = 18 service-highlight chunks + 3 capital-project chunks on p.117–119; every department-region chunk has a slug; chunk sizes within docs/06 bounds; total ≈ 225 prose chunks + cards.

### P1.5b Concept index (`extract/concepts.py`)
Distinct accounts (~216), position titles (~1,500), org/program headings (~500), capital + revenue line names from `line_items`, each with `dept_ids` and `code`. Glosses: I draft account glosses in `pipeline/data/account_glosses.yaml` (flagged unreviewed). Position-title glosses need a Haiku batch job (API key + cost) → left empty and tracked in open-questions for P1.10/P3. No embeddings.

### P1.6 / P1.6b / P1.7 Hand-curated data (all drafted by me, each row `reviewed_by: null` until you review)
- `departments.yaml`: slug, name, short name, section, parent (DPW divisions), aliases ("MPD", "911", "DPW", "sanitation", "MPL", "DNS", "DCD", "MFD"…), detailed prefix.
- `fees.yaml` from p.159/p.203 (seed values in docs/05, verified against the page text before writing).
- `budget_facts.yaml`: Act 12, ERIP, recruit classes, SRO mandate, reserves, deadlines, survey; plus every narrative-vs-table pair found (docs/06 §7, e.g. "$33.5M" p.5 vs $32.1M p.8).
- `reason_category` rule-based classifier (keywords → vacant_elimination | arpa_sunset | grant_change | reclassification | new_funded | transfer | contract_to_city | other) with unit tests on real reason strings.
- `glossary.yaml`: ~40 terms, plain language, each with a page citation.

### P1.8 Reconciliation suite (`pipeline/validate/`) — tests written first (RED), then extractors make them GREEN
- `test_golden.py`: G1–G20 parametrized, asserting against the extracted parquet (G18/G19 compare the exact Source-of-Funds figure rounded to the printed $0.1M, and assert the narrative wording separately).
- `test_structural.py`: section A–F sum = subtotal; A–N = total; per decision unit, account lines = category rollup per stage (ported `reconcile_unit`); BCU summary block = sum of its decision units; `420` GCP total = G2.
- `test_crossdoc.py`: Summary `dept_summary.total_expenditures` = Detailed dept total, per stage, per department; Summary p.13 positions = Detailed `TOTAL NUMBER OF POSITIONS AUTHORIZED`.
- Real source-document arithmetic errors go in `pipeline/data/source_inconsistencies.yaml` with both values; a test that can't pass because of the document is never loosened or skipped silently.
- Plus unit tests for the parsers (number parsing, row classification, band derivation) against fixed page fixtures.
Target: 100% of golden + structural + cross-doc checks green.

### P1.9 Human-review report (`pipeline/review/build_report.py`)
Static `data/review/index.html` (gitignored): per department and per section-level table, the extracted table beside a crop of its source page, rendered with pdfplumber's page renderer (no new dependency), plus a reconciliation status panel and every logged inconsistency. I generate it and open it; **you** do the spot-check.

## Working agreements for this run
- Branch `p1-pipeline` off `main`; small local commits tagged with milestone IDs (`P1.3: detailed line parser`). No `git push`, no deploy.
- Decisions written to `docs/decisions.md` (project's decision log) using the full decision format; spec gaps to `docs/open-questions.md`; dated entries in `docs/LEARNING-LOG.md`. "What actually happened" left blank for you.
- CI: repo has no GitHub remote yet, so I'll add `.github/workflows/ci.yml` (pytest reconciliation + typecheck + build) but can't prove it red/green until there's a remote — flagged, not claimed.

## Verification (end-to-end)
1. `cd pipeline && uv run python -m extract.all` rebuilds every output from the two PDFs.
2. `cd pipeline && uv run pytest -q` → all golden, structural, cross-doc and unit tests pass; output pasted in the final report.
3. Prove the suite bites: change one golden value temporarily, watch it go red, revert.
4. `pnpm dev` serves; `pnpm test` runs; migration applies (or is generated).
5. `data/review/index.html` generated and opened; row/table counts reported.
6. Final report lists what I did NOT verify (e.g. crops I didn't eyeball, glosses unreviewed).

## Acceptance checklist (ISC)
P0: Next app serves · TS strict on · pipeline uv project on 3.12 · pytest runs · Drizzle schema covers every docs/02 §4 table · every table has budget_version_id · migration generated · (migration applied if Neon approved) · skills read.
P1.3: anchors within ±2 pt on every BMD-2 page · every line has pdf_page, printed_page, line_no · blanks stored NULL · parens negative · rollups flagged is_subtotal · BCU summary block tagged · position_lines populated · non-BMD-2 pages skipped and counted.
P1.1/2/4: section_totals A–N · positions_summary · every dept in departments.yaml has a dept_summary · DPW divisions distinct · services "-" → NULL · KPI labels as printed · capital amounts parsed · position reasons unwrapped · revenues incl. p.190.
P1.5: dept slugs on all dept chunks · fund pages mapped · subheadings as heading · parent_section_id + linked_tables · table cards · 5 chart cards · Police 18 + 3 · crosswalk emitted.
P1.5b–P1.7: concepts ~2,300 · account glosses drafted · departments + aliases · fees verified on page · budget_facts drafted · reason_category tests pass · ~40 glossary terms cited.
P1.8: G1–G20 each green · structural sums green · cross-doc green · red-proof done.
P1.9: report generated · every dept present · reconciliation panel present.
Anti: no number typed by hand into outputs except hand-curated YAML with citations · no LLM touches numbers · no push/deploy · no P2 work.
