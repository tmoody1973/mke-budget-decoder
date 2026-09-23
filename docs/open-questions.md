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
