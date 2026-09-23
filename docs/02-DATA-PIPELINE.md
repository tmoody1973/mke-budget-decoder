# 02 — Data Pipeline: PDFs → trustworthy data

This is the highest-risk part of the project. Build and validate it before any UI.

Principle: **structured-first, RAG-second.** Budget questions are overwhelmingly numeric ("how much," "how did it change," "which grew most"). Vector search over PDF chunks is unreliable for numbers, so all numbers live in typed tables queried by deterministic functions. RAG is used only for narrative text (missions, service highlights, the introduction, capital project descriptions, reasons for position changes).

## 1. Source documents

Both PDFs have a clean embedded text layer (Arial/Calibri, WinAnsi). No OCR needed. `pdfinfo` prints harmless "name token" syntax warnings on the summary PDF; suppress stderr.

| Doc | Pages | Page offset | Role |
|---|---|---|---|
| `2027-Proposed-Plan-and-Executive-Budget-Summary.pdf` ("Summary") | 224 | **printed page N = PDF page N + 10** (intro p.1 = PDF 11; Police p.116 = PDF 126) | Narrative, department summaries, section totals, revenue narrative, capital, positions |
| `2027-Proposed-Detailed-Budget.pdf` ("Detailed") | 455 | Printed page IDs are section-style (e.g. `110.1`, `300.4`) in the footer | Line-item budget (BMD-2 forms) for every department and fund |

Store both `pdf_page` (for deep links) and `printed_page` (for human citations: "Summary p.116" / "Detailed 300.4").

## 2. Summary PDF structure

Front matter (PDF 1–10): title, guide, budget calendar (legal deadlines: submitted by Sept 28, Council action by Nov 14), elected officials including all 15 alderpersons by district (seed data for the alderperson feature), table of contents.

Then, by printed page:

- **1–6 Budget Introduction** — the structural-deficit narrative, five drivers, how the 2027 gap was closed (reserve withdrawals, revenue increases, expenditure reductions), capital highlights, public survey results. Contains charts whose data is **not** in the text layer (see §6).
- **7** 2027 Proposed Budget and Tax Rate Compared to Prior Year — sections A–N with Budget / Non-levy / Levy, 2026 vs 2027, plus tax rates. **Primary golden table.**
- **8–10** Comparisons by Budget Section (Adopted 2026, Requested 2027, Proposed 2027) by expense category and funding source.
- **11–12** Graphs (rate and levy; GCP spending and positions).
- **13** Change in Positions by department. **14–16** FTE tables (O&M, non-O&M, all).
- **17–21** Expenditures and funding sources vs prior years. **22** Department appropriations by funding category. **23** Borrowing authorizations.
- **27–162 Section A, General City Purposes** — one block per department (see template below), then Special Purpose Accounts, Fringe Benefit Offset, **Source of Funds (156–161)**, Tax Stabilization Fund Withdrawal (162).
- **163–173 B** Employee Retirement. **174–183 C** Capital Improvements (project listings by category). **184 D** City Debt. **187 F** Contingent Fund.
- **189–210 Special Revenue Funds G–N** (Transportation, Grant & Aid, Economic Development, Water Works, Sewer, County Delinquent Tax, Settlement).
- **211** Borrowing authorizations. **212** Clarification of Intent. **214** Tax Levy to Rate Conversion Table (assessed value $47,141,816,729 as of Aug 31, 2026).

### Department template (repeats for ~30 departments, 3–6 pages each)

1. Title + `MISSION:` text.
2. **BUDGET SUMMARY** table. Columns: `2025 Actual Expenditures | 2026 Adopted | 2027 Requested | 2027 Proposed | Change vs 2026 Adopted | Change vs 2027 Requested`. Rows: `FTEs - Operations & Maintenance`, `FTEs - Other`, `Total Positions Authorized`, `Salaries and Wages`, `Fringe Benefits`, `Operating Expenditures`, `Equipment`, `Special Funds`, `Total`, then Revenues (`Intergovernmental`, `Charges for Services`, `Licenses and Permits`, etc., `Total`).
3. **SUMMARY OF SERVICES DELIVERED** prose, then a services table: `Description | Operating Budget | Capital Budget | Grant Budget | FTEs`, ending in `Total`. Descriptions wrap across multiple lines and the amount sits on the middle line; reassemble by vertical proximity.
4. **Key Performance Measures** table. Note: the year columns are labeled `2024 Actual | 2025 Projected | 2026 Planned` (not 2027). Store the labels as printed; don't relabel. Footnotes marked `*` follow.
5. **SERVICE HIGHLIGHTS** bullets (narrative → RAG).
6. **CAPITAL PROJECTS** bullets with amounts in the text, e.g. `Police Vehicles ($2.0 million)` (extract amount + name + text).
7. **DETAILED LISTING OF POSITION AND FULL TIME EQUIVALENTS' CHANGES**: `Positions | O&M FTEs | Non-O&M FTEs | Position Title | Reason`, with a `Totals` row. Reasons wrap across lines.

Headers repeat on continuation pages (e.g. "POLICE DEPARTMENT" at top of 5 consecutive pages). DPW has three divisions each titled "DEPARTMENT OF PUBLIC WORKS"; disambiguate by the division name on the page.

A naive regex for the Budget Summary `Total` row worked on ~65% of department pages in a quick test; the rest vary (missing actuals, `$` placement, extra rows). Use coordinate-based table parsing, not regex over flattened text.

## 3. Detailed PDF structure (BMD-2 line-item forms)

Every page is the same fixed form, landscape 792×612 pt, 26 numbered lines per page. Header:

```
FUND ORG SBCL ACCOUNT | 2025 EXPENDITURE DOLLARS | 2026 BUDGET UNITS DOLLARS | LINE DESCRIPTION | PAY RANGE | 2027 REQUESTED UNITS DOLLARS | 2027 PROPOSED UNITS DOLLARS
```

Footer: `<DEPARTMENT NAME>   <page id e.g. 110.1>   3rd Run 9/14/26`. The run date identifies the budget version; store it.

**Column x-positions are stable across the whole document (±2 pt).** Header word `x0` values measured on pages 3, 51, 121, 201, 301, 401:

| Column | Header x0 | Notes |
|---|---|---|
| Line no. | ~33–35 | 1–26 |
| FUND | 49 | e.g. `0001` (general fund) |
| ORG | 85 | e.g. `1510` |
| SBCL | 110 | e.g. `R999` |
| ACCOUNT | 148 | e.g. `006000`, `630100` |
| 2025 DOLLARS | 214 | numbers are right-aligned: bucket by the word's **x1**, not x0 |
| 2026 UNITS | 269 | positions/FTEs |
| 2026 DOLLARS | 311 | |
| LINE DESCRIPTION | text starts ~368 | |
| PAY RANGE | 540 | e.g. `7BN`, `7HN` |
| 2027 REQ UNITS | 574 | |
| 2027 REQ DOLLARS | 616 | |
| 2027 PROP UNITS | 671 | |
| 2027 PROP DOLLARS | 713 | |

Parse with `pdfplumber.extract_words()`, group words into rows by `top`, assign each numeric word to the column whose band contains its right edge (derive bands from the header row on each page rather than hard-coding, then assert they match the table above). Blank cells are meaningful (e.g. a line funded in 2026 but not proposed in 2027); keep them as `NULL`, never 0.

Row types to classify:

- **Hierarchy headings** (no numbers, uppercase, in description column): department, `BUDGETARY CONTROL UNIT`, `(SUMMARY 1 BCU=8 DU)`, decision units/divisions, category headings `SALARIES & WAGES`, `OPERATING EXPENDITURES`, `EQUIPMENT PURCHASES`, `SPECIAL FUNDS`.
- **Account lines** (have FUND/ORG/SBCL/ACCOUNT) — the core line items.
- **Subtotals/totals** (`NET SALARIES & WAGES TOTAL*`, `OPERATING EXPENDITURES TOTAL`, `Total Before Adjustments`, `Gross Salaries & Wages Total`) → `is_subtotal = true`. Never sum subtotals with lines.
- **Position lines** (title + pay range + units + dollars) → `position_lines` table.
- **Counts** (`TOTAL NUMBER OF POSITIONS AUTHORIZED`, `O&M FTE'S`, `NON-O&M FTE'S`).
- **Deductions** in parentheses `(150,644)` → negative numbers (`Reimbursable Services Deduction`, `Capital Improvements Deduction`, `Grants & Aids Deduction`).
- **Notes** (`(Involves Revenue Offset-No Transfers from this Account)`, `(X) Private Auto Allowance…`) → attach to preceding line.

Asterisks on descriptions (`Overtime Compensated*`) are footnote markers; strip into a flag, keep the raw text.

Page counts per detailed section (for sanity checks): Capital Improvements 43, Administration 34, Health 33, DPW-Water Works 33, Library 29, DPW-Infrastructure 29, Police 23, DPW-Operations 22, Fire 18, Transportation Fund 16, Employee Relations 15, Sewer 15, City Development 12, others 1–10.

## 4. Database schema (Postgres, Drizzle)

Every table has `budget_version_id` (FK) so the Adopted budget can be loaded alongside Proposed in November without migrations.

```
budget_versions   id, fiscal_year (2027), stage ('proposed'|'adopted'), run_label ('3rd Run 9/14/26'), published_at
documents         id, budget_version_id, kind ('summary'|'detailed'), title, file_path, source_url, page_offset
departments       id, slug, name, short_name, section ('A'..'N'), parent_id (DPW divisions), aliases text[]
section_totals    section, line ('budget'|'non_levy'|'levy'), adopted_2026, proposed_2027, change, tax_rate_2026, tax_rate_2027, cite
dept_summary      dept_id, metric, actual_2025, adopted_2026, requested_2027, proposed_2027, cite
                  -- metric: fte_om, fte_other, positions, salaries, fringe, operating, equipment, special_funds,
                  --         total_expenditures, rev_<category>, rev_total
services          dept_id, description, operating, capital, grant, ftes, cite
kpis              dept_id, measure, col_labels text[], values text[], footnote, cite   -- keep as printed
position_changes  dept_id, positions, om_ftes, non_om_ftes, title, reason, reason_category, cite
capital_projects  dept_id, name, amount, description, category, place_tags text[], cite
line_items        id, dept_id, fund, org, sbcl, account, category, hierarchy_path text[], description,
                  pay_range, actual_2025, adopted_2026_units, adopted_2026, requested_2027_units,
                  requested_2027, proposed_2027_units, proposed_2027, is_subtotal, is_position,
                  is_deduction, footnote_flag, note, cite
revenues          fund, dept_id?, category, subcategory, line,   -- include special revenue fund lines (e.g. Transportation p.190)
                  actual_2025, adopted_2026, requested_2027, proposed_2027, cite
positions_summary dept_id, adopted_2026, requested_2027, proposed_2027, cite      -- Summary p.13
glossary          term, plain_definition, why_it_matters, cite
chunks            id, doc_id, dept_id, section_type, heading, text, pdf_page, printed_page,
                  embedding vector(…), tsv tsvector
mprop_parcels     taxkey, yr_assmt, address fields, unit, c_a_total, c_a_exm_total, p_a_total, p_a_exm_total,
                  c_a_class, land_use, land_use_gp, bldg_type, nr_units, own_ocpd, tax_rate_cd, dpw_sanitation,
                  geo_alder, lot_area, corner_lot, loaded_at      -- NO owner name/mailing fields (docs/07 §8)
fees              fee, unit, value_2026, value_2027, pct_change, revenue_2027, cite      -- docs/05
budget_facts      id, topic, statement, value?, unit?, cite, reviewed_by                 -- hand-authored, reviewed
calendar_events   date, title, kind ('hearing'|'amendment_day'|'adoption'|'deadline'), source_url
amendments        (v2) number, sponsor, dept_id, description, amount_change, status, legistar_url
```

`cite` = `{doc, pdf_page, printed_page, line_no?}` (jsonb). Money stored as integer dollars (the documents are whole dollars), FTEs as numeric(10,2).

## 5. Narrative chunking for RAG

**Superseded in detail by `docs/06-RAG-INGESTION.md`** (three retrieval lanes, measured chunk counts, concept index for the Detailed budget, working prototype). Summary below.


Chunk by document structure, not fixed token windows: one chunk per department section (mission, services prose, each service highlight bullet, each capital project bullet, each position-change reason), one per intro subsection, one per Source of Funds subsection, Clarification of Intent paragraphs. Keep chunks 80–400 tokens; prepend a context header (`Police Department — Service Highlights — Summary p.117`) before embedding. Tables are **not** chunked as text for answering; instead create one short "table card" chunk per table ("Police Budget Summary table: four stages of expenditures, FTEs, revenues — see dept_summary") so retrieval can route to the structured tool.

Retrieval: hybrid (Postgres full-text on `tsv` + pgvector cosine), merge with reciprocal rank fusion, optional rerank, filter by `dept_id` / `section_type` when the question names a department.

## 6. Chart data not in the text layer

These appear only as graphics in the Summary introduction and Source of Funds pages: Requested Budget Gaps (~2005–2027), State Shared Revenue vs City Tax Levy, Escalating Pension Costs, revenue-mix pies (1995 vs 2027), SSR actual vs inflation-adjusted. Options, in order of preference: (1) request the underlying series from the Budget & Management Division; (2) transcribe from rasterized pages and label the component "approximate, read from chart on p.X"; (3) use only the figures stated in the prose (e.g. 1995 charges for services 4.3% → 20.3% of GCP revenue in 2027; property tax 10.6% → 17.0%; intergovernmental 63.7% → 38.1%). Do not invent series.

## 7. Golden numbers (reconciliation tests)

Every figure below was read directly from the documents. The pytest suite must assert each against the loaded database, and assert structural sums (department totals sum to section totals; line items sum to department totals within each stage, excluding subtotals and handling the fringe offset).

| # | Figure | Value | Source |
|---|---|---|---|
| G1 | All funds, 2027 proposed | $2,261,087,412 (2026 adopted $2,075,687,722; +$185,399,690) | Summary p.7 |
| G2 | General City Purposes, 2027 proposed | $846,796,205 (2026 adopted $815,673,383; 2027 requested $878,902,850) | p.7–8 |
| G3 | Total city tax levy | $343,557,288 (2026 $336,820,871; +$6,736,417) | p.7 |
| G4 | City tax rate per $1,000 assessed | $7.29 (2026 $7.61) | p.7 |
| G5 | Estimated assessed value | $47,141,816,729 as of Aug 31, 2026 | p.7, p.214 |
| G6 | GCP levy | $143,688,740 (2026 $147,307,020) | p.7 |
| G7 | Tax Stabilization Fund withdrawal (GCP) | $41,301,000 (2026 $32,300,000) | p.8 |
| G8 | Employee Retirement (B) | $273,417,384 | p.7 |
| G9 | Capital Improvements (C) | $316,607,345 | p.7 |
| G10 | City Debt (D) | $326,623,735 | p.7 |
| G11 | Economic Development Fund (I) | $0 (2026 $15,000,000) | p.7 |
| G12 | Water Works (J) | $228,909,690 | p.7 |
| G13 | Police Dept total expenditures | Actual 2025 $330,680,888; Adopted 2026 $310,111,835; Requested $345,822,092; Proposed $343,937,125; +$33,825,290 vs adopted | p.116 |
| G14 | Fire Dept proposed | $172,888,103 (adopted $165,408,632) | p.91 |
| G15 | Emergency Communications proposed | $25,770,876 (−$1,401,068 vs adopted); positions 241 → 230 | p.77; p.13 |
| G16 | Total budgeted positions | 7,844 (2026: 7,818; +26) | p.13 |
| G17 | Police positions authorized | 2,585 (2026: 2,526) | p.13, p.116 |
| G18 | Local sales tax, total estimate | $218.2M; ~$58.8M to GCP for police/fire, remainder to pensions | p.156 |
| G19 | State Shared Revenue | $260.0M (+$5.5M) | p.157 |
| G20 | Detailed: Dept of Administration net salaries & wages | 2025 $10,901,893; 2026 $10,130,279; Req $10,967,573; Prop $10,501,580 | Detailed 110.1 line 10 |

Derived facts (compute in code, label as derived in UI): implied 2026 assessed base ≈ $44.26B (levy ÷ rate), so average assessed value grew ≈ 6.5%; a property whose assessment grew exactly at the average sees its city levy share rise ≈ 2%.

## 8. Pipeline stages and outputs

```
pipeline/extract/summary_tables.py   → section_totals, dept_summary, services, kpis, position_changes,
                                        positions_summary, revenues, capital_projects (parquet)
pipeline/extract/detailed_lines.py   → line_items, position_lines (parquet)
pipeline/extract/narrative.py        → chunks (jsonl, no embeddings yet)
pipeline/extract/departments.py      → departments + aliases (hand-reviewed YAML is fine)
pipeline/validate/                   → pytest reconciliation (§7) + cross-document checks
                                        (Summary dept totals == Detailed dept totals per stage)
pipeline/review/                     → HTML report: every extracted table beside a rasterized crop
                                        of its source page, for human spot-checking
scripts/load.ts                      → upsert into Postgres, embed chunks via Voyage
```

The human-review report matters: before launch, a person should eyeball every department's four-stage table against the page image. Budget it (≈2 hours).

## 9. Reuse from Budget Compass

Budget Compass already extracted the 2026 adopted budget (line items, KPIs, service descriptions) with pdfplumber and learned: combining `extract_tables()` with text parsing captures more than either alone; a ~70% empty-cell threshold filters chart artifacts; categorizing tables by keywords enables targeted parsers. Port those utilities and the MPROP address normalization/fuzzy match rather than rebuilding. The 2026 extraction is also a cross-check: its adopted figures should match the "2026 Adopted" column here.
