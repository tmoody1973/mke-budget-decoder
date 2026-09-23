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
