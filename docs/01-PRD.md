# 01 — Product Requirements

## 1. The problem

In late September 2026 Mayor Cavalier Johnson submitted the **2027 Proposed Plan and Executive Budget** to the Common Council: a 224-page narrative summary and a 455-page line-item detailed budget. The Council holds legislative hearings in October, Finance & Personnel amendment day is in early November, and the Council must act by the **November 14** legal deadline.

That gives the public roughly seven weeks to understand a $2.26 billion document written for budget analysts. Residents can't find what matters to them. Reporters spend hours reconciling tables across two PDFs. Neither has a fast way to ask "what changed and why?"

## 2. Audiences and their jobs

**Residents.** "What does this mean for me — my tax bill, my library, my street, 911 response?" They need plain language, personal relevance, and a way to take part (hearings, their alderperson).

**Journalists (newsrooms, public media, community reporters).** "What's the story, and can I trust and cite the number?" They need speed, exact figures with page citations, comparisons across four budget stages, exportable charts/CSVs, and story leads.

**Secondary: council staff, advocates, students.** Same needs as journalists, less deadline pressure.

## 3. What makes the budget hard (and what the product must handle)

These come straight from reading the documents and they drive design:

- **Four budget stages side by side.** Nearly every table shows 2025 Actual, 2026 Adopted, 2027 Requested (what departments asked for), and 2027 Proposed (what the Mayor recommends). The Requested→Proposed gap is where the Mayor's choices live (about $33.5M cut from requests overall). Adopted→Proposed is the year-over-year story. Actual matters because adopted budgets can understate reality (Police spent $330.7M in 2025 against a 2026 adopted budget of $310.1M; the 2027 proposal is $343.9M).
- **Multiple meanings of "the budget."** General City Purposes ($846.8M), property-tax-supported funds A–F ($1.77B), special revenue funds like Water Works and Sewer ($492.6M), all funds ($2.26B). Double-counting traps: the Fringe Benefit Offset line (−$240.6M), reimbursable services deductions, capital vs. operating.
- **Levy vs. rate.** The city tax levy rises 2% ($336.8M → $343.6M) while the city tax *rate* falls from $7.61 to $7.29 per $1,000 of assessed value, because total assessed value grew. Whether a given homeowner's bill rises depends on their own assessment change. This is the single most misunderstood number and a flagship explainer.
- **The structural deficit story.** The introduction explains the gap through five drivers (State Shared Revenue frozen since the 1990s, pension costs since 2010, the 2023 pension spike, $394M in ARPA used 2022–24, Act 12's sales tax and mandates). It's the "why" behind almost every question.
- **Mandates constrain choices.** Act 12 requires sworn police/fire staffing levels; the state Expenditure Restraint Incentive Program required at least $29.6M in reductions from requested to qualify for $11.6M in aid. Context the agent must surface when users ask "why not just…".
- **Jargon.** Levy, GCP, O&M FTE, BCU, SBCL, TSF, PDAF, ERIP, SSR, PILOT, fringe benefit offset, special purpose account.
- **Charts without data.** Several key charts in the summary (budget-gap history, State Shared Revenue vs. levy, pension cost growth) are graphics with no numbers in the text layer.

## 4. Product concept

A **living, citable map of the budget** with an AI guide inside it. Two ways in, one set of components:

1. **Explore** — curated visual views anyone can browse without typing.
2. **Ask** — a conversational guide that answers with the same components, drives the Explore canvas, and lets users pin answers to a shareable Board.

### Signature experiences (what makes it unique)

**A. The Budget Diff lens.** Every figure can be viewed across the chain *Actual 2025 → Adopted 2026 → Requested 2027 → Proposed 2027 → (Adopted 2027, after Nov 14)*. Toggle "vs. last year" / "vs. what they asked for" / "vs. what they spent." Sort any view by biggest changes. After Council action, adopted amendments layer in and the app becomes the record of what changed between the Mayor's proposal and the final budget.

**B. Ask → answer as UI, driving the canvas.** A question like "How is 911 changing?" returns a department snapshot card, an ask-vs-got bar, the positions-cut table, and a citation to page 77, and the main canvas navigates to Emergency Communications. The chat and the page are one experience, not a chatbot bolted to a dashboard. Answers are live mini-views: a comparison carries its own lens selector, so a reporter can flip from "vs last year" to "vs what they asked for" without asking again, and "add the library to this" edits the view in place.

**C. The Story Board.** Any generative answer can be pinned to a Board (shared agent state). The user can then ask the agent to act on the Board: "add Fire for comparison," "turn these into a one-paragraph summary with citations." Boards share by URL and export as PNG, CSV, and embed code. Journalists assemble a story; residents share "what I learned."

**D. My Household City Bill.** Enter an address (or an assessed value) → the city portion of the property tax plus the city fees every household pays (solid waste, snow & ice, street lighting, sewer/stormwater), 2026 vs 2027, with where each levy dollar goes by section, with the levy-vs-rate explainer and a clear statement that MPS, Milwaukee County, MMSD, MATC and state credits are separate lines on the real bill. Port the address/MPROP lookup already built in Budget Compass.

**E. Receipts on everything.** Citation chips on every number, a source drawer that opens the PDF at the exact page, and a scope label on every total. Trust is the product.

**F. (Phase 3) Balance It Yourself.** Close the 2027 gap with the real levers (reserve withdrawals, revenue changes, cuts) under the real constraints (Act 12 staffing mandates, ERIP reduction threshold). The agent narrates the consequences using only the document's own figures.

### Explore views (v1)

- **Overview:** total, where the money comes from, where it goes (treemap by section → department), levy vs. rate explainer, "how the gap was closed" waterfall.
- **Department pages** (~30): mission, four-stage budget table as chart, services with costs and FTEs, key performance measures, service highlights, capital projects, positions added/cut with reasons.
- **What changed:** sortable leaderboard of biggest increases/decreases by department, line item, and positions, with the Diff lens.
- **Revenue:** State Shared Revenue, sales tax (est. $218.2M, of which $58.8M funds police/fire in the general fund and the rest pensions), property tax, charges for services; 1995 vs 2027 mix.
- **Timeline & take part:** budget calendar, hearing dates (from the Common Council calendar, not invented), find your alderperson by address, how to submit public comment.

## 5. Scope

**In v1:** Explore views, Ask with generative UI, citations/source drawer, scope picker, glossary, Board (pin, share URL, export), tax receipt by assessed value, English.

**In v1.1:** tax receipt by address (MPROP port), alderperson lookup, Spanish UI and answers, embeddable chart widgets for newsrooms.

**v2 (after Nov 14):** Adopted budget ingest, amendment tracker (from Legistar), Diff lens extended to Adopted 2027.

**v3:** Balance It Yourself simulator; reuse for the 2028 cycle; generalize the pipeline to other cities' budget formats.

**Out of scope:** user accounts, advocacy content, predictions about votes, MPS/County budgets, real-time spending data.

## 6. Success criteria

- 100% of golden reconciliation tests pass; 95%+ of golden Q&A evals return the exact expected figure with the correct page.
- Zero ungrounded numbers in agent output (grounding guard, see docs/03 §6).
- Median time-to-first-useful-answer under 6 seconds; first chart streams under 3 seconds.
- Launch publicly before the first October legislative hearing.
- At least one newsroom uses an exported chart or embed with citation during the hearing period.
- Lighthouse accessibility ≥ 95 on Overview and a department page.

## 7. Voice and design direction

Editorial, not SaaS dashboard: big typographic numbers, generous whitespace, warm Cream City–brick neutrals with a restrained accent, plain-language headlines ("Police would get $33.8M more than this year's budget"), and every sentence attributable. Headlines must be factual and neutral; the source table is always one tap away. Numbers are formatted for humans ($343.9M; "about $X per resident per day") with exact figures on hover/tap.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Extraction errors produce a wrong number that gets published | Reconciliation suite, per-row citations, "report an error" link on every component |
| Agent states a number not in the data | Tools-only numbers, grounding guard, evals in CI |
| Perceived bias (public media) | Attribution language, neutral headlines, no advocacy, show Requested and Actual beside Proposed |
| Timeline (hearings in October) | Explore views ship first and are useful without AI; agent layers on |
| LLM cost spike from a viral link | Response caching for common questions, rate limits, Haiku-class routing |
| Budget changes (Council amendments) | Versioned `budget_version` in every table from day one |
