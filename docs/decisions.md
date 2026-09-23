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
