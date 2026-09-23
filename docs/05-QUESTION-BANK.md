# 05 — Question Bank: what residents and reporters will actually ask

Written by role-playing the people who will use this, then mapping every question to a tool, a component, and the page that answers it. Use it three ways: (1) to check tool coverage, (2) as the seed for `evals/golden.yaml`, (3) for suggested-question chips on each page.

Status key: ✅ covered by existing tool · 🆕 needs a tool added in this doc · 📄 needs data not yet in the pipeline · 🚫 not in these documents (agent must say so and point elsewhere)

Page numbers are printed Summary pages unless marked "Detailed". Figures quoted here were read from the PDFs.

---

## Personas

**Residents**
- *Denise, homeowner in Sherman Park* — "Is my bill going up, and what am I getting?"
- *Marco, renter in Walker's Point* — "Does any of this touch me?"
- *Ruth, retiree* — "Will 911 and the fire department still come fast?"
- *Keisha, parent* — "Libraries, parks, safe streets for my kids."
- *Tom, small business owner* — "Fees, permits, parking, the street in front of my shop."
- *First-time budget reader* — "I don't know what any of this means."

**Journalists**
- *City Hall reporter* — needs the story, the change, the quote-able figure, by deadline.
- *Data reporter* — needs line items, CSVs, reconciliation, methodology.
- *Community/neighborhood reporter* — needs local angles and plain-language explainers.
- *Radio host (88Nine/HYFIN)* — needs 3 accurate facts in 60 seconds, readable aloud.
- *Fact-checker* — needs to test a politician's claim against the documents.

---

## A. "What does this mean for me?" (residents)

| # | Question | Tool(s) | Component | What the answer must contain | Status |
|---|---|---|---|---|---|
| A1 | Is my property tax going up? | `get_household_charges` | `HouseholdCityBill` | City rate $7.61 → $7.29 per $1,000; levy +2%; depends on your assessment change; city portion only (MPS, County, MMSD, MATC separate). p.7 | 🆕 |
| A2 | What will the city charge my household in total next year? | `get_household_charges({assessedValue, frontageFt, carts})` | `HouseholdCityBill` | City levy share + solid waste $280.00/yr (from $271.80) + snow & ice $1.23/ft (from $1.19; $49.20 for 40 ft) + street lighting $1.16/ft (from $1.12) + sewer/stormwater avg $247.02 (+$5.14) + extra cart $83.68 each. p.141, 159, 203 | 🆕 📄 fees table |
| A3 | Where does each dollar of my city property tax go? | `get_tax_rate_breakdown` | `LevyDollar` | Per $1,000 assessed: GCP $3.05, debt $2.31, pensions $1.80, contingent $0.11, capital $0.02 = $7.29. p.7 | 🆕 |
| A4 | How much of my tax pays for police? | `get_tax_rate_breakdown` + `calculate` | `LevyDollar` + method note | Property tax isn't earmarked by department. Exact split is only by section; any per-department figure is an **allocation estimate** and must be labeled with its method. | 🆕 (method caveat) |
| A5 | I rent. Does this affect me? | `get_household_charges({address, view:'renter'})` + `get_services_per_resident` | `RentersReceipt` | Your unit's share of the building's city tax and charges (paid by the owner), your direct contributions (2% city sales tax), and services per resident. Pass-through to rent is not measured. docs/07 | 🆕 |
| A6 | Is my water bill going up? | `search_budget_text({dept:'water-works'})` | `SourceQuotes` | Water Works budget $228.9M; ~$126.1M from water service fees (p.201). Household water rate impact: only what the document states; otherwise say it's set through the Water Works rate process. | ✅ / 🚫 partial |
| A7 | Is garbage pickup changing? | `get_department('dpw-operations')` + `get_fees('solid_waste')` | `DeptSnapshot` + `FeeChangeCard` | Fee change, sanitation service highlights, positions. p.137–143 | 🆕 fees |
| A8 | Will 911 answer slower? | `get_department('emergency-communications')` + `get_kpis` + `get_positions` | `DeptSnapshot`, `KpiCard`, `PositionsDiff` | $25.77M proposed (−$1.40M); positions 241 → 230; −10 ECO V "elimination of funded vacant positions," −4 leads eliminated (p.80). KPIs as printed. No prediction of response times. | ✅ + reason filter 🆕 |
| A9 | Is my fire station closing? | `search_budget_text({dept:'fire'})` + `get_positions('fire')` | `SourceQuotes`, `PositionsDiff` | What the document says about companies/staffing; Fire positions 966 → 984 (p.13). If not addressed: say so. | ✅ |
| A10 | Are there more police officers? | `get_department('police')` + `get_budget_facts('act12')` | `DeptSnapshot`, `FactCard` | Positions 2,526 → 2,585; funds 3 recruit classes × 65; Act 12 staffing requirement; 25 SROs mandated (p.117–118). | 🆕 facts |
| A11 | What's happening with my library? | `get_department('library')` + `get_capital_projects({query:'library'})` | `DeptSnapshot`, `CapitalList` | Positions 394 → 398; capital begins funding a new Midtown branch (p.5). | ✅ |
| A12 | Will my street get fixed? | `get_capital_projects({query:'paving'})` + `search_budget_text` | `CapitalList`, `SourceQuotes` | High Impact Paving + local road reconstruction $19.2M, "highest total on record," enabled by a $6M Transportation Fund transfer (p.6). Street-level schedules are not in the budget. | ✅ 🚫 (street list) |
| A13 | What about the abandoned house on my block? | `search_budget_text({query:'Raze and Revive'})` + `get_department('neighborhood-services')` | `SourceQuotes`, `DeptSnapshot` | Raze and Revive maintained in capital budget (p.6); DNS changes. | ✅ |
| A14 | What's being built in my neighborhood? | `get_district_info({address})` + `get_capital_projects` | `DistrictCard`, `CapitalList` | Alderperson + district; only capital projects the document ties to a place. Most spending isn't geographic; say so. | 🆕 📄 manual place tags |
| A15 | Who represents me and when can I speak? | `get_district_info` + `get_calendar` | `DistrictCard`, `Timeline` | Alder by district (front matter lists all 15); hearings from Council calendar; Nov 14 deadline. | 🆕 📄 calendar |
| A16 | Did the Mayor listen to the public survey? | `search_budget_text({query:'survey'})` | `SourceQuotes` + related figures | Survey asked for better roads, more demolitions, holding taxes/fees (p.6). Show the related figures; no verdict. | ✅ |
| A17 | What is a levy / GCP / FTE? | `lookup_term` | `GlossaryCard` | Plain definition + why it matters + page. | ✅ |
| A18 | Why does the city always say it's broke? | `explain_gap` | `GapStory` | Five drivers: shared revenue frozen, pensions since 2010, 2023 pension spike, ARPA ending, Act 12 (p.1–4). | ✅ |
| A19 | Where does the sales tax money go? | `get_revenue_breakdown('sales_tax')` | `RevenueMix` | ~$218.2M; ~$58.8M to general fund for police/fire; rest to pensions (p.156). | ✅ |
| A20 | Is parking going to cost more? | `search_budget_lines({kind:'revenue', query:'parking'})` | `LineItemTable`, `AskVsGotBars` | Transportation Fund: citation revenue $14.0M → $21.0M proposed (Mayor proposed $3M above the request); permits $3.35M → $6.0M; meters $4.63M → $6.18M (p.190). | 🆕 revenue lines |

## B. "What's the story?" (City Hall reporter)

| # | Question | Tool(s) | Component | Must contain | Status |
|---|---|---|---|---|---|
| B1 | Top 10 changes vs this year's budget | `top_changes({level:'dept', vs:'adopted_2026'})` | `ChangeLeaderboard` | Scope stated; Police +$33.8M leads; Econ Dev Fund $15M → $0 | ✅ |
| B2 | What did departments ask for that the Mayor cut? | `ask_vs_got({level:'dept'})` | `AskVsGotBars` | ~$33.5M cut from requests overall (p.5); GCP requested $878.9M vs proposed $846.8M | ✅ |
| B3 | Which positions were requested but not funded? | `ask_vs_got({level:'positions'})` | `PositionsDiff` | From Detailed requested units vs proposed units by title | 🆕 level |
| B4 | Any layoffs, or only vacant positions? | `get_positions({changeType:'eliminated', reasonCategory})` | `PositionsDiff` grouped by reason | Group by reason category; show raw reason text; never infer "layoff" unless the document says so | 🆕 reason_category |
| B5 | Which positions lose ARPA or grant funding? | `get_positions({reasonCategory:['arpa_sunset','grant_change']})` | `PositionsDiff` | e.g. "Sunsetting ARPA-funded positions" (p.55); DVHRT positions moved from ARPA contract to city funding (p.120) | 🆕 |
| B6 | How much is the city drawing from reserves, and what's left? | `get_reserves` | `ReservesCard` | Unassigned GF balance $79.6M end-2025; half ($39.8M) transferred; PDAF $6M; TSF withdrawal in GCP $41.3M (p.5, 8) | 🆕 📄 |
| B7 | Why couldn't the Mayor cut police? | `get_budget_facts({topic:'act12'})` | `FactCard` | Act 12 sworn staffing requirements; sales tax expenditure requirements; stated in document. Neutral. | 🆕 |
| B8 | What does the state require to get its aid? | `get_budget_facts({topic:'erip'})` | `FactCard` | ERIP: at least $29.6M in reductions from requested to qualify for $11.6M (p.5) | 🆕 |
| B9 | How much is borrowing going up? | `get_borrowing` | `BorrowingCard` | Capital $236.7M → $316.6M; debt $272.2M → $326.6M; 2027 final year of a three-year levy-supported borrowing surge (p.5, 7, 23) | 🆕 📄 |
| B10 | How much of the levy goes to pensions and debt vs services? | `get_tax_rate_breakdown` | `LevyDollar` | GCP $143.7M; retirement $84.7M; debt $109.1M (p.7) | 🆕 |
| B11 | What's new in 2027 that wasn't there before? | `top_changes({vs:'adopted_2026', filter:'new'})` + `search_budget_text` | `ChangeLeaderboard` | Lines/positions with null 2026 and non-null 2027 | ✅ (filter) |
| B12 | What did the Mayor fund above the department's request? | `ask_vs_got({direction:'above_request'})` | `AskVsGotBars` | e.g. parking citation revenue estimate above request; Compliance & Engagement positions 19 → 23 vs 19 requested (p.13) | ✅ |
| B13 | How does 2025 actual spending compare with what was budgeted? | `get_department` / `top_changes({vs:'actual_2025'})` | `DeptSnapshot` | Police actual 2025 $330.7M vs 2026 adopted $310.1M — context for "increase" framing | ✅ |
| B14 | What's the streetcar costing / earning? | `search_budget_lines({query:'streetcar'})` | `LineItemTable` | Streetcar revenue $2.69M → $1.24M (p.190) plus expense lines | 🆕 revenue lines |

## C. "Give me the data." (data reporter)

| # | Question | Tool(s) | Component | Must contain | Status |
|---|---|---|---|---|---|
| C1 | Overtime budget by department | `search_budget_lines({query:'overtime', groupBy:'dept'})` | `LineItemTable` | "Overtime Compensated" lines; scope; four stages | ✅ |
| C2 | Consultant / professional services spending | `search_budget_lines({account:'634000'})` | `LineItemTable` | Account 634000 across departments | ✅ |
| C3 | IT spending citywide | `search_budget_lines({account:'634500'})` | `LineItemTable` | Account 634500 | ✅ |
| C4 | Budgeted cost of a position title | `get_positions({title})` | `PositionsTable` | Dollars ÷ units from Detailed position lines, labeled "budgeted, not an individual's pay" | 🆕 |
| C5 | Export everything for a department | Explore page export | CSV | All line items with account codes and cites | ✅ |
| C6 | Do the two documents agree? | reconciliation report (public) | `MethodologyPage` | Link to reconciliation results; known discrepancies | 📄 |
| C7 | Account code lookup | `search_budget_lines({account})` | `LineItemTable` | FUND/ORG/SBCL/ACCOUNT explained | ✅ |
| C8 | Performance measures that got worse | `get_kpis({trend:'worse'})` | `KpiCard` list | As printed (2024 actual / 2025 projected / 2026 planned); no invented direction where "better" is ambiguous | ✅ (flag field 📄) |

## D. "Make it fast and sayable." (radio host, community reporter)

| # | Question | Tool(s) | Component | Must contain | Status |
|---|---|---|---|---|---|
| D1 | Give me three facts about the budget for air | `get_budget_overview` + `top_changes` | `BroadcastBrief` | 3 facts, numbers written for speech ("about three hundred forty-four million dollars"), citations off-air | 🆕 component |
| D2 | Explain the levy-vs-rate thing in 30 seconds | `get_tax_rate_breakdown` | `BroadcastBrief` / `Explainer` | Rate down, levy up 2%, assessments up ~6.5% (derived) | 🆕 |
| D3 | What's the one-sentence version of this budget? | `get_budget_overview` + `search_budget_text('introduction')` | `BudgetNumberCard` | Attributed: "The Mayor's proposal says it maintains core services while holding tax and fee increases under inflation" (p.1) | ✅ |
| D4 | Spanish version for our audience | any + language | same, in Spanish | Match language; same figures | ✅ |

## E. "Is that true?" (fact-checker, skeptical resident)

The agent never issues a verdict label. It shows the claim beside what the documents show, with figures and pages, and notes what the documents don't address.

| # | Claim to test | Tool(s) | Component |
|---|---|---|---|
| E1 | "Taxes and fees held under inflation." | `get_tax_rate_breakdown`, `get_fees` | `ClaimCheck`: levy +2%; fees +3.0–3.6%; inflation figure only if the document gives one |
| E2 | "Police are being defunded / massively expanded." | `get_department('police')` | `ClaimCheck` with all four stages |
| E3 | "The city is sitting on a pile of reserves." | `get_reserves` | `ClaimCheck` |
| E4 | "Your tax rate went down." | `get_tax_rate_breakdown` | `ClaimCheck`: true for rate; levy rose; bill depends on assessment |
| E5 | "The budget cuts 911 dispatchers." | `get_positions('emergency-communications')` | `ClaimCheck`: 10 funded vacant ECO V positions eliminated; 4 lead positions eliminated (p.80) |

## F. Things the agent must decline or redirect (🚫)

| Question | Response |
|---|---|
| What's the MPS / school tax / county parks / MCTS budget? | Not in the city budget; separate governments; name them |
| How much does [named person] earn? | Only budgeted cost by position title is in the documents |
| Will the Council pass this? What will they change? | No predictions; show calendar and, after November, adopted amendments |
| Is this a good budget? Should they cut X? | Neutral: relevant figures, constraints, and how to weigh in |
| How does Milwaukee compare with Madison? | Not in these documents |
| What will 2028 look like? | Only what the document states about future years |
| My exact water bill for my usage | Usage-based; not in the budget |

---

## Tool additions this implies

Add to docs/03 §3 (all return the standard `ToolResult` envelope):

| New / changed tool | Purpose | Data needed |
|---|---|---|
| `get_household_charges({assessedValue?, address?, frontageFt=40, extraCarts=0})` (replaces `estimate_city_tax`) | City levy share + city fees, 2026 vs 2027, each line cited; defaults labeled | `fees` table 📄 |
| `get_tax_rate_breakdown()` | Levy and rate by section (A, B, C, D, F), "where $1 goes" | `section_totals` ✅ |
| `get_fees({fee?})` | Fee schedule changes | `fees` table 📄 |
| `search_budget_lines({query?, account?, dept?, kind: 'expense'\|'revenue', groupBy?})` (replaces `search_line_items`) | Expense and revenue lines incl. special revenue funds | `revenues` expanded to fund-level lines 📄 |
| `ask_vs_got({level: 'dept'\|'line_item'\|'positions', direction})` | Adds positions level and "above request" | `position_lines` ✅ |
| `get_positions({dept?, title?, changeType?, reasonCategory?})` (replaces `get_position_changes`) | Position changes with classified reasons; budgeted cost per title | `position_changes.reason_category` 📄 |
| `get_reserves()` | TSF, unassigned GF balance, PDAF, withdrawals | `budget_facts` 📄 |
| `get_budget_facts({topic})` | Curated, cited facts: Act 12, ERIP, recruit classes, SRO mandate, legal deadlines, survey results | `budget_facts` 📄 |
| `get_borrowing()` | Borrowing authorizations, capital vs debt trend | p.23, 184, 211 📄 |
| `get_district_info({address})` | Aldermanic district + alderperson + place-tagged capital projects | front-matter alders ✅; district lookup (port) 📄; manual place tags 📄 |

New components: `HouseholdCityBill`, `LevyDollar`, `FeeChangeCard`, `ReservesCard`, `FactCard`, `BorrowingCard`, `DistrictCard`, `PositionsTable`, `BroadcastBrief`, `ClaimCheck`, `MethodologyPage`.

## Data additions this implies

Add to docs/02 §4:

```
fees            fee ('solid_waste'|'extra_cart'|'snow_ice'|'street_lighting'|'sewer_stormwater_avg'|…),
                unit ('per_year_per_unit'|'per_frontage_ft'|'avg_household_per_year'),
                value_2026, value_2027, pct_change, revenue_2027, cite
budget_facts    id, topic, statement (neutral, close to document wording), value?, unit?, cite, reviewed_by
                -- hand-authored from the narrative, every row human-reviewed
position_changes.reason_category   -- rule-based from reason text:
                vacant_elimination | arpa_sunset | grant_change | reclassification | new_funded |
                transfer | contract_to_city | other   (always display raw reason alongside)
capital_projects.place_tags        -- manual, only where the text names a place
```

Seed values for `fees` (verify in P1 review): solid waste $271.80 → $280.00/yr (p.159); extra garbage cart $81.24 → $83.68/yr (p.159); snow & ice $1.19 → $1.23 per frontage ft (p.159); street lighting $1.12 → $1.16 per frontage ft (p.159); sewer + stormwater average household $241.88 → $247.02 (derived from "+$5.14", p.203).

## Method notes the UI must show

- **Levy by department is an allocation, not a fact.** Only the section split (p.7) is exact. If the receipt shows departments, state the method (for example, proportional to each department's levy-supported net spending) and label it "estimate."
- **"Cut" needs a comparison point.** Always say vs what: last year's adopted budget, the department's request, or last year's actual spending.
- **Vacant ≠ layoff.** Use the document's reason text.
- **Derived numbers are labeled** (e.g. assessed value growth ≈ 6.5%, the 2026 sewer/stormwater base).
