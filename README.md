# Milwaukee Budget Decoder — Claude Code handoff pack

Drop this folder into a new repo root, copy the two budget PDFs into `data/raw/`, then start Claude Code with:

> Read CLAUDE.md and docs/01–04. Start with P0 in docs/04-BUILD-PLAN.md. Before any CopilotKit code, run `npx copilotkit@latest skills install`. Don't start P2 until the P1 reconciliation suite is green.

| File | What it is |
|---|---|
| `CLAUDE.md` | Project rules, stack, principles Claude Code must follow |
| `docs/01-PRD.md` | Audiences, what makes this budget hard, signature features, scope, success criteria |
| `docs/02-DATA-PIPELINE.md` | Exact document structure, BMD-2 column positions, schema, chunking, golden numbers |
| `docs/03-AGENT-GENUI.md` | Tool contract, tool list, frontend tools, component catalog, grounding guard, system prompt, evals |
| `docs/04-BUILD-PLAN.md` | Phases P0–P6 with done-when criteria, sequenced for the October hearings |
| `docs/05-QUESTION-BANK.md` | Resident and journalist questions mapped to tools, components, pages, and coverage gaps |
| `docs/06-RAG-INGESTION.md` | How both PDFs are indexed: narrative lane, concept lane, SQL lane |
| `pipeline/extract/narrative_chunks.py` | Working prototype chunker for the Summary PDF (225 chunks) |
| `docs/07-CITY-RECEIPT.md` | MPROP-based receipt for owners, renters, and landlords: data, math, worked examples, privacy |
| `evals/golden-seed.yaml` | First eval cases with verified figures and page citations |
| `docs/decisions.md` | Decisions made in planning and what would change them |

Working name only; rename before launch.
