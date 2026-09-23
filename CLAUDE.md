# CLAUDE.md — MKE Budget Decoder (working name)

An interactive, AI-assisted guide to the City of Milwaukee **2027 Proposed Executive Budget** for residents and journalists. Users explore the budget visually and ask questions in plain language; answers come back as generative UI (charts, tables, receipts) with a citation to the exact PDF page behind every number.

Read these before writing code, in order:
1. `docs/01-PRD.md` — what we're building and for whom
2. `docs/02-DATA-PIPELINE.md` — how the PDFs become trustworthy data (the hardest part)
3. `docs/03-AGENT-GENUI.md` — agent, tools, RAG, generative UI catalog
4. `docs/04-BUILD-PLAN.md` — phases, acceptance criteria, what to build first

Source PDFs live in `data/raw/` (`2027-Proposed-Detailed-Budget.pdf`, 455 pp; `2027-Proposed-Plan-and-Executive-Budget-Summary.pdf`, 224 pp).

## Non-negotiable principles

1. **Numbers come from the database, never from the model.** The LLM chooses tools and writes connective prose. Every dollar figure, FTE count, and percentage shown to a user must originate in a tool result. The model does not do arithmetic in its head; it calls `calculate` or a query tool. ("AI on a leash": deterministic pipeline underneath, agent on top.)
2. **Every number carries a citation.** Every row in the database stores `source_doc`, `pdf_page`, `printed_page`, and (for line items) `line_no`. Every generative UI component renders a citation chip that opens the PDF at that page.
3. **Proposed is not adopted.** This is the Mayor's proposal to the Common Council. UI and agent language must attribute it ("The Mayor's proposed budget includes…"). Never describe proposed amounts as final.
4. **Neutral, explanatory, never advocacy.** This is a public-media civic tool. The agent explains what the documents say, provides context that is also in the documents, and does not argue for or against any spending choice, predict Council votes, or characterize decisions as good or bad.
5. **Scope is explicit.** "The city budget" can mean General City Purposes ($846.8M), property-tax-supported funds, or all funds ($2.26B). Every total states its scope. When a question's scope is ambiguous, ask (human-in-the-loop scope picker) instead of guessing.
6. **Golden numbers must reconcile.** The reconciliation test suite (`docs/02-DATA-PIPELINE.md` §7) runs in CI. A failing reconciliation blocks deploy.

## Stack (decided — change only with a written reason in `docs/decisions.md`)

| Layer | Choice |
|---|---|
| App | Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui |
| Agent UI | CopilotKit (AG-UI protocol) — chat shell, agent loop, frontend tools, human-in-the-loop, shared agent state, Inspector |
| Generative UI language | OpenUI Lang (`@openuidev/react-lang`) rendered inside CopilotKit's assistant-message slot. The agent composes answers from OUR component library; numbers arrive through `Query(...)` bindings to our read-only data tools, never as model-written literals. Pending the P3.0 spike (docs/04). |
| Agent | Mastra agent exposed to CopilotKit via `@ag-ui/mastra` |
| LLM | Anthropic Claude — Sonnet-class model for the main agent; Haiku-class for cheap routing/summarization jobs. Confirm current model IDs in Anthropic docs. |
| Data | Postgres (Neon) + pgvector + Drizzle ORM. Structured tables for numbers; hybrid (full-text + vector) search for narrative text |
| Embeddings | Voyage AI (Anthropic's recommended embeddings provider) — confirm current model name |
| Charts | Visx or Recharts; every chart has an accessible data-table fallback |
| PDF viewer | pdf.js (react-pdf) for the source drawer, deep-linked to page |
| Extraction | Python 3.12 + pdfplumber + pandas, in `pipeline/` (offline, run once per budget version) |
| Tests | Vitest (app), pytest (pipeline), Playwright (e2e), eval harness for agent answers |
| Hosting | Vercel (app) + Neon (db) |
| Auth | None for v1. Boards are shared by URL. If accounts are ever needed, use Clerk. |

## CopilotKit and OpenUI: do not write them from memory

CopilotKit's API changed substantially in 2025–26 (e.g. `useFrontendTool`, tool-call rendering, `useAgent`, human-in-the-loop hooks, v2 packages). Before writing any CopilotKit code:

```bash
npx copilotkit@latest skills install          # CopilotKit's official Claude Code skills
npx skills add thesysdev/skills --skill openui   # OpenUI's official skill (OpenUI Lang syntax, library design, Renderer, debugging)
```

Then follow those skills and docs.copilotkit.ai for current imports and hook names. Use the CopilotKit Inspector in dev builds to watch AG-UI events. OpenUI Lang's spec is young (v0.5 as of Sept 2026); follow openui.com docs, not memory. Same rule for Mastra: check the current Mastra ↔ CopilotKit integration guide before wiring `registerCopilotKit`.

## Repo layout

```
/app                 Next.js routes (explore, department/[slug], ask, board/[id], api/copilotkit)
/components/genui    Budget component library + OpenUI `createLibrary` definition (see docs/03 §5)
/components/explore  Non-AI exploration views
/lib/db              Drizzle schema + typed query functions (the ONLY place SQL lives)
/lib/agent           Mastra agent, tools, system prompt, grounding guard
/lib/format          Money/FTE/percent formatting, human-scale conversions
/pipeline            Python extraction → data/processed/*.parquet + *.json → loader
/data/raw            Source PDFs (read-only)
/data/processed      Extracted, validated datasets (committed)
/evals               Golden Q&A set + runner
/docs                Specs (this handoff)
```

## Working agreements

- Build the pipeline and reconciliation tests **before** any UI. Bad data invalidates everything downstream.
- Tool functions in `lib/db` are pure and unit-tested; agent tools are thin wrappers around them.
- Every generative UI component must also work outside chat (the Explore pages reuse them). Build components first, wire to the agent second.
- Mobile-first. Most residents will arrive from a phone via a news story or social link.
- WCAG 2.1 AA: charts need text summaries and table fallbacks; color is never the only signal.
- Commit small, with the phase/milestone ID from `docs/04-BUILD-PLAN.md` in the message.
- When a spec is wrong or ambiguous, write the question in `docs/open-questions.md` and pick the conservative option; don't silently invent budget facts.
- Tarik's Socratic-builder workflow stays in effect for build sessions unless he bypasses it.

## Commands (fill in as they're created)

```bash
pnpm dev                 # app
pnpm test                # vitest
pnpm evals               # agent golden-answer evals
cd pipeline && uv run python -m extract.all      # re-extract from PDFs
cd pipeline && uv run pytest                      # reconciliation tests
pnpm db:load             # load data/processed into Postgres + embed chunks
```
