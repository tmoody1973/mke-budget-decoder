# 04 — Build Plan

The budget's news window is short: legislative hearings in October, Finance & Personnel amendment day in early November, Council action by November 14. So the plan front-loads the pieces that are useful on their own. Each phase ends in something shippable. Look up actual hearing dates on the Common Council calendar (Legistar) and put them in `calendar_events`; don't guess.

Milestone IDs go in commit messages (e.g. `P1.3: detailed line parser`).

## P0 — Setup (½ day)

- P0.1 Next.js + TS strict + Tailwind + shadcn, pnpm, Vitest, Playwright; Python `pipeline/` with uv + pytest.
- P0.2 `npx copilotkit@latest skills install` and `npx skills add thesysdev/skills --skill openui`; read both.
- P0.3 Neon Postgres + pgvector, Drizzle schema from docs/02 §4 with `budget_versions`.
- P0.4 Copy PDFs to `data/raw/`. Add `docs/decisions.md` and `docs/open-questions.md`.

**Done when:** `pnpm dev` runs, `uv run pytest` runs (zero tests), DB migrates.

## P1 — Data pipeline (3–4 days) ← the foundation

- P1.1 Summary: section totals (p.7), section comparisons (p.8–10), positions (p.13), FTE tables (p.14–16).
- P1.2 Summary: department template parser (budget summary, services, KPIs, capital projects, position changes, mission/highlights as narrative). Handle DPW's three divisions and multi-page departments.
- P1.3 Detailed: BMD-2 coordinate parser → `line_items`, `position_lines`, with row-type classification.
- P1.4 Revenues (Source of Funds p.156–161 + detailed revenue listing).
- P1.5 Narrative chunker → `chunks.jsonl`: finish the prototype in `pipeline/extract/narrative_chunks.py` per docs/06 §10; add table cards, chart cards, `dept_crosswalk`.
- P1.5b Concept index for the Detailed budget (accounts, position titles, org units, capital/revenue lines) with glosses (docs/06 §4).
- P1.6 Departments + aliases YAML (hand-curated: "MPD", "911", "DPW", "sanitation", "MPL", "DNS", "DCD", "MFD"…).
- P1.6b `fees` table, `budget_facts` (hand-authored, each row reviewed), `reason_category` classifier for position changes, revenue lines for special revenue funds (docs/05).
- P1.7 Glossary seed (~40 terms) written in plain language, each with a page citation.
- P1.8 Reconciliation suite: all golden numbers G1–G20 + structural sums + Summary↔Detailed cross-checks.
- P1.9 Human-review HTML report (tables beside page crops). Tarik (or a reporter) spot-checks every department.
- P1.10 Loader: parquet → Postgres; embed chunks (Voyage).

**Done when:** reconciliation suite green; review report checked; DB populated.

## P2 — Explore (no AI) (3–4 days) ← first public-worthy release

- P2.1 `lib/db` typed query functions (the same functions the agent tools will wrap), unit-tested against golden numbers.
- P2.2 Core genui components in isolation (Storybook or a `/dev/components` page): `BudgetNumberCard`, `DeptSnapshot`, `AskVsGotBars`, `ChangeLeaderboard`, `SectionTreemap`, `RevenueMix`, `PositionsDiff`, `LineItemTable`, `CitationChip`, `SourceDrawer`.
- P2.3 Overview page, department pages (`/department/[slug]`), What Changed page, Revenue page, Timeline page.
- P2.4 Diff lens toggle (vs adopted / vs requested / vs actual) across all views.
- P2.5 Levy-vs-rate explainer + `TaxReceipt` by assessed value.
- P2.6 Export: PNG + CSV per component; OG images per department for social sharing.
- P2.7 Accessibility pass (table fallbacks, keyboard, contrast), mobile layout.

**Done when:** a reporter can find any department's four-stage numbers with a citation in under 30 seconds on a phone. This can launch on its own if the agent slips.

## P3 — Ask (agent + generative UI) (5–6 days)

- **P3.0 Spike, 1 day, decision gate (D9).** Minimal CopilotKit chat + Mastra agent + OpenUI Renderer in the assistant-message slot, with 4 budget components and 2 data tools. Run the same 10 golden questions two ways: (a) OpenUI Lang composition, (b) CopilotKit tool-call rendering. Measure: valid-Lang rate, ungrounded-literal rate after lint, time to first rendered component, total tokens, and subjective feel on a phone. Record results in `docs/decisions.md`. Proceed with (a) if valid ≥95% and zero ungrounded figures reach the screen; otherwise (b).

- P3.1 Mastra `budgetGuide` agent + CopilotKit runtime route; streaming working end-to-end with one tool.
- P3.2 All backend tools from docs/03 §3 wrapping `lib/db`, exposed to the agent and (read-only) to the Renderer's `toolProvider`; register the budget OpenUI library (docs/03 §5a).
- P3.3 Hybrid search (`search_budget_text`) with filters, RRF, rerank, section expansion / department dossier + `SourceQuotes`; retrieval evals vs the full-context baseline (docs/06 §6, §9).
- P3.4 HITL: `ScopePicker`, `DeptDisambiguator`.
- P3.5 Frontend tools: `navigate_canvas`, `set_diff_lens`, `open_source`, `pin_to_board`; shared `GuideState`.
- P3.6 OpenUI Lang lint + grounding guard (docs/03 §6) + test corpus.
- P3.7 Evals: expand `evals/golden-seed.yaml` using docs/05 to 50+ questions, runner in CI; iterate prompt/tools until ≥95% numeric exactness.
- P3.8 Suggested-question chips per page ("Ask about this department").
- P3.9 Rate limiting, answer caching, cost dashboard.

**Done when:** evals pass thresholds; zero ungrounded numbers in eval runs; p50 first chart < 3s.

## P4 — Board, address, Spanish (3–4 days)

- P4.1 Story Board: pinned answers stored as OpenUI Lang snippets + budget version; reorder, notes, share by URL (no accounts), export PNG/CSV/embed; agent edits board items via incremental editing.
- P4.2 Embeddable widgets for newsrooms (`/embed/[boardItemId]`, or OpenUI browser bundle for no-build embeds), with citation footer.
- P4.3 My City Receipt (docs/07): MPROP ingest without owner fields, range/unit-aware address match (port Budget Compass), owner / renter / landlord views, services-per-resident side, edge cases, the two worked examples as cent-exact tests; address → alderperson + hearing info. Addresses never stored.
- P4.4 Spanish: UI strings, glossary, agent language matching, Spanish evals.

## P5 — Adoption and amendments (November)

- P5.1 Amendment tracker from Legistar (manual entry is acceptable at first).
- P5.2 Ingest the Adopted 2027 budget as a new `budget_version`; rerun pipeline + reconciliation.
- P5.3 Extend Diff lens with "Proposed → Adopted"; "What the Council changed" page.

## P6 — Later

- Balance It Yourself simulator (levers + real constraints, agent narration).
- "What Milwaukee is asking" (anonymized top questions).
- Voice mode; WebMCP exposure of frontend tools for browser agents.
- Generalize pipeline for the 2028 cycle and other cities' formats.

## Definition of done for any feature

- Numbers come from `lib/db` and carry citations.
- Component renders on 360px width and has a table fallback.
- Neutral headline copy reviewed against the PRD voice rules.
- Tests: unit for queries, eval cases for any new agent behavior.
