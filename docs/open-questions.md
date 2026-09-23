# Open questions

(Claude Code: add questions here instead of guessing.)

## 2026-09-22 — P0

- **docs/02 §9 is wrong about Budget Compass.** It extracted with an LLM (Bedrock Nova), not pdfplumber; the "~70% empty-cell filter" and `extract_tables()`+text combination don't exist in it or in mke-budget-commons. Its Milwaukee data is the **2026 Proposed** book (no page citations), so it cannot cross-check our "2026 Adopted" column. Conservative choice: port deterministic parsers from `mke-budget-commons` only; Budget Compass reused later for the MPROP address normalizer (P4) — not its `/api/mprop` route, which builds SQL from raw input.
- **OpenUI built-in functions vs principle 1.** OpenUI Lang has runtime functions (`@Count`, `@Filter`, and likely aggregations) that let model-written Lang compute over `Query()` results. The arithmetic runs deterministically in the renderer, but the *choice* of what to sum is the model's. P3.6 lint must decide: whitelist (e.g. `@Filter` only) or ban. Until then, tools return pre-computed totals.
- **OpenUI Query rows carry their own cite.** `Query()` passes tool JSON straight to components, so every row returned by a tool must include `cite` and a stable `id`. Schema stores `cite` jsonb on every row (done).
- **CopilotKit skills restructured upstream (2026-09-10).** Nine knowledge skills replaced by `copilotkit` + `copilotkit-cli`; CLAUDE.md's `npx copilotkit@latest skills install` line predates this. Current update command: `npx skills add copilotkit/CopilotKit --full-depth -y`. Docs search MCP (`copilotkit-docs`) not yet registered.
- **CopilotKit v2 ships `BuiltInAgent`** that can call Anthropic models directly. Relevant to D4 (Mastra behind CopilotKit) — evaluate in the P3.0 spike, not before.
- **Embedding dimension** set to 1024 (Voyage default) in the schema; confirm the Voyage model in P1.10 and regenerate the migration if it differs.
- **Tables not in docs/02 §4 deferred**: section comparisons (p.8–10) and FTE tables (p.14–16) get tables when P1.1 extracts them and their shape is known.

## 2026-09-22 — P1.3 Detailed book: things the document does that the spec didn't mention

Stored as printed, flagged on the row; none of these are "fixed" by the parser.

- **Unit-level 2025 figures printed on a position line.** Detailed 220.11–220.13 (Employee Relations) print headcounts (1, 2, 16.67) in the *2025 EXPENDITURE dollars* column of position lines; Water Works 540.16/540.20/540.25 print a multi-million 2025 figure on the first position of a unit. Flag `actual_2025_not_position_pay` (27 rows); never summed as a position's pay. Ask Budget & Management what these are.
- **Account printed without leading zeros** ("6300" for 006300, Detailed 160.6, 260.29): 4 rows, flag `account_printed_short`, kept as printed. Library 260.29 lines 10–11 use account 6300 on real line items ("Villard Square Property Payment"), so account 0063xx alone does not mean "total".
- **Fringe-benefit rollup printed without an account code** (Detailed 160.5 line 25, 240.4 line 23): recognized by its wording.
- **Pay range glued to footnote codes** ("…(BCHW)9PN", Detailed 250.28): split, flag `pay_range_glued`.
- **Footnote prose contains column-aligned numbers** (Detailed 300.19–300.20: "Position authority for 1 Police Detective", "(0.5 FTE)"): 8 rows; numbers kept in the text, not as values, flag `prose_numbers_not_values`.
- **Administration BCU header vs its total disagree**: 110.1 says "(SUMMARY 1 BCU=8 DU)", 110.2 closes "TOTAL (1 BCU=10 DU)". Which count is right is a question for the city; the parser doesn't rely on either.
- **docs/02 §3 row-type list is incomplete**: valued rows with no account code (equipment items, special-fund items, capital lines) get `row_type = 'item'`, a type the plan's list didn't have.

## 2026-09-22 — P1.5–P1.7

- **Position-title glosses not written.** docs/06 plans a Haiku-class batch job for ~1,200 titles. That needs an API key and costs money, so the concept index has `gloss = null` for position titles. Decide in P1.10/P3 whether to run it (and budget it).
- **Account glosses are drafts** (`pipeline/data/account_glosses.yaml`, 18 operating accounts): written from the account names only, all `reviewed_by: null`.
- **Sub-heading detection is heuristic.** 51 → ~40 prose sub-headings after rules; a few false positives remain (e.g. Port "Administration & Financial Services – Supports", a heading plus the start of its sentence). Metadata only (`heading` field); no numbers affected. Review in the P1.9 report.
- **reason_category is conservative.** 203 of 298 reasoned rows plus all reason-less rows are `other`; "Position eliminated" is never classed as vacant because the text doesn't say so.
- **Narrative quirk kept as printed:** Summary p.159 says the fringe benefit offset is "anticipated to be $28.0 million in 2026, a $3.0 million increase from 2026"; the table (p.162) puts it in 2027 Proposed. Recorded in budget_facts.yaml.

## 2026-09-23 — from the independent bbox cross-check review

- **docs/02 §2 says KPI year labels are "2024 Actual | 2025 Projected | 2026 Planned".** That's Police's labeling; Administration, Fire, City Attorney and others print 2025 / 2026 / 2027 (some as "Indicators"). The pipeline keeps labels as printed, which is right. The spec should say "varies by department".
- **Brackets in the Contingent Fund's 2025 actual** (`[4,998,805]`, Summary p.187): the page doesn't say what brackets mean. Stored with a `printed_bracketed` flag. Ask the Budget office before the app displays it (possibly: spent by transfer to other accounts).
- **Fire Support Services 2025 fringe** (Detailed 240.10 line 24) prints the unit's 2025 operating total. Suspected copy error; logged as `suspected` in source_inconsistencies.yaml, not displayed.

## 2026-09-23 — P1.10

- ~~Embeddings not loaded.~~ **Resolved 2026-09-23:** `voyage-4` (1,024 dims, matches the schema). 2,463 unique texts cost 85,937 tokens, inside the 200M free tier ($0). Vectors are kept in `embedding_cache`, keyed by sha256(model | input_type | text), so a reload only pays for text that changed. `pnpm db:load` now embeds at the end. Checked by `lib/db/embeddings.test.ts`.
- **Concept labels: one wrapped heading half survives** (`1. BUDGET FOR COUNTY`). The fragment filter in `extract/concepts.py` catches headings that end in FOR/OF/AND or a hyphen; this one ends in a noun. Harmless to search, but it's not a real program name.
- **Row ids are not stable across reloads** (D14). Anything outside the database (Boards, share links) must refer to rows by citation, not by id.
- **pg warns that `sslmode=require` will change meaning in pg v9.** Current behaviour is `verify-full` (strict). Setting `sslmode=verify-full` explicitly in DATABASE_URL keeps it and silences the warning; not changed yet because it's the credentials file.

## 2026-09-23 — City Receipt: what the MPROP data and its documentation do not settle

Snapshot: data.milwaukee.gov resource 0a2c7f31…, 159,949 parcels, taken 2026-09-23 (`data/processed/parcels_meta.json`). Field documentation: `data/raw/MPROP-Field-Documentation.pdf` (the city's file is dated fall 2024).

- **Taxable value = `C_A_TOTAL`, not total minus exempt** (docs/07 §3 corrected). Exempt parcels carry 0 in `C_A_TOTAL` and their value in `C_A_EXM_TOTAL`; no parcel has both.
- **`DPW_SANITATION` is a collection district (N1, N2, S1, S2, C1, C2, S3), not a served/not-served flag.** Almost every parcel has one. docs/07 assumed it decides whether the solid waste fee applies. Which properties get city garbage service (and pay the fee) is still open; ask DPW. **Decided 2026-09-23 (Tarik, option 1):** show the solid waste line only for class 1 residential with 1–4 units, labeled "assumed: city garbage service". Still worth asking DPW for the actual rule before launch.
- **No `UNIT` field exists** (docs/07 lists one). Condos (class 5) each have their own taxkey, so a condo address returns several parcels; the address picker handles it.
- **`OWN_OCPD` is the city's guess:** 'O' when the property address matches the owner's mailing address. Use it only to pick the starting view (owner or renter); the user can switch.
- **`NR_UNITS` counts rooms for hotels and licensed beds for nursing homes.** Split per unit only for residential building types.
- **397 parcels still carry a 2025 assessment** (`YR_ASSMT`); the receipt says so for those.
- **417 manufacturing parcels (class 3) and 394 with no class have `C_A_TOTAL` = 0.** Manufacturing is state-assessed: "can't estimate", per docs/07.
- **`TAX_RATE_CD` is the county** (Milwaukee, Washington, Waukesha). The city rate is the same in all three; the receipt is city-only.
- **The owner-occupied count (97,461 of 159,949 parcels) is not the renter share of residents.** Quote ACS (the Census Bureau's American Community Survey) for that, per docs/07 §1.
