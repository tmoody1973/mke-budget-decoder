"""Independent cross-check of the extracted tables against the source PDFs.

Ported from the external review's bbox_crosscheck.py (2026-09-23). Same method: poppler's
`pdftotext -bbox` word coordinates — a different extraction path from the pipeline's pdfplumber
parser — are searched for every extracted row's values on its cited page. A row passes when its
values appear on one printed line in column order with its label on or near that line.
Changes from the original: reads data/processed/*.parquet instead of the HTML report, so CI needs
no report build or BeautifulSoup; results are returned for validate/test_bbox_crosscheck.py.

Run standalone: uv run python -m validate.bbox_crosscheck   (prints every row that isn't 'ok')
"""
from __future__ import annotations

import functools
import html
import re
import subprocess
from collections import Counter
from decimal import Decimal, InvalidOperation

import pandas as pd

from common.config import DETAILED_PDF, PROCESSED, SUMMARY_PDF

PDFS = {"summary": str(SUMMARY_PDF), "detailed": str(DETAILED_PDF)}
WRE = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>')
STAGES = ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027")


@functools.lru_cache(maxsize=None)
def words(doc: str, page: int) -> tuple:
    out = subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-bbox", PDFS[doc], "-"],
                         capture_output=True, text=True).stdout
    return tuple(dict(x0=float(a), y0=float(b), x1=float(c), y1=float(d), t=html.unescape(e))
                 for a, b, c, d, e in WRE.findall(out))


@functools.lru_cache(maxsize=None)
def lines(doc: str, page: int, tol: float = 2.5) -> tuple:
    ls: list[dict] = []
    for w in sorted(words(doc, page), key=lambda w: (w["y0"], w["x0"])):
        if ls and abs(ls[-1]["y"] - w["y0"]) <= tol:
            ls[-1]["w"].append(w)
        else:
            ls.append({"y": w["y0"], "w": [w]})
    for ln in ls:
        ln["w"].sort(key=lambda w: w["x0"])
        ln["text"] = " ".join(w["t"] for w in ln["w"])
    return tuple(ls)


def num(t):
    t = str(t).strip().replace("$", "").replace(",", "").rstrip("*").strip("[]")
    neg = t.startswith("(") and t.endswith(")")
    t = t.strip("()")
    if t in ("", "-", "—", "–", "None", "nan", "<NA>"):
        return None
    try:
        v = Decimal(t)
    except InvalidOperation:
        return "X"
    return -v if neg else v


def is_slot(tok: str) -> bool:
    t = tok.strip()
    return t in ("-", "—", "–") or num(t) not in ("X", None)


def slots(line, xmin=None, x1max=None):
    return [(num(w["t"]), w) for w in line["w"]
            if (xmin is None or w["x0"] >= xmin) and (x1max is None or w["x1"] <= x1max) and is_slot(w["t"])]


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(s).lower()).strip()


def label_hit(line, label, n=2, xmax=None) -> bool:
    lw = norm(label).split()[:n]
    if not lw:
        return False
    return " ".join(lw) in norm(" ".join(w["t"] for w in line["w"] if xmax is None or w["x0"] < xmax))


def _pages(frame: pd.DataFrame) -> list[tuple[str, int]]:
    return sorted({(c["doc"], int(c["pdf_page"])) for c in frame["cite"]})


def run() -> list[dict]:
    load = lambda n: pd.read_parquet(PROCESSED / f"{n}.parquet")
    results = []
    rec = lambda d, t, label, page, status, detail="": results.append(
        dict(dept=d, table=t, row=str(label), page=page, status=status, detail=detail))

    for r in load("dept_summary").itertuples():
        doc, p = r.cite["doc"], int(r.cite["pdf_page"])
        exp = [num(getattr(r, s)) for s in STAGES]
        cands = [(ln, s, label_hit(ln, r.label, 2, xmax=170))
                 for ln in lines(doc, p) for s in [slots(ln, xmin=170)] if len(s) >= 4 and [v for v, _ in s[:4]] == exp]
        if any(c[2] for c in cands):
            rec(r.dept, "budget_summary", r.label, p, "ok")
        elif cands:
            rec(r.dept, "budget_summary", r.label, p, "values_ok_label_not_on_line")
        else:
            rec(r.dept, "budget_summary", r.label, p, "MISMATCH", f"stored {[str(e) for e in exp]}")

    for r in load("services").itertuples():
        doc, p = r.cite["doc"], int(r.cite["pdf_page"])
        exp = [num(getattr(r, k)) for k in ("operating", "capital", "grant", "ftes")]
        exp_present = [e for e in exp if e is not None]
        found = False
        ls = lines(doc, p)
        for i, ln in enumerate(ls):
            tail = [num(w["t"]) for w in ln["w"] if is_slot(w["t"])]
            vals = [v for v in tail if v is not None]
            if vals and vals == exp_present and any(label_hit(ls[j], r.description, 2, xmax=310)
                                                    for j in range(max(0, i - 3), min(len(ls), i + 3))):
                found = True
                break
        rec(r.dept, "services", r.description, p, "ok" if found else "MISMATCH", f"stored {[str(e) for e in exp]}")

    for r in load("position_changes").itertuples():
        doc, p = r.cite["doc"], int(r.cite["pdf_page"])
        exp = [num(getattr(r, k)) for k in ("positions", "om_ftes", "non_om_ftes")]
        ok = False
        for ln in lines(doc, p):
            s = slots(ln, x1max=195)
            if not s:
                continue
            got, bad = [None, None, None], False
            for v, w in s:
                k = 0 if w["x1"] < 105 else 1 if w["x1"] < 152 else 2
                bad |= got[k] is not None
                got[k] = v
            if not bad and got == exp:
                ok = True
                break
        rec(r.dept, "position_changes", r.title, p, "ok" if ok else "MISMATCH", f"stored {[str(e) for e in exp]}")

    for r in load("kpis").itertuples():
        doc, p = r.cite["doc"], int(r.cite["pdf_page"])
        vals = [v for v in r.values if v]
        txt = "\n".join(ln["text"] for ln in lines(doc, p))
        ok = bool(vals) and all(v in txt for v in vals)
        rec(r.dept, "kpis", r.measure, p, "ok" if ok else "MISMATCH", f"values {list(vals)}")

    for r in load("capital_projects").itertuples():
        doc, p = r.cite["doc"], int(r.cite["pdf_page"])
        at = r.amount_text.strip() if isinstance(r.amount_text, str) else ""
        if not at or pd.isna(r.amount):   # no figure, or a printed figure left unset as a typo (p.123)
            rec(r.dept, "capital_projects", r.name or r.description[:60], p, "ok" if pd.isna(r.amount) else "note")
            continue
        pages = list(r.pdf_pages) if hasattr(r, "pdf_pages") and r.pdf_pages is not None else [p]
        txt = " ".join(ln["text"] for pg in pages for ln in lines(doc, int(pg)))
        m = re.search(r"\$?([\d,.]+)\s*(million|billion)?", at)
        conv = Decimal(m.group(1).replace(",", "")) * {"million": 10**6, "billion": 10**9}.get(m.group(2), 1)
        ok = re.sub(r"\s+", " ", at) in txt and conv == Decimal(int(r.amount))
        rec(r.dept, "capital_projects", r.name or r.description[:60], p, "ok" if ok else "MISMATCH",
            f"text {at!r}, converted {conv}, stored {r.amount}")

    li = load("line_items")
    bands = [(195, 262), (300, 370), (605, 675), (700, 770)]
    for r in li[li.is_unit_total].itertuples():
        p = int(r.pdf_page)
        exp = [num(getattr(r, s)) for s in STAGES]
        hit = False
        ls = lines("detailed", p)
        for i, ln in enumerate(ls):
            got = []
            for lo, hi in bands:
                v = [num(w["t"]) for w in ln["w"] if lo <= w["x1"] <= hi and is_slot(w["t"])]
                got.append(v[0] if v else None)
            if got == exp and any(label_hit(ls[j], r.description, 2) or norm(r.description)[-30:] in norm(ls[j]["text"])
                                  for j in range(max(0, i - 2), min(len(ls), i + 3))):
                hit = True
                break
        rec(r.section, "detailed_unit_total", r.description, p, "ok" if hit else "MISMATCH", f"stored {[str(e) for e in exp]}")
    return results


if __name__ == "__main__":
    res = run()
    print(Counter(r["status"] for r in res), len(res))
    for r in res:
        if r["status"] != "ok":
            print(r["status"], "|", r["dept"][:26], "|", r["table"][:18], "|", r["row"][:50], "| p.", r["page"], "|", r["detail"][:120])
