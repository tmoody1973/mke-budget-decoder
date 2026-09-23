"""P1.9 human-review report: every extracted table beside an image of its source page, plus the
reconciliation status and every logged document inconsistency. Output: data/review/index.html
(gitignored; regenerate with `uv run python -m review.build_report`).

Images are whole pages at 90 dpi rendered with pdfplumber (no new dependency): a reviewer sees the
table's heading and neighbours, which is how "right numbers, wrong table" gets caught.
"""
from __future__ import annotations

import html
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd
import pdfplumber
import yaml

from common.config import DETAILED_PDF, PIPELINE_DATA, PROCESSED, ROOT, SUMMARY_PDF
from common.departments import departments, summary_page_ranges

OUT = ROOT / "data" / "review"
IMG = OUT / "img"
STAGES = ["actual_2025", "adopted_2026", "requested_2027", "proposed_2027"]
esc = html.escape


# --------------------------------------------------------------------------------------------
def run_tests() -> dict:
    xml = OUT / "pytest.xml"
    subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:warnings", f"--junitxml={xml}"],
                   cwd=ROOT / "pipeline", capture_output=True, text=True)
    root = ET.parse(xml).getroot()
    by_file: dict[str, Counter] = defaultdict(Counter)
    failures = []
    for case in root.iter("testcase"):
        f = case.get("classname", "").split(".")[-1]
        bad = case.find("failure") is not None or case.find("error") is not None
        by_file[f]["failed" if bad else "passed"] += 1
        if bad:
            failures.append(f"{f}::{case.get('name')}")
    return {"by_file": by_file, "failures": failures}


def render(doc: str, pdf_page: int, pdfs: dict) -> str:
    name = f"{doc}-{pdf_page:03d}.png"
    path = IMG / name
    if not path.exists():
        pdfs[doc].pages[pdf_page - 1].to_image(resolution=90).save(path)
    return f"img/{name}"


def table(df: pd.DataFrame, cols: list[str]) -> str:
    head = "".join(f"<th>{esc(c)}</th>" for c in cols)
    body = []
    for _, r in df.iterrows():
        cells = []
        for c in cols:
            v = r.get(c)
            s = "" if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NA else v
            if isinstance(s, (int, float)) and not isinstance(s, bool):
                s = f"{s:,.0f}" if float(s).is_integer() else f"{s:,.2f}"
            cls = ' class="num"' if c not in ("label", "description", "measure", "title", "reason", "line",
                                                "name", "metric", "group", "category", "col_labels", "values") else ""
            cells.append(f"<td{cls}>{esc(str(s))}</td>")
        body.append("<tr>" + "".join(cells) + "</tr>")
    return f"<table><thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>"


def pages_of(df: pd.DataFrame) -> list[int]:
    return sorted({int(c["pdf_page"]) for c in df["cite"]})


def block(title: str, df: pd.DataFrame, cols: list[str], doc: str, pdfs: dict, note: str = "") -> str:
    if df.empty:
        return ""
    imgs = "".join(f'<figure><img loading="lazy" src="{render(doc, p, pdfs)}" alt="{doc} PDF page {p}">'
                   f"<figcaption>{doc} PDF p.{p}</figcaption></figure>" for p in pages_of(df))
    n = f'<p class="note">{esc(note)}</p>' if note else ""
    return (f'<section class="pair"><h3>{esc(title)} <span class="count">{len(df)} rows</span></h3>{n}'
            f'<div class="side"><div class="data">{table(df, cols)}</div><div class="pages">{imgs}</div></div></section>')


# --------------------------------------------------------------------------------------------
def build() -> Path:
    IMG.mkdir(parents=True, exist_ok=True)
    tests = run_tests()
    load = lambda n: pd.read_parquet(PROCESSED / f"{n}.parquet")
    ds, sv, kp, pc, cap = (load(n) for n in ("dept_summary", "services", "kpis", "position_changes", "capital_projects"))
    inconsistencies = yaml.safe_load((PIPELINE_DATA / "source_inconsistencies.yaml").read_text())
    li = load("line_items")
    pdfs = {"summary": pdfplumber.open(SUMMARY_PDF), "detailed": pdfplumber.open(DETAILED_PDF)}

    # reconciliation panel
    rows = "".join(f"<tr><td>{esc(f)}</td><td class='num'>{c['passed']}</td><td class='num {'bad' if c['failed'] else ''}'>{c['failed']}</td></tr>"
                   for f, c in sorted(tests["by_file"].items()))
    total_p = sum(c["passed"] for c in tests["by_file"].values())
    total_f = sum(c["failed"] for c in tests["by_file"].values())
    panel = (f'<section id="recon"><h2>Reconciliation status</h2><p class="big {"bad" if total_f else "ok"}">'
             f'{total_p} passed · {total_f} failed</p><table><thead><tr><th>test file</th><th>passed</th><th>failed</th></tr>'
             f'</thead><tbody>{rows}</tbody></table>'
             + (f"<p class='bad'>Failures: {esc(', '.join(tests['failures']))}</p>" if tests["failures"] else "") + "</section>")

    inc_rows = "".join(f"<tr><td>{esc(str(i['id']))}</td><td>{esc(i['doc'])}</td><td>{esc(str(i['section']))}</td>"
                       f"<td>{esc(str(i['column']))}</td><td class='num'>{esc(str(i['printed']))}</td>"
                       f"<td class='num'>{esc(str(i['extracted']))}</td><td>{esc(i['note'])}</td></tr>" for i in inconsistencies)
    inc = (f'<section id="inconsistencies"><h2>Document inconsistencies found ({len(inconsistencies)})</h2>'
           f"<p>Each is excused in the tests only at these exact values. Please confirm each against the page.</p>"
           f"<table><thead><tr><th>id</th><th>doc</th><th>where</th><th>column</th><th>printed</th><th>rows add to</th>"
           f"<th>what the page shows</th></tr></thead><tbody>{inc_rows}</tbody></table></section>")

    # Jev judgments on curated statements (review/claim_check.py) — low confidence goes to a person
    claims = json.loads((PIPELINE_DATA / "claim_checks.json").read_text())
    queue = {k: v for k, v in claims.items() if not v.get("auto")}
    q_rows = "".join(
        f"<tr><td>{esc(k)}</td><td>{esc(v.get('verdict', ''))}</td>"
        f"<td class='num'>{esc(str(v.get('confidence', v.get('conflict_probability', ''))))}</td>"
        f"<td>{esc(v.get('statement', ''))}</td><td>{esc(v.get('passage', '')[:600])}</td></tr>" for k, v in queue.items())
    verdicts = Counter(v.get("verdict") for v in claims.values())
    jev = (f'<section id="claims"><h2>Wording checks by Jev ({len(claims)} statements)</h2>'
           f"<p>{esc(', '.join(f'{k}: {n}' for k, n in verdicts.items()))}. Code already verified every number; "
           f"Jev (jev-1.13.0) judged whether each statement's wording matches its page. These {len(queue)} were "
           f"below the confidence bar — please read each against the passage.</p>"
           f"<table><thead><tr><th>item</th><th>verdict</th><th>confidence / p(conflict)</th><th>our statement</th>"
           f"<th>page passage</th></tr></thead><tbody>{q_rows}</tbody></table></section>")

    # per department
    depts = []
    ranges = summary_page_ranges()
    nav = []
    for d in departments():
        slug = d["slug"]
        parts = [
            block("Budget summary", ds[ds.dept == slug], ["group", "label"] + STAGES + ["flags"], "summary", pdfs),
            block("Services", sv[sv.dept == slug], ["description", "operating", "capital", "grant", "ftes"], "summary", pdfs,
                  "'-' in the document is stored as blank (NULL), not 0."),
            block("Key performance measures", kp[kp.dept == slug], ["measure", "col_labels", "values"], "summary", pdfs,
                  "Year labels are kept exactly as printed."),
            block("Position changes", pc[pc.dept == slug], ["positions", "om_ftes", "non_om_ftes", "title", "reason", "reason_category"],
                  "summary", pdfs, "reason_category is a rule-based grouping; the printed reason is authoritative."),
            block("Capital projects", cap[cap.dept == slug], ["name", "amount", "amount_text", "description"], "summary", pdfs,
                  "Amounts printed in millions are converted; the printed text is shown beside."),
        ]
        units = li[li.section.isin(d.get("detailed") or []) & li.is_unit_total]
        if len(units):
            parts.append(block("Detailed book: unit totals", units, ["block", "description"] + STAGES, "detailed", pdfs,
                               "One line per team (decision unit) or summary sheet. 'bcu_summary' rows restate their teams."))
        parts = [p for p in parts if p]
        if not parts:
            continue
        rng = ranges.get(slug)
        where = f"Summary p.{rng[0]}–{rng[1]}" if rng else ""
        nav.append(f'<a href="#{slug}">{esc(d["short_name"])}</a>')
        depts.append(f'<section class="dept" id="{slug}"><h2>{esc(d["name"])}</h2><p class="meta">{esc(where)} · '
                     f'Detailed {esc(", ".join(d.get("detailed") or []))} · reviewed_by: ______</p>{"".join(parts)}</section>')

    # section-level tables
    sec = [block("Summary p.7 — section totals and tax rates", load("section_totals"),
                 ["section", "label", "line", "adopted_2026", "proposed_2027", "change", "tax_rate_2026", "tax_rate_2027", "tax_rate_change"], "summary", pdfs,
                 "Rounding quirks are kept as printed (e.g. Contingent Fund rate change −0.01; subtotal −0.33 vs total −0.32)."),
           block("Summary p.8–10 — comparisons by section", load("section_comparisons"),
                 ["section", "line", "adopted_2026", "requested_2027", "proposed_2027", "change_vs_adopted", "change_vs_requested"], "summary", pdfs),
           block("Summary p.13 — positions by department", load("positions_summary"),
                 ["label", "adopted_2026", "requested_2027", "proposed_2027", "change_vs_adopted", "change_vs_requested"], "summary", pdfs,
                 "DPW's parenthesised total is a division subtotal, stored positive and flagged."),
           block("Summary p.160–162 — source of funds", (r := load("revenues"))[r.source == "summary"].head(200),
                 ["category", "line"] + STAGES, "summary", pdfs)]

    css = """
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a66;--line:#e2dfd8;--ok:#1f7a4d;--bad:#b3261e;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#ecebe6;--mut:#a09e97;--line:#34332f;--card:#1c1c1a}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
header,main{max-width:1500px;margin:0 auto;padding:16px}
nav{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:13px}nav a{color:var(--fg)}
h2{margin:32px 0 4px;border-bottom:2px solid var(--fg);padding-bottom:4px}
h3{margin:18px 0 6px}.count,.meta,.note{color:var(--mut);font-weight:400;font-size:13px}
.side{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,560px);gap:16px;align-items:start}
@media (max-width:900px){.side{grid-template-columns:1fr}}
.data{overflow-x:auto}table{border-collapse:collapse;width:100%;background:var(--card);font-size:12.5px}
th,td{border:1px solid var(--line);padding:3px 6px;vertical-align:top;text-align:left}td.num{text-align:right;font-variant-numeric:tabular-nums}
figure{margin:0 0 10px}img{width:100%;border:1px solid var(--line);background:#fff}figcaption{color:var(--mut);font-size:12px}
.big{font-size:20px;font-weight:600}.ok{color:var(--ok)}.bad{color:var(--bad)}"""
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MKE Budget Review</title><style>{css}</style></head><body><header>
<h1>2027 Proposed Budget — extraction review</h1>
<p>Every table extracted from the two PDFs, beside its source page. Check each department's numbers against the page image; initial the reviewed_by line.
Proposed budget (Mayor's proposal), not adopted. Generated by pipeline/review/build_report.py.</p>
<nav><a href="#recon">Reconciliation</a><a href="#claims">Wording checks</a><a href="#inconsistencies">Inconsistencies</a><a href="#sections">Section tables</a>{''.join(nav)}</nav></header>
<main>{panel}{jev}{inc}<section id="sections"><h2>Section-level tables</h2>{''.join(sec)}</section>{''.join(depts)}</main></body></html>"""
    out = OUT / "index.html"
    out.write_text(page)
    (OUT / "summary.json").write_text(json.dumps({"departments": len(depts), "images": len(list(IMG.glob("*.png"))),
                                                  "tests_passed": total_p, "tests_failed": total_f}, indent=2))
    return out


if __name__ == "__main__":
    print(build())
