# Decisions log

| # | Decision | Why | Revisit if |
|---|---|---|---|
| D1 | Structured-first data, RAG only for narrative | Budget questions are numeric; vector search over tables misquotes numbers | Users mostly ask narrative "why" questions (check logs) |
| D2 | Controlled generative UI: only our components; figures bound via ids/Query, never model literals | Every number must be traceable to a page | — |
| D9 | OpenUI Lang as the answer-composition language, rendered inside CopilotKit chat; CopilotKit keeps agent loop, shared state, HITL, canvas control | Live, composable, editable answers with data bound at render time; tiny shareable Board artifacts; official CopilotKit integration | P3.0 spike shows Claude's Lang is invalid >5% or ungrounded literals slip past lint, or streaming in the CopilotKit slot is janky → fall back to CopilotKit tool-call rendering with the same library |
| D3 | Postgres + pgvector (Neon) over Convex | SQL aggregations (sums, rankings, diffs) plus hybrid search in one store | Realtime collaboration on Boards becomes central |
| D4 | Mastra agent behind CopilotKit via AG-UI | Proven in Budget Compass; typed tools, evals | CopilotKit's built-in agent covers needs with less glue |
| D5 | Fresh repo; port Budget Compass pipeline utilities and MPROP lookup | Different budget stage/year and scope; avoid Nova-specific code | — |
| D6 | No accounts in v1; Boards shared by URL | Lower friction for residents; no personal data stored | Users ask to save many boards |
| D7 | Explore ships before Ask | Useful during hearings even if the agent slips | — |
| D8 | Every table keyed by budget_version | Adopted budget arrives in November | — |

---

## D10 — Column positions are read from each page, not checked against one fixed ruler

**Decision.** The Detailed-budget parser finds each page's columns from that page's own header row and places a number under the header it sits beneath. The ±2-point "every page must match the spec" rule from docs/02 §3 is kept as a warning, not a hard stop.

**Why this came up.** The spec said column positions are identical on every page to within 2 points (a point is 1/72 of an inch). On the real 2027 Proposed PDF that's true for 420 of 450 pages. The other 30 are Emergency Communications (off by up to 7.9 pt), Police (5.3 pt) and the DPW summary (2.0 pt). Those pages are slightly stretched sideways, not just shifted. And City Treasurer prints its position counts centered under the header instead of right-aligned. If we got this wrong, a number could land in the wrong year's column. That's the worst kind of error for this project, because it looks right.

**Options.**
1. *Enforce ±2 pt and stop on failure* (the spec). Honest, but the pipeline can't run at all on 30 real pages.
2. *Use fixed column positions with a wider tolerance.* Runs, but on a stretched page a number near a boundary can be put in the neighbouring column without any error.
3. *Read the columns from each page's own headers* and accept a number only if it sits under a header. Stop loudly if a page has the wrong number of headers, headers out of order, or drift over 10 pt.

**What we chose and why.** Option 3 (Claude, during P1.3; Tarik to confirm). Every number either lines up with a column on its own page or is reported. On the real book, 0 numbers failed to line up and 0 words were left unattached. Pages over 2 pt are listed by a test, so a new stretched page gets noticed.

**What we gave up.** The simple "every page is identical" guarantee. A page that's stretched *and* has a number that sits halfway between two columns would still go to the nearer one. Nothing stops that except the reconciliation sums (P1.8).

**How we'll know if this was right.** The P1.8 reconciliation suite: every decision unit's lines add up to its printed totals, in every year column, including on the 30 stretched pages. A wrong-column number would show up there as a mismatch.

**What actually happened.**

---

## D11 — Every Detailed row is labeled "real money", "summary", or "restated", and only real money is ever added up

**Decision.** The parser tags each Detailed-budget row with a `block`: `decision_unit` (real money, counted once), `bcu_summary` (a department's summary sheet that repeats its own offices), or `restated` (a whole section that repeats money from another section). Queries sum only `decision_unit`. The other two are used as checks.

**Why this came up.** The book tells the same money two or three times. Administration's summary sheet (110.1–110.2) restates its ten offices. Section 420 restates the whole $846.8M General City Purposes budget. Sections 450–470 restate lines of 440. A tool that adds up "every salary row for Administration" would roughly double the answer and show it with confidence.

**Options.**
1. *Drop the summary rows at extraction.* Simple, but it throws away the city's own totals, which are the best way to check the parser.
2. *Keep everything and trust query authors to filter.* Every future query is one forgotten filter away from a doubled number.
3. *Keep everything, label every row, check summary = sum of offices in tests, and sum only real money by default.*

**What we chose and why.** Option 3. Tarik's call in the Socratic stop: "use the summary as a validation of the total and never use summary in the front end". Claude added the row label that makes that rule enforceable, since the book doesn't print it. On the real book the check passes for 11 summary sections × 6 kinds of total × 4 year columns. The two exceptions are verified errors in the document (Transportation 510, below).

**What we gave up.** Labeling depends on reading where a summary ends. That took several rules: explicit "BCU/DECISION UNIT" wording, or a line whose numbers equal its categories added up. A new layout next year could fool it. The tests would catch that as a mismatch but can't fix it.

**How we'll know if this was right.** `validate/test_bcu_blocks.py` stays green on the Adopted budget in November without new rules. In P2, department totals built from `decision_unit` rows equal the Summary book's department totals (P1.8 cross-document check).

**What actually happened.**
