# Milwaukee Budget Decoder

**Live at [mkebudget.app](https://www.mkebudget.app)**

An independent, plain-language guide to the City of Milwaukee's **2027 proposed budget**, the Mayor's proposal to the Common Council. Every figure on the site traces to the exact page of the city's budget PDFs it came from.

Made by [Tarik Moody](https://www.linkedin.com/in/tarikmoody). A personal project, not a Radio Milwaukee product and not an official City of Milwaukee website.

## What it does

- **Overview:** where the $2.26 billion would go, where general city money comes from, what each department asked for against what the Mayor proposed, the biggest changes, and the property tax levy against the tax rate. Every chart has a table version and a source mark that opens the budget page.
- **Your City Receipt:** enter a Milwaukee address (or a condo's assessed value) and see what the city would charge that home in 2026 and under the 2027 proposal: property tax, garbage, snow and ice, street lighting, sewer. Renters see their unit's share. Save it as a receipt-style picture to share.
- **Ask about the budget:** a chat that answers from the budget itself. It looks figures up in the database and shows them as cited tables; the AI writes the sentences, never the numbers. Changes and differences come ready-made from the lookups, so it doesn't do arithmetic in its head.
- **In the news:** the topics local coverage leads with, and a "Find it in the budget" list that sets reported figures beside what the documents print, with neutral labels.
- **Have your say:** the Common Council's budget hearings, with a calendar file to download.
- **How it works:** the method in plain language, diagrams of the data pipeline and the chat, and the chat's latest test results.

## How the numbers stay trustworthy

1. A Python pipeline reads the two budget PDFs (a 224-page summary and a 455-page line-item book) into Postgres. Every row keeps its document, PDF page, printed page and line.
2. Twenty figures read by hand, and the documents' own totals, are checked on every change (`pipeline/validate/`). If a check fails, the change can't deploy.
3. Plain-language facts, glossary entries and news-claim labels are page-checked in code, verified by a second model, and reviewed by a person before they show.
4. The chat is tested on 66 questions, including follow-ups asked mid-conversation. Each answer is sorted into one of four outcomes (correct, incomplete, unsourced figure, couldn't answer), borrowed from the [GRASP paper](https://arxiv.org/abs/2503.23299) on municipal budget chatbots. A code check flags any dollar amount or percentage that didn't come from a lookup. A person reviews every flag, and the latest full run is published on How it works.
5. A test run with any grading error is never published.

The full method is on the site's [How it works](https://www.mkebudget.app/how-it-works) page.

## Stack

Next.js (App Router, TypeScript) · Tailwind · Postgres on Neon with Drizzle and pgvector · Voyage embeddings · a Mastra agent on Claude (Anthropic) in a CopilotKit chat · Visx charts · pdf.js · Python 3.12 with pdfplumber and pandas for extraction · Vitest, pytest and Playwright · Vercel hosting · Vercel Analytics, PostHog and Braintrust for page views, site events and chat traces.

## Running it locally

Put the two budget PDFs in `data/raw/`, and set `DATABASE_URL`, `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` in `.env.local` (plus `CHAT_ENABLED=true` to show the chat).

```bash
pnpm install
pnpm dev                                  # the site on localhost:3000
pnpm test                                 # app tests (Vitest)
cd pipeline && uv run python -m extract.all   # re-extract the PDFs into data/processed/
cd pipeline && uv run pytest                  # reconciliation and page checks
pnpm db:load                              # load data/processed into Postgres and embed passages
pnpm mprop:refresh                        # refresh the city property file for the receipt
```

### Checking the chat

```bash
pnpm evals                  # 66 questions through the real agent; results in evals/results/, summary in evals/summary.json
pnpm evals A10 B6           # only some questions
EVAL_MODEL=openrouter/openai/gpt-5.6-luna pnpm evals   # same agent, another model
pnpm evals:sync             # copy evals/golden.yaml into the Braintrust dataset "Golden questions"
pnpm evals:bt               # run the check as a Braintrust experiment
```

`evals/golden.yaml` is the source of truth for the questions. A case can carry `before`, earlier questions in the same conversation, to test follow-ups. A full run on the production model writes `evals/summary.json`, which the How it works page publishes; flagged answers keep their lookup data in the results file so a person can confirm or clear them first. Rows added by hand in Braintrust (for example from a live trace) are left alone by the sync, as an inbox to turn into YAML entries.

Diagrams: `docs/diagrams/*.dataflow.json` are the Archify specs; they render to `public/diagrams/`, and `node scripts/theme-diagrams.mjs` gives them the site's colors.

## Project docs

| File | What it is |
|---|---|
| `CLAUDE.md` | Project rules, stack and principles |
| `PRODUCT.md`, `DESIGN.md` | Who it's for, and the design system |
| `docs/01-PRD.md` | Audiences, scope, success criteria |
| `docs/02-DATA-PIPELINE.md` | Document structure, schema, golden numbers |
| `docs/03-AGENT-GENUI.md` | Agent tools, components, evals |
| `docs/04-BUILD-PLAN.md` | Phases and done-when criteria |
| `docs/05-QUESTION-BANK.md` | Resident and journalist questions mapped to tools |
| `docs/06-RAG-INGESTION.md` | How both PDFs are indexed |
| `docs/07-CITY-RECEIPT.md` | The receipt's data, math and privacy rules |
| `docs/09-NEWS-AND-CIVIC.md` | News coverage and the Council calendar |
| `docs/decisions.md` | Every significant decision, its options and tradeoffs (D1–D24) |
| `docs/LEARNING-LOG.md` | What we expected, what happened, what we now believe |
| `docs/open-questions.md` | Open questions and known source inconsistencies |

## Privacy

Addresses typed into the receipt are not stored or logged, and owner names from the property file are never loaded. Site events carry no addresses, assessed values or question text. Chat questions are kept in a private Braintrust project to find and fix wrong answers.

## License

The code is under the [MIT License](LICENSE). It does not cover material that isn't the project's own:

- **Budget documents** in `data/raw/` are City of Milwaukee public records, included so the pipeline can be rerun.
- **Extracted data** in `data/processed/` comes from those documents and the city's Master Property File (MPROP). It's offered as-is and is only as current as the documents it was read from.
- **Fonts** in `assets/fonts/` (Libre Franklin, IBM Plex Mono) are under the SIL Open Font License; the license files sit beside them.
