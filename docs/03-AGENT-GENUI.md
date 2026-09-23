# 03 — Agent, Tools, RAG and Generative UI

## 1. Architecture

```
Browser (Next.js)
 ├─ Explore canvas (department pages, overview, diff lens)   ← same budget components as chat answers
 ├─ CopilotKit chat (sidebar desktop / bottom sheet mobile)
 │    └─ assistant message slot → OpenUI <Renderer library={budgetLibrary} toolProvider={dataTools}>
 │          └─ Query("get_department", {dept:"police"}) → /api/data/* (read-only, cached) → live numbers
 ├─ Frontend tools: navigate canvas, pin to board, open source page, set diff lens
 └─ Shared agent state: current view, board, user context
        │  AG-UI (streaming events, tool lifecycle, shared state)
        ▼
/api/copilotkit → CopilotKit runtime → Mastra "budgetGuide" agent (Claude, Sonnet-class)
        ├─ Structured tools → lib/db typed queries → Postgres  (agent uses these to REASON)
        ├─ search_budget_text → hybrid search → chunks
        ├─ calculate (deterministic arithmetic)
        └─ Final answer = OpenUI Lang composed from budgetLibrary (the agent's reply IS the UI)
             └─ Lint + grounding guard on the Lang output before/while streaming
```

### Why two layers (decided 2026-09, pending P3.0 spike)

**CopilotKit** owns the *agent experience*: conversation, tool lifecycle, human-in-the-loop, shared state with the page, frontend tools that let the agent drive the Explore canvas, the Inspector, and the Mastra integration. **OpenUI Lang** owns *how an answer is composed*: the model writes a compact, line-based program using only components we register, the Renderer streams it progressively, and `Query` statements are executed by the runtime against our tools, so figures flow from the database into components without passing through the model as literals. OpenUI documents this exact integration: replace CopilotKit's `assistantMessage.markdownRenderer` slot with the OpenUI Renderer.

What this buys the UX over fixed tool-to-component rendering:
- **Answers are live mini-views, not static cards.** A generated comparison can include a `$lens` selector (vs last year / vs requested / vs actual) bound to a reactive `Query`; switching it re-queries instantly with no LLM round-trip.
- **Composition.** "Compare police, fire and 911 and show what changed in staffing" becomes one layout (tabs, grid, callouts) instead of three stacked cards.
- **Edits instead of regenerations.** OpenUI's incremental editing lets "add the library to this" patch the existing view.
- **Tiny, portable artifacts.** A pinned Board item is a few lines of OpenUI Lang text plus a budget version, so boards share by URL, re-render with live data, and embed via OpenUI's browser bundle.

What we keep from the original plan: controlled rendering (only our components, Zod-typed props), citations on every figure, tools-only numbers.

Fallback if the spike fails (Claude writes invalid or ungrounded Lang too often, or streaming inside CopilotKit is janky): CopilotKit tool-call rendering with the same component library (each backend tool result renders its matching component). The component library is identical in both paths, so no UI work is lost.

## 2. Tool contract

Every tool returns the same envelope so every component can render citations, scope and caveats uniformly:

```ts
type ToolResult<T> = {
  data: T;
  scope: 'gcp' | 'levy_funds' | 'special_revenue' | 'all_funds' | 'department' | 'line_item';
  stages: Array<'actual_2025' | 'adopted_2026' | 'requested_2027' | 'proposed_2027' | 'adopted_2027'>;
  citations: Array<{ doc: 'summary' | 'detailed'; pdfPage: number; printedPage: string; lineNo?: number; label: string }>;
  caveats: string[];          // e.g. "KPI columns are 2024–2026 as printed", "2025 figures are actuals"
  budgetVersion: string;      // "2027 Proposed — 3rd Run 9/14/26"
};
```

All inputs are Zod-validated. Department arguments accept names, slugs, or aliases ("MPD", "911", "the library", "DPW", "sanitation") resolved via `departments.aliases`; unresolvable → return candidates so the agent can ask.

## 3. Backend tools (Mastra)

| Tool | Purpose | Renders |
|---|---|---|
| `get_budget_overview({scope})` | Totals by section, levy, rate, year-over-year | `BudgetOverviewCard`, `SectionTreemap` |
| `get_department({dept})` | Four-stage summary, FTEs, revenues, services | `DeptSnapshot` |
| `compare_departments({depts[], metric, stage})` | Side-by-side | `CompareBars` |
| `ask_vs_got({level: dept\|line_item\|positions, direction: below\|above_request, dept?, limit})` | Requested vs Proposed gaps, incl. unfunded position requests and items funded above request | `AskVsGotBars`, `PositionsDiff` |
| `top_changes({level: dept\|line_item\|positions, vs, direction, limit, scope})` | Biggest movers vs adopted/requested/actual | `ChangeLeaderboard` |
| `search_budget_lines({query?, account?, dept?, kind: expense\|revenue, groupBy?})` | Find expense or revenue lines ("overtime", account 634000, "parking citations") incl. special revenue funds | `LineItemTable` |
| `get_positions({dept?, title?, changeType?, reasonCategory?})` | Position changes with raw + classified reasons (vacant elimination, ARPA sunset, grant change…); budgeted cost per title | `PositionsDiff`, `PositionsTable` |
| `get_revenue_breakdown({level})` | Sources of funds; sales tax; SSR | `RevenueMix` |
| `explain_gap()` | The five drivers + how 2027 gap was closed | `GapStory`, `GapWaterfall` |
| `get_household_charges({address?, taxkey?, unit?, assessedValue?, view: owner\|renter\|landlord, frontageFt?, extraCarts?, monthlyTaxableSpend?})` | MPROP-based receipt: city levy (2026 vs 2027 from current and prior assessments), service charges, per-unit share for renters/landlords — full spec in docs/07 | `HouseholdCityBill`, `RentersReceipt`, `LandlordReceipt`, `AddressPicker` |
| `get_services_per_resident()` | GCP spending by department ÷ population (sourced), per year and per day | `ServicesPerResident` |
| `get_tax_rate_breakdown()` | Levy and rate by section — where each $1 of city property tax goes | `LevyDollar` |
| `get_fees({fee?})` | Fee schedule changes | `FeeChangeCard` |
| `get_reserves()` | Tax Stabilization Fund, unassigned balance, PDAF, withdrawals | `ReservesCard` |
| `get_budget_facts({topic})` | Curated, human-reviewed facts: Act 12, ERIP, recruit classes, deadlines, survey | `FactCard` |
| `get_borrowing()` | Borrowing authorizations, capital and debt trend | `BorrowingCard` |
| `get_district_info({address})` | Aldermanic district, alderperson, place-tagged capital projects | `DistrictCard` |
| `get_kpis({dept})` | Performance measures as printed | `KpiCard` |
| `get_capital_projects({dept?, query?})` | Capital projects and amounts | `CapitalList` |
| `lookup_term({term})` | Glossary | `GlossaryCard` |
| `search_budget_text({query, dept?, sectionType?})` | Hybrid RAG over narrative chunks | `SourceQuotes` (short excerpts + cites) |
| `get_calendar()` | Hearings, amendment day, adoption deadline | `Timeline` |
| `calculate({expression, inputs})` | Deterministic math (per-resident, % change) with inputs referencing prior tool values | inline `HumanScaleCard` |

The same query functions are exposed twice: to the Mastra agent as tools (so it can reason about what to show), and to the OpenUI Renderer's `toolProvider` as read-only `/api/data/*` endpoints (so `Query(...)` in the generated UI fetches the figures at render time). One implementation in `lib/db`, two thin adapters. The Renderer never gets write tools; there are no `Mutation`s in this app except client-only actions (pin, navigate).

`get_household_charges` must state in its caveats that the result is the **city** portion only (MPS, Milwaukee County, MMSD, MATC and the state credit are separate), that the rate is based on the Aug 31, 2026 estimated assessed value, and should be confirmed against the Treasurer's explanation of which tax bill funds which budget year before launch copy is final.

Per-resident conversions use a population constant stored in config **with its source** (latest Census estimate), never a model-supplied figure.

## 4. Frontend tools and shared state

Frontend tools (registered in the browser, callable by the agent):

- `navigate_canvas({view, dept?, lens?})` — the canvas follows the conversation ("show me Library" moves the page).
- `set_diff_lens({vs: 'adopted_2026'|'requested_2027'|'actual_2025'})`.
- `open_source({doc, pdfPage, highlight?})` — opens the source drawer at the page.
- `pin_to_board({componentId})` — adds the rendered answer to the Board.

Shared agent state (visible to both agent and UI):

```ts
type GuideState = {
  currentView: { view: string; dept?: string; lens: string };
  board: Array<{ id: string; tool: string; args: unknown; title: string; note?: string }>;
  userContext: { assessedValue?: number; district?: number; language: 'en' | 'es' };  // never persisted server-side
  scopePreference?: ToolResult<unknown>['scope'];
};
```

Because the agent can read the board, users can say "compare everything on my board to last year" or "write a 100-word summary of my board with citations."

## 5. Generative UI component catalog

### 5a. The OpenUI library: semantic components first

Register a library with `createLibrary` from `@openuidev/react-lang`. Design it so the model passes **identifiers, not values**:

```
// Good: the component resolves its own data, citations and scope
snap = DeptSnapshot("emergency-communications")
gap  = AskVsGot({dept: "all", limit: 10})
fig  = Figure("police", "total_expenditures", "proposed_2027")

// Also fine: generic layout bound to a Query result that carries citations
$lens = "adopted_2026"
d = Query("compare_departments", {depts: ["police","fire","emergency-communications"], vs: $lens}, {rows: []})
lensPicker = LensSelect($lens)
chart = CompareBars(d)
root = Stack([Heading("Public safety in the 2027 proposal"), lensPicker, chart, Text("…")])

// Never: a number typed by the model
Metric("Police", "$343.9M")        ← lint error
```

Library contents: the budget components in the table below (each accepts ids/Query results only), plus a small set of layout/interaction primitives (`Stack`, `Grid`, `Tabs`, `Heading`, `Text`, `Callout`, `LensSelect`, `ScopeSelect`, `DeptSelect`, `FollowUps`). Do not register OpenUI's generic built-in chart/table library for budget figures; generic charts may only take `Query` results whose rows include `citations`. Generate the system-prompt section from the library with OpenUI's prompt generator, and append our rules (§7).

Each lives in `components/genui/`, is usable in Explore pages too, streams a skeleton while the tool runs, and always renders: title, the figure(s), stage/scope labels, `CitationChip`s, caveats, a "Pin" button, an "Export" menu (PNG, CSV, embed), and an accessible table fallback.

| Component | Visual |
|---|---|
| `BudgetNumberCard` | One big number, delta vs chosen lens, one-line neutral headline |
| `DeptSnapshot` | Four-stage bar sequence (Actual → Adopted → Requested → Proposed), FTE strip, top services |
| `AskVsGotBars` | Paired bars; sorted by gap; tooltip shows the dollar and % difference |
| `ChangeLeaderboard` | Ranked list with up/down deltas, switchable level |
| `CompareBars` | Grouped bars for 2–6 departments |
| `SectionTreemap` | Where the money goes; drill section → department → category |
| `RevenueMix` | Stacked bar / donut of sources; 1995 vs 2027 (prose-stated percentages only) |
| `GapWaterfall` | Requested gap → reserves → revenue → cuts → balanced |
| `GapStory` | Scrollable five-driver explainer with document excerpts |
| `HouseholdCityBill` | Receipt-styled: city levy share + city fees, 2026 vs 2027, defaults labeled, method note for any per-department allocation |
| `LevyDollar` | Where $1 of city property tax goes, by section |
| `FeeChangeCard`, `ReservesCard`, `FactCard`, `BorrowingCard`, `DistrictCard`, `PositionsTable` | See docs/05 |
| `BroadcastBrief` | 3 facts written for speech (numbers spelled for reading aloud), citations shown off-air |
| `ClaimCheck` | A claim beside what the documents show, with figures and pages. No verdict labels |
| `PositionsDiff` | Table of added/removed positions with reasons |
| `LineItemTable` | Sortable, filterable, CSV export, account codes visible on demand |
| `KpiCard` | Measures with the printed year labels |
| `CapitalList` | Projects with amounts |
| `Timeline` | Budget calendar with "you are here" |
| `GlossaryCard` / `Term` | Plain definition; `Term` also used inline as a tooltip in prose |
| `SourceQuotes` | Short excerpts (≤2 sentences each) with citations |
| `HumanScaleCard` | "About $X per resident per day" with the formula shown |
| `ScopePicker` (HITL) | Choice chips when scope is ambiguous |
| `DeptDisambiguator` (HITL) | "Did you mean Infrastructure Services or Operations (Sanitation)?" |
| `CitationChip` + `SourceDrawer` | Opens pdf.js at `pdfPage`, highlights the line when `lineNo` is known |

## 6. Grounding guard (and OpenUI Lang lint)

Because the answer is OpenUI Lang, it is parseable code, which makes enforcement simpler than checking free prose. Parse each streamed statement with `@openuidev/lang-core` and apply:

1. **Allowed components only** (the Renderer already drops unknown ones; we also log them).
2. **No numeric literals in value-bearing props.** Numbers may appear only inside `Query` arguments, ids, limits, and `calculate` references. Any other number in a component prop is dropped and logged.
3. **Prose numbers must be grounded.** Extract numeric tokens from `Text`/`Callout`/`Heading` strings (handling `$343.6 million`, `$343,557,288`, `2%`, `11.75 FTEs`) and verify each matches a value from that turn's tool results within rounding tolerance, or a `calculate` output. Unmatched → the statement is withheld and the number replaced with a reference to the chart; the event is logged. Prefer prose that says "see the chart" over restating figures.
4. **Every rendered figure shows a citation.** Enforced inside the components, not by the model.

Implement the lint as a stream transformer between the Mastra agent and the CopilotKit runtime (or as a Mastra output processor if it can operate per line). Unit-test it with a corpus of good/bad Lang snippets. Keep OpenUI Gateway out of v1 (it adds a third-party hop for public traffic); the Renderer's drop-invalid behavior plus our lint covers correctness. Revisit Gateway if invalid-output rates are high in evals.

## 7. System prompt (starting point)

```
You are the guide to the City of Milwaukee's 2027 PROPOSED budget, submitted by Mayor Cavalier Johnson
to the Common Council. You help residents and journalists understand it.

Rules:
- Reply in OpenUI Lang using only the registered budget components. Bind figures with Query(...) or
  semantic components that take ids; never type a dollar figure, count, or percentage into a component prop.
- Use tools for every number. Never state a figure that is not in a tool result from this turn. For any
  arithmetic, call `calculate`.
- Prefer showing over telling: compose the smallest view that answers the question, add a LensSelect when a
  comparison is involved, and at most 3 short Text lines of plain-language context.
- Attribute: "the Mayor's proposed budget includes…", "the department requested…". This is a proposal;
  the Common Council can amend it before adopting by November 14.
- Stay neutral. Explain what the documents say and the constraints they describe (Act 12 mandates, the
  state Expenditure Restraint program, reserves). Do not argue for or against spending choices, predict
  Council votes, or characterize decisions as good or bad. If asked for your opinion, offer the relevant
  facts and the places residents can weigh in (hearings, their alderperson).
- Always state scope ("in the General City Purposes budget…"). If scope is ambiguous, call the scope
  picker instead of guessing.
- Distinguish the city tax levy from a resident's total property tax bill.
- When comparing years, say which stages you compare. Mention actual spending when it changes the picture.
- If the documents don't answer something, say so plainly and suggest where it might be found
  (e.g. Common Council hearings, the Budget and Management Division).
- Match the user's language (English or Spanish). Define jargon the first time you use it.
- Budget stage legend: Actual 2025, Adopted 2026, Requested 2027 (department asks), Proposed 2027 (Mayor).
```

## 8. Question routing examples (use as eval seeds)

| User asks | Expected behavior |
|---|---|
| "Is my property tax going up?" | `ScopePicker`/ask for assessed value or address → `get_household_charges` → `HouseholdCityBill`; explain levy +2% vs rate $7.61→$7.29; city portion only |
| "How much does the city spend on police?" | `get_department(police)` → `DeptSnapshot` with $343.9M proposed, $310.1M adopted 2026, $330.7M actual 2025 |
| "What got cut?" | `ScopePicker` (vs last year or vs requests?) → `top_changes` / `ask_vs_got` |
| "What's happening with 911?" | alias → Emergency Communications → `DeptSnapshot` + `get_positions` |
| "Where does the sales tax go?" | `get_revenue_breakdown(sales_tax)` → $218.2M, ~$58.8M police/fire, rest pensions |
| "Why is there a deficit?" | `explain_gap` → `GapStory` + `GapWaterfall` |
| "What's a levy?" | `lookup_term` → `GlossaryCard` |
| "Which libraries are getting money?" | `get_capital_projects({query: library})` + `search_budget_text` |
| "Should the Council cut police?" | Neutral: relevant figures and constraints (Act 12 staffing requirements) + how to weigh in; no opinion |
| "How much does the city pay in overtime?" | `search_budget_lines({query: 'overtime', groupBy: 'dept'})` → `LineItemTable` aggregated by department, scope stated |

## 9. Evals

The full question inventory, with personas and coverage status, is `docs/05-QUESTION-BANK.md`; seed cases with verified figures are in `evals/golden-seed.yaml`.


`evals/golden.yaml`: 50+ questions, each with expected tool(s), expected exact figure(s), expected citation page(s), and forbidden behaviors (e.g. "states an opinion", "omits scope"). Runner scores tool choice, numeric exactness (after grounding guard), citation correctness, neutrality (LLM-judge with a rubric), and latency. Runs in CI on every agent/prompt/tool change. Include Spanish variants.

## 10. Cost and safety

Cache tool results (data is static per budget version) and cache full answers for the top ~100 questions. Rate-limit per IP. Route trivial glossary/navigation questions to a Haiku-class model. Log questions (no addresses, no IPs retained beyond rate-limit window) to learn what people ask; publish the top questions as a "What Milwaukee is asking" view.
