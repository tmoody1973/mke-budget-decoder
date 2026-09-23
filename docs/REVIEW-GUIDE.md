# Review guide — 2027 Proposed Budget extraction

_Generated from the pipeline's own data on 2026-09-23. Every page number below comes from the extracted files, not from memory._

## What you're doing, in one paragraph

A computer program read two city PDFs and copied their tables into data. Tests already prove the numbers add up to the city's own printed totals (483 tests pass). What tests **can't** prove is that the program copied the *right* table, put a number under the *right* year, or described things fairly. Only a person looking at the page can. Your job: compare what the program extracted against the actual PDF page, and tick a box when they match. You are not checking the city's math (the tests do that) and you're not judging whether the budget is good or bad.

**Time:** about 2 hours. Do it in sittings; the checkboxes save your place.

---

## Step 0 — Set up (5 minutes)

**1. Open the review report** (it shows each extracted table beside a picture of its source page):

```
open /Users/tarikmoody/Projects/mke-budget-decoder/data/review/index.html
```

**2. Open the two PDFs** (you'll use them to zoom in when the picture in the report is too small):

- **Summary PDF** — the short book (224 pages), department overviews:
  `open "/Users/tarikmoody/Projects/mke-budget-decoder/data/raw/2027-Proposed-Plan-and-Executive-Budget-Summary.pdf"`
- **Detailed PDF** — the long book (455 pages), line-by-line forms:
  `open "/Users/tarikmoody/Projects/mke-budget-decoder/data/raw/2027-Proposed-Detailed-Budget.pdf"`

**3. Understand the two kinds of page number (important — this trips everyone up):**

| | Printed page (at the bottom of the paper) | PDF page (what Preview's page box shows) | How to jump there |
|---|---|---|---|
| **Summary PDF** | e.g. "116" | printed + 10 → **126** | In Preview: **Go ▸ Go to Page…** (⌥⌘G), type the **PDF page** |
| **Detailed PDF** | e.g. "300.4" (footer, bottom middle) | a plain number, e.g. **219** | Same menu, type the **PDF page** |

This guide always gives **both**. Type the PDF page into "Go to Page"; use the printed page to confirm you're in the right place.

**4. How to record what you find:** tick `[x]` in this file as you go (open it in any text editor or VS Code). If something is wrong, write a note on the line under it starting with `NOTE:`. When you're done, tell Claude **"apply my review"** — Claude will record you as the reviewer (`reviewed_by`) on everything you ticked and fix anything you noted.

**What counts as a problem:**
- ❌ a number in the report that isn't on the page, or sits under a different year
- ❌ a row missing (the page has it, the report doesn't)
- ❌ the wrong page or wrong table shown
- ❌ a description that says something the page doesn't
- ✅ **not** a problem: blanks. A blank cell on the page is stored blank on purpose (never as 0). A "-" in the page is also blank.

---

## Part A — Department numbers (≈75 minutes, the most important part)

In the report, click a department in the top menu. For each one, check **three things** against the page picture on the right (zoom the PDF if the picture is small):

1. **Budget summary → "Total" row under Expenditures**: all four numbers (2025 Actual, 2026 Adopted, 2027 Requested, 2027 Proposed) match the page.
2. **"Total Positions Authorized"** row: same four columns match.
3. **Pick any one row** in Services or Position changes and confirm it matches the page.

If all three match, tick the box. You don't need to check every row — the tests already prove the rows add up to the totals. You're checking that the program read the right table in the right columns.

The **Detailed PDF** column is optional: open it only if something in the Summary looks wrong and you want the line-by-line version.

| ✓ | Department | Summary PDF — printed pages (PDF pages) | 2027 Proposed total to look for | Detailed PDF pages (optional) |
|---|---|---|---|---|
| [ ] | **Department of Administration** | p.29–39 (PDF 39–49); table on printed p.29 | $25,062,669 | PDF 3–36 (110.x) |
| [ ] | **Assessor's Office** | p.40–42 (PDF 50–52); table on printed p.40 | $5,933,850 | PDF 37–42 (120.x) |
| [ ] | **City Attorney** | p.43–46 (PDF 53–56); table on printed p.43 | $9,751,037 | PDF 43–47 (130.x) |
| [ ] | **Department of City Development** | p.47–55 (PDF 57–65); table on printed p.47 | $8,667,262 | PDF 48–59 (140.x) |
| [ ] | **City Treasurer** | p.56–59 (PDF 66–69); table on printed p.56 | $5,097,630 | PDF 60–64 (150.x) |
| [ ] | **Common Council - City Clerk** | p.60–64 (PDF 70–74); table on printed p.60 | $13,387,317 | PDF 65–72 (160.x) |
| [ ] | **Department of Community Wellness and Safety** | p.65–66 (PDF 75–76); table on printed p.65 | $2,789,273 | PDF 73–77 (170.x) |
| [ ] | **Department of Compliance and Engagement** | p.67–69 (PDF 77–79); table on printed p.67 | $2,079,094 | PDF 78–81 (180.x) |
| [ ] | **Comptroller** | p.70–73 (PDF 80–83); table on printed p.70 | $6,609,594 | PDF 82–87 (190.x) |
| [ ] | **Election Commission** | p.74–76 (PDF 84–86); table on printed p.74 | $3,496,354 | PDF 88–91 (200.x) |
| [ ] | **Department of Emergency Communications** | p.77–80 (PDF 87–90); table on printed p.77 | $25,770,876 | PDF 92–96 (210.x) |
| [ ] | **Department of Employee Relations** | p.81–86 (PDF 91–96); table on printed p.81 | $6,871,919 | PDF 97–111 (220.x) |
| [ ] | **Fire and Police Commission** | p.87–90 (PDF 97–100); table on printed p.87 | $6,136,786 | PDF 112–116 (230.x) |
| [ ] | **Fire Department** | p.91–94 (PDF 101–104); table on printed p.91 | $172,888,103 | PDF 117–134 (240.x) |
| [ ] | **Health Department** | p.95–99 (PDF 105–109); table on printed p.95 | $23,043,869 | PDF 135–167 (250.x) |
| [ ] | **Library** | p.100–104 (PDF 110–114); table on printed p.100 | $35,142,226 | PDF 168–196 (260.x) |
| [ ] | **Mayor's Office** | p.105–107 (PDF 115–117); table on printed p.105 | $2,256,261 | PDF 197–200 (270.x) |
| [ ] | **Municipal Court** | p.108–111 (PDF 118–121); table on printed p.108 | $4,180,654 | PDF 201–205 (280.x) |
| [ ] | **Neighborhood Services** | p.112–115 (PDF 122–125); table on printed p.112 | $25,844,087 | PDF 206–215 (290.x) |
| [ ] | **Police Department** | p.116–120 (PDF 126–130); table on printed p.116 | $343,937,125 | PDF 216–238 (300.x) |
| [ ] | **Port Milwaukee** | p.121–123 (PDF 131–133); table on printed p.121 | $7,266,355 | PDF 239–243 (310.x) |
| [ ] | **Department of Public Works - Administrative Services Division** | p.124–126 (PDF 134–136); table on printed p.124 | $4,152,356 | PDF 246–251 (330.x) |
| [ ] | **Department of Public Works - Infrastructure Services Division** | p.127–136 (PDF 137–146); table on printed p.127 | $54,403,862 | PDF 252–280 (340.x) |
| [ ] | **Department of Public Works - Operations Division** | p.137–143 (PDF 147–153); table on printed p.137 | $113,724,664 | PDF 281–302 (350.x) |

**DPW note:** Public Works appears three times in the Summary PDF (Administrative Services, Infrastructure, Operations), each titled "DEPARTMENT OF PUBLIC WORKS" with the division name on the second line. Make sure each report section shows its own division's numbers — they must be three different totals.

**Other budget sections** (quicker — check the Total row only):

| ✓ | Section | Summary PDF — printed pages (PDF pages) | Detailed PDF pages |
|---|---|---|---|
| [ ] | A. Special Purpose Accounts | p.144–154 (PDF 154–164) | PDF 303–312 |
| [ ] | A. Source of Funds for General City Purposes | p.156–162 (PDF 166–172) | PDF 316–321 |
| [ ] | A. Fringe Benefit Offset | p.155–155 (PDF 165–165) | PDF 314–314 |
| [ ] | B. Provision for Employes' Retirement Fund | p.163–173 (PDF 173–183) | PDF 322–333 |
| [ ] | C. Capital Improvements | p.174–183 (PDF 184–193) | PDF 334–376 |
| [ ] | D. City Debt | p.184–186 (PDF 194–196) | PDF 377–378 |
| [ ] | F. Common Council Contingent Fund | p.187–189 (PDF 197–199) | PDF 379–379 |
| [ ] | G. Transportation Fund | p.190–192 (PDF 200–202) | PDF 380–395 |
| [ ] | H. Grant and Aid Fund | p.193–194 (PDF 203–204) | PDF 396–397 |
| [ ] | I. Economic Development Fund | p.195–196 (PDF 205–206) | PDF 398–398 |
| [ ] | J. Water Works | p.197–202 (PDF 207–212) | PDF 399–435 |
| [ ] | K. Sewer Maintenance Fund | p.203–207 (PDF 213–217) | PDF 436–450 |
| [ ] | M. County Delinquent Tax Fund | p.208–208 (PDF 218–218) | PDF 451–451 |
| [ ] | N. Settlement Funds | p.209–210 (PDF 219–220) | PDF 452–452 |

**City-wide tables** (in the report under "Section-level tables"):

| ✓ | Table | Summary PDF | What to check |
|---|---|---|---|
| [ ] | Budget and tax rate by section | printed p.7 (PDF 17) | "TOTAL" row: $2,261,087,412 proposed; tax rate $7.29 (was $7.61) |
| [ ] | Comparisons by section | printed p.8–10 (PDF 18–20) | General City Purposes "Total Appropriations": $846,796,205 proposed |
| [ ] | Positions by department | printed p.13 (PDF 23) | "Total Budgeted Positions": 7,844 (was 7,818) |
| [ ] | Source of funds (revenues) | printed p.160–162 (PDF 170–172) | "Total Sources of Funds…": $846,796,205 |

---

## Part B — Errors the program found in the city's own documents (≈20 minutes)

The tests found 18 places where the city's printed total doesn't equal the rows printed above it. The program **did not change** any number; it recorded each one. Your job: go to the page and confirm the program read the page correctly — i.e., the rows really do add up to something different from the printed total. Use a calculator (Spotlight: ⌘Space, type the sum).

| ✓ | Where | PDF | Go to PDF page | What the page prints vs what its rows add to | What the program says |
|---|---|---|---|---|---|
| [ ] | 510 (adopted_2026) | Detailed PDF | **382, 387, 390** (printed 510.3, 510.8, 510.11) | printed **39,131,093**, rows add to **38,319,651** | BCU total printed on 510.3 line 2; Parking total on 510.8 line 19; Streetcar total on 510.11 line 14. The Parking decision unit lists DEPOSIT TO RETAINED EARNINGS $811,442 (510.8 line 12) but its printed 2026 total equals the O&M subtotal alone (31,376,067). The BCU total includes the $811,442. In 2025 and 2027-requested the same unit total does include its transfer/deposit lines, so the document is internally inconsistent. |
| [ ] | 510 (proposed_2027) | Detailed PDF | **382, 387, 390** (printed 510.3, 510.8, 510.11) | printed **50,410,300**, rows add to **44,410,300** | BCU total printed on 510.3 line 2; Parking total on 510.8 line 19; Streetcar total on 510.11 line 14. The Parking decision unit lists TRANSFER TO CAPITAL FUND $6,000,000 (510.8 line 16) but its printed proposed total (36,699,370 = O&M 33,908,268 + deposit 2,791,102) leaves it out. The BCU total includes it. |
| [ ] | city-development (grant) | Summary PDF | **58** (printed p.48) | printed **1,037,055**, rows add to **1,037,056** | Summary p.48: service rows sum $1 above the printed Total (rounding). |
| [ ] | common-council-city-clerk (operating) | Summary PDF | **71** (printed p.61) | printed **13,954,238**, rows add to **13,954,239** | Summary p.61: rows sum $1 above the printed Total (rounding). |
| [ ] | compliance-engagement (grant) | Summary PDF | **77** (printed p.67) | printed **215,000**, rows add to **315,000** | Summary p.67-68: ADA Compliance/Equal Rights Compliance prints $100,000 in the Grant Budget column (x 455-492, verified on the page) and Contract Compliance $215,000, but the printed Total grant is $215,000. The Total leaves out the $100,000. |
| [ ] | comptroller (operating) | Summary PDF | **81** (printed p.71) | printed **6,899,694**, rows add to **6,896,694** | Summary p.71: the four service rows (1,083,086 + 4,442,761 + 329,261 + 1,041,586, each verified on the page) sum to 6,896,694; the printed Total is 6,899,694 ($3,000 more). |
| [ ] | dpw-infrastructure (operating) | Summary PDF | **137** (printed p.127) | printed **54,403,862**, rows add to **54,403,863** | Summary p.127: rows sum $1 above the printed Total (rounding). |
| [ ] | election-commission (operating) | Summary PDF | **85** (printed p.75) | printed **3,496,354**, rows add to **3,496,355** | Summary p.75: rows sum $1 above the printed Total (rounding). |
| [ ] | library (operating) | Summary PDF | **111** (printed p.101) | printed **35,142,226**, rows add to **35,142,227** | Summary p.101: rows sum $1 above the printed Total (rounding). |
| [ ] | mayor (operating) | Summary PDF | **116** (printed p.106) | printed **2,256,261**, rows add to **2,256,260** | Summary p.106: rows sum $1 below the printed Total (rounding). |
| [ ] | police (non_om_ftes) | Summary PDF | **130** (printed p.120) | printed **21.0**, rows add to **20.96** | Summary p.120: the Totals row prints FTEs to one decimal (21.0); the rows sum to 20.96. |
| [ ] | 130:130.1 (actual_2025) | Detailed PDF | **45, 46** (printed 130.3, 130.4) | printed **405,622**, rows add to **398,855** | Detailed 130.3-130.4: all eight 2025 operating lines read and verified on the page sum to 398,855; the printed OPERATING EXPENDITURES TOTAL* is 405,622. The 2026/2027 columns on the same lines add up exactly. |
| [ ] | 130:130.1 (actual_2025) | Detailed PDF | **46** (printed 130.4) | printed **49,788**, rows add to **24,788** | Detailed 130.4: 2025 subtotals 8,394 (Additional) + 16,394 (Replacement) = 24,788; the printed EQUIPMENT PURCHASES TOTAL* is 49,788. Other columns reconcile. |
| [ ] | 240:240.8 (actual_2025) | Detailed PDF | **127** (printed 240.11) | printed **4,459,530**, rows add to **4,459,531** | Detailed 240.11 line 19: Fire Support Services Bureau 2025 operating lines sum $1 above the printed OPERATING EXPENDITURES TOTAL (rounding). |
| [ ] | 310:310.1 (actual_2025) | Detailed PDF | **242, 243** (printed 310.4, 310.5) | printed **3,454,645**, rows add to **4,116,762** | Detailed 310.4-310.5: the seven 2025 special-fund lines sum to 4,116,762; the printed SPECIAL FUNDS TOTAL is 3,454,645. The difference, 662,117, equals 'Debt Service Payment - RACM Loan' (662,116) + 'Lease Payment Transfer' (1), printed directly above the total. |
| [ ] | 220:220.11 (requested_2027) | Detailed PDF | **111** (printed 220.15) | printed **500**, rows add to **250** | Detailed 220.15: 'Replacement Equipment' prints 250 but its 'Subtotal - Replacement Equipment' line (line 9) is printed blank; the EQUIPMENT PURCHASES TOTAL (500) counts the 250. Verified on the raw page. |
| [ ] | 220:220.11 (proposed_2027) | Detailed PDF | **111** (printed 220.15) | printed **500**, rows add to **250** | Detailed 220.15, same line as above, proposed column. |
| [ ] | city-development (positions) | Summary PDF | **65, 23** (printed p.55, 13) | printed **-10**, rows add to **-3** | Summary p.55 lists 'Specific ADDITIONAL positions (or eliminations)' totalling -3 (all rows verified on the page); p.13 shows City Development 103 -> 93 (-10). The listing is not an itemization of every change; both agree internally and with the Detailed book's position count (93). |

---

## Part C — Two judgment calls only you can make (≈10 minutes)

A small AI model (TypeSafe Jev) compared each written fact and glossary definition with its page. It wasn't sure about these 2, which is correct — they need a human decision.

### [ ] fact:fringe-offset-year-wording
- **Go to:** Summary PDF, PDF page **169** (printed p.159)
- **What we wrote:** The Source of Funds narrative says the fringe benefit offset is 'anticipated to be $28.0 million in 2026' [sic], 'a $3.0 million increase from 2026'.
- **What the page says:** The fringe benefit costs associated with reimbursables, grants, enterprise funds, and capital activities are budgeted in the general fund. These other funds make a payroll payment to the general fund to offset the cost of their general fund budgeted fringe benefits, which is anticipated to be $28.0 million in 2026, a $3.0 million increase from 2026. Tax Stabilization Fund (TSF):
- **Decide:** The page says "$28.0 million **in 2026**, a $3.0 million increase **from 2026**" — the first "2026" looks like a typo for 2027 (the table on printed p.162, PDF 172, puts $28,000,000 in the 2027 Proposed column). Currently we show the table figure first and quote the sentence with [sic]. **Is that how you want readers to see it?** Write `NOTE: ok` or `NOTE:` your preferred wording.

### [ ] glossary:Actual expenditures
- **Go to:** Summary PDF, PDF page **126** (printed p.116)
- **What we wrote:** What a department really spent in a past year, as opposed to what was budgeted.
- **What the page says:** To be a department where every member works with our community to help build sustainable healthy neighborhoods, free of crime, and maintained by positive relationships. BUDGET SUMMARY Change 2025 2026 2027 2027 2027 Proposed Actual Adopted Requested Proposed Versus Expenditures Budget Budget Budget 2026 Adopted 2027 Requested Personnel FTEs - Operations & Maintenance 2,443.76 2,324.95 2,352.95 2,349.45 24.50 -3.50 FTEs - Other 117.87 81.50 103.50 102.50 21.00 -1.00 Total Positions Authorized 2,6
- **Decide:** The Summary never defines this term — it's only a column header. The definition is ours. **Is our plain-language definition accurate and neutral?** Write `NOTE: ok` or your correction.

---

## Part D — Hand-written data (≈20 minutes)

These were typed by Claude from the pages, then tested (every figure is proven to be on its cited page). You're checking the **wording** is fair and plain.

### D1. Fees — Summary PDF, printed p.159 (PDF 169) and p.203 (PDF 213)

- [ ] **solid_waste**: 271.80 → 280.00 (per_year_per_unit) — PDF 169 (printed p.159)
- [ ] **extra_cart**: 81.24 → 83.68 (per_year_per_unit) — PDF 169 (printed p.159)
- [ ] **snow_ice**: 1.19 → 1.23 (per_frontage_ft) — PDF 169 (printed p.159)
- [ ] **street_lighting**: 1.12 → 1.16 (per_frontage_ft) — PDF 169 (printed p.159)
- [ ] **sewer_stormwater_avg**: 241.88 → 247.02 (avg_household_per_year) — PDF 213 (printed p.203) — *2026 value is calculated (247.02 − 5.14), not printed*

### D2. Budget facts — read the statement, then the page

- [ ] **act12-sales-tax** — Summary PDF PDF **14** (printed p.4): In the summer of 2023, the State of Wisconsin passed Act 12, which generated significant new revenue for the City of Milwaukee. The 2% local sales tax it authorized generated over $200 million in 2024.
- [ ] **sales-tax-2027** — Summary PDF PDF **166** (printed p.156): 2027 marks the fourth year of the city's two percent sales tax, which will result in an estimated revenue of $218.2 million. Approximately $58.8 million of the sales tax will be used in the general fund to maintain and increase police and fire department service levels. The remainder of the sales tax revenue will be a source of revenue for the city's pension obligations.
- [ ] **ssr-2027** — Summary PDF PDF **167** (printed p.157): In 2027, the city expects to receive $260.0 million of State Shared Revenue.
- [ ] **erip-2027** — Summary PDF PDF **15** (printed p.5): The State's Expenditure Restraint Incentive Program (ERIP) required at least $29.6 million in reductions from requested level in order to qualify for $11.6 million in conditional state aid.
- [ ] **cut-from-requests** — Summary PDF PDF **15** (printed p.5): The budget introduction says the 2027 proposed budget cut about $33.5 million from the requested budget.
- [ ] **tsf-withdrawal-2027** — Summary PDF PDF **169** (printed p.159): The unrestricted balance of the Tax Stabilization Fund as of December 31, 2025 was $79.6 million. The 2027 budget includes a withdrawal of $39.8 million from the Tax Stabilization Fund, an increase of $7.5 million from 2026.
- [ ] **street-lighting-revenue** — Summary PDF PDF **169** (printed p.159): The street lighting fee is estimated to generate $11.2 million in 2027, with $500,000 of that revenue being used for capital expenditures to improve the city's streetlights.
- [ ] **fringe-offset-year-wording** — Summary PDF PDF **169** (printed p.159): The Source of Funds narrative says the fringe benefit offset is 'anticipated to be $28.0 million in 2026' [sic], 'a $3.0 million increase from 2026'.
- [ ] **police-recruit-classes** — Summary PDF PDF **127** (printed p.117): The 2027 budget funds the maximum number of annual classes (3) each at the maximum level of recruits per class (65), which allows the City to meet the State's Act 12 requirements for sworn staffing levels and sales tax expenditures.
- [ ] **sro-mandate** — Summary PDF PDF **128** (printed p.118): The Police Department maintains a School Resource Division within Milwaukee Public Schools, whose leadership supports the 25 officers mandated by Act 12.
- [ ] **legal-deadlines** — Summary PDF PDF **4** (printed p.front matter): Budget calendar legal deadlines: the proposed budget is submitted by September 28 and the Common Council acts on the budget by November 14.
- [ ] **public-survey** — Summary PDF PDF **16** (printed p.6): Thousands of Milwaukee residents took a two-minute, six-question survey about which revenue categories to increase or not, and which services to protect or not. The document says the public asked for better roads and more demolitions of nuisance properties, and to hold the line on taxes and fees.

### D3. Glossary — 43 terms (skim; 10 minutes)

File: `pipeline/data/glossary.yaml`. Read each `plain_definition`. Ask: would a resident understand it? Is it neutral (no opinion about whether spending is good or bad)? Does it contain any dollar amount? (It shouldn't — amounts come from the data.) Jev already checked each against its page; this is a plain-language read.

- [ ] Glossary read; notes written below if any.

### D4. Department names and search words — `pipeline/data/departments.yaml` (5 minutes)

Each department has `aliases` — words a resident might type ("MPD" → Police, "sanitation" → DPW Operations, "911" → Emergency Communications). Check none are wrong or misleading, and add any obvious ones missing.

- [ ] Aliases read; notes written below if any.

### D5. Account definitions — `pipeline/data/account_glosses.yaml` (5 minutes)

18 plain-language explanations of operating account names ("Professional Services — consultants, contractors, outside experts…").

- [ ] Account glosses read; notes written below if any.

---

## When you're done

Tell Claude: **"apply my review"**. Claude will:
1. Set `reviewed_by: Tarik` on every ticked item in the YAML files.
2. Fix anything you wrote a `NOTE:` about, and re-run all tests.
3. Fill in nothing in the "What actually happened" sections of `docs/decisions.md` — those are yours to write.

**Your notes:**

