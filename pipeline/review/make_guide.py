"""Generate docs/REVIEW-GUIDE.md (the human review checklist) from the pipeline data.
Run from pipeline/: uv run python -m review.make_guide"""
import json, re, yaml
import pandas as pd
from decimal import Decimal
from common.departments import departments, summary_page_ranges

li = pd.read_parquet('../data/processed/line_items.parquet')
ds = pd.read_parquet('../data/processed/dept_summary.parquet')
p13 = pd.read_parquet('../data/processed/positions_summary.parquet')
pid = li.drop_duplicates('printed_page').set_index('printed_page').pdf_page.to_dict()   # Detailed printed id -> pdf page
inc = yaml.safe_load(open('data/source_inconsistencies.yaml'))
facts = yaml.safe_load(open('data/budget_facts.yaml'))
fees = yaml.safe_load(open('data/fees.yaml'))
gloss = yaml.safe_load(open('data/glossary.yaml'))
claims = json.load(open('data/claim_checks.json'))
R = summary_page_ranges()
det = li.groupby('section').agg(first=('pdf_page','min'), last=('pdf_page','max')).to_dict('index')
S, D = "Summary PDF", "Detailed PDF"
money = lambda v: f"${int(Decimal(str(v))):,}" if v not in (None, "") and str(v) != "nan" else "blank"

def fmt(v):
    try:
        return f"{int(v):,}"
    except (TypeError, ValueError):
        return str(v)


def dpages(d):
    xs = [det[p] for p in d.get('detailed') or [] if p in det]
    return (min(x['first'] for x in xs), max(x['last'] for x in xs)) if xs else None

out = []
w = out.append
w("# Review guide — 2027 Proposed Budget extraction\n")
w("_Generated from the pipeline's own data on 2026-09-23. Every page number below comes from the extracted files, not from memory._\n")
w("""## What you're doing, in one paragraph

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
""")
w("| ✓ | Department | Summary PDF — printed pages (PDF pages) | 2027 Proposed total to look for | Detailed PDF pages (optional) |")
w("|---|---|---|---|---|")
sec_a = [d for d in departments() if d['section'] == 'A' and d.get('summary_page') and d['slug'] not in ('special-purpose-accounts','fringe-benefit-offset','gcp-source-of-funds')]
for d in sec_a:
    r = R[d['slug']]; dp = dpages(d)
    t = ds[(ds.dept == d['slug']) & (ds.metric == 'total_expenditures')]
    w(f"| [ ] | **{d['name']}** | p.{r[0]}–{r[1]} (PDF {r[0]+10}–{r[1]+10}); table on printed p.{r[0]} | {money(t.proposed_2027.iloc[0]) if len(t) else '—'} | PDF {dp[0]}–{dp[1]} ({', '.join(d['detailed'])}.x) |")
w("""
**DPW note:** Public Works appears three times in the Summary PDF (Administrative Services, Infrastructure, Operations), each titled "DEPARTMENT OF PUBLIC WORKS" with the division name on the second line. Make sure each report section shows its own division's numbers — they must be three different totals.

**Other budget sections** (quicker — check the Total row only):
""")
w("| ✓ | Section | Summary PDF — printed pages (PDF pages) | Detailed PDF pages |")
w("|---|---|---|---|")
for d in departments():
    if d['section'] != 'A' or d['slug'] in ('special-purpose-accounts','fringe-benefit-offset','gcp-source-of-funds'):
        r = R.get(d['slug']); dp = dpages(d)
        if not r: continue
        w(f"| [ ] | {d['section']}. {d['name']} | p.{r[0]}–{r[1]} (PDF {r[0]+10}–{r[1]+10}) | {f'PDF {dp[0]}–{dp[1]}' if dp else '—'} |")

w("""
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
""")
w("| ✓ | Where | PDF | Go to PDF page | What the page prints vs what its rows add to | What the program says |")
w("|---|---|---|---|---|---|")
for i in inc:
    doc = S if i['doc'] == 'summary' else D
    if i['doc'] == 'summary':
        m = re.findall(r"p\.(\d+)", i['note']); pages = [int(x) for x in m] or []
        where = f"printed p.{', '.join(map(str, pages))}" if pages else "see note"
        go = ", ".join(str(p + 10) for p in pages)
        who = i['section']
    else:
        ids = list(dict.fromkeys(re.findall(r"\b(\d{3}\.\d+)\b", i['note'])))
        where = f"printed {', '.join(ids)}"
        go = ", ".join(str(pid[x]) for x in ids if x in pid)
        who = i['section']
    w(f"| [ ] | {who} ({i['column']}) | {doc} | **{go}** ({where}) | printed **{fmt(i['printed'])}**, rows add to **{fmt(i['extracted'])}** | {i['note']} |")

queue = [(k, v) for k, v in claims.items() if not v.get('auto')]
w(f"""
---

## Part C — Two judgment calls only you can make (≈10 minutes)

A small AI model (TypeSafe Jev) compared each written fact and glossary definition with its page. It wasn't sure about these {len(queue)}, which is correct — they need a human decision.
""")
for k, v in queue:
    c = v['cite']; doc = S if c['doc'] == 'summary' else D
    w(f"### [ ] {k}\n- **Go to:** {doc}, PDF page **{c['pdf_page']}** (printed p.{c['printed_page']})\n- **What we wrote:** {v['statement']}\n- **What the page says:** {v['passage'][:500]}")
    if k == 'fact:fringe-offset-year-wording':
        w("- **Decide:** The page says \"$28.0 million **in 2026**, a $3.0 million increase **from 2026**\" — the first \"2026\" looks like a typo for 2027 (the table on printed p.162, PDF 172, puts $28,000,000 in the 2027 Proposed column). Currently we show the table figure first and quote the sentence with [sic]. **Is that how you want readers to see it?** Write `NOTE: ok` or `NOTE:` your preferred wording.\n")
    else:
        w("- **Decide:** The Summary never defines this term — it's only a column header. The definition is ours. **Is our plain-language definition accurate and neutral?** Write `NOTE: ok` or your correction.\n")

w("""---

## Part D — Hand-written data (≈20 minutes)

These were typed by Claude from the pages, then tested (every figure is proven to be on its cited page). You're checking the **wording** is fair and plain.

### D1. Fees — Summary PDF, printed p.159 (PDF 169) and p.203 (PDF 213)
""")
for f in fees:
    c = f['cite']
    w(f"- [ ] **{f['fee']}**: {f['value_2026']} → {f['value_2027']} ({f['unit']}) — PDF {c['pdf_page']} (printed p.{c['printed_page']})" + (" — *2026 value is calculated (247.02 − 5.14), not printed*" if f['is_derived'] else ""))
w("\n### D2. Budget facts — read the statement, then the page\n")
for f in facts:
    c = f['cite']; doc = S if c['doc'] == 'summary' else D
    w(f"- [ ] **{f['id']}** — {doc} PDF **{c['pdf_page']}** (printed p.{c['printed_page']}): {f['statement']}")
w("""
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

""")
open('../docs/REVIEW-GUIDE.md', 'w').write("\n".join(out))
print(len(out), "lines")
