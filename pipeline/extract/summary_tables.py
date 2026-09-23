"""Summary book (2027 Proposed Plan and Executive Budget Summary) → structured tables.

Coordinate parsing (docs/02 §2): column anchors come from each table's own header words,
labels from the left band, numbers by the header they sit under. Values stored as printed,
including the document's own rounding quirks (docs/open-questions.md).
"""
from __future__ import annotations

import re

from common.numbers import parse_decimal
from common.summary_pdf import Column, assign_numbers, cite, find_word, lines, pdf_page_for

LINE_KIND = {"1.": "budget", "2.": "non_levy", "3.": "levy"}


def _dollars(text: str | None) -> int | None:
    v = parse_decimal(text) if text is not None else None
    return None if v is None else int(v)


def section_totals() -> list[dict]:
    """Summary p.7 '2027 Proposed Budget and Tax Rate Compared to Prior Year' (golden G1–G12)."""
    pdf_page = pdf_page_for(7)
    hdr = next(ln for ln in lines(pdf_page) if ln.text.startswith("2026 2027 CHANGE"))
    h = hdr.words
    cols = [Column("adopted_2026", h[0]["x0"], h[0]["x1"]), Column("proposed_2027", h[1]["x0"], h[1]["x1"]),
            Column("change", h[2]["x0"], h[2]["x1"]), Column("tax_rate_2026", h[3]["x0"], h[3]["x1"]),
            Column("tax_rate_2027", h[4]["x0"], h[4]["x1"]), Column("tax_rate_change", h[5]["x0"], h[5]["x1"])]
    out, section, label = [], None, None
    body = lines(pdf_page, top_min=hdr.top + 25, top_max=700)
    for i, ln in enumerate(body):
        first = ln.words[0]["text"]
        m = re.match(r"^([A-N])\.$", first)
        if m or first in ("SUBTOTAL", "TOTAL"):
            label = ln.label(max_x=200)
            section = m.group(1) if m else ("TOTAL" if first == "TOTAL" else "SUBTOTAL_" + re.sub(r"\W", "", label.split()[1]))
            continue
        if first not in LINE_KIND:
            continue
        vals = assign_numbers(ln, cols, right=16)
        # Summary p.7 section N line 2 prints its numbers a hair below its label: merge the next line.
        if not vals and i + 1 < len(body) and body[i + 1].words[0]["text"] not in LINE_KIND:
            vals = assign_numbers(body[i + 1], cols, right=16)
        out.append({
            "section": section, "label": label, "line": LINE_KIND[first],
            "adopted_2026": _dollars(vals.get("adopted_2026")),
            "proposed_2027": _dollars(vals.get("proposed_2027")),
            "change": _dollars(vals.get("change")),
            "tax_rate_2026": _rate(vals.get("tax_rate_2026")),
            "tax_rate_2027": _rate(vals.get("tax_rate_2027")),
            "tax_rate_change": _rate(vals.get("tax_rate_change")),
            "cite": cite(pdf_page),
        })
    return out


def _rate(text: str | None) -> str | None:
    v = parse_decimal(text) if text is not None else None
    return None if v is None else str(v)


def assessed_value() -> dict:
    """Golden G5: 'Tax Rates and Assessed Value - 2027 rate column is based on an estimated
    assessed value of: $47,141,816,729' (Summary p.7 footnote)."""
    pdf_page = pdf_page_for(7)
    w = find_word(pdf_page, "Assessed")
    note = next(ln for ln in lines(pdf_page) if abs(ln.top - w["top"]) < 3)
    text = note.text
    m = re.search(r"\$([\d,]+)", text)
    return {"value": int(m.group(1).replace(",", "")), "text": text, "cite": cite(pdf_page)}


def section_comparisons() -> list[dict]:
    """Summary p.8–10 'Comparisons by Budget Sections': adopted 2026 / requested 2027 /
    proposed 2027 / change vs adopted / change vs requested, per section line.
    `group_path` keeps the printed headings a line sits under (Appropriations, Funding Sources…)."""
    out, section, path = [], None, []
    for printed in (8, 9, 10):
        pdf_page = pdf_page_for(printed)
        page_lines = lines(pdf_page)
        hdr = next(ln for ln in page_lines if ln.text.startswith("Budget Budget Budget"))
        b = hdr.words
        cols = [Column("adopted_2026", b[0]["x0"], b[0]["x1"]), Column("requested_2027", b[1]["x0"], b[1]["x1"]),
                Column("proposed_2027", b[2]["x0"], b[2]["x1"]),
                Column("change_vs_adopted", b[3]["x0"], b[4]["x1"]),
                Column("change_vs_requested", b[5]["x0"], b[6]["x1"])]
        for ln in page_lines:
            if ln.top <= hdr.top + 5 or "PROPOSED PLAN AND EXECUTIVE" in ln.text:
                continue
            label = ln.label(max_x=235)
            vals = assign_numbers(ln, cols, right=12)
            m = re.match(r"^([A-N])\.\s+(.*)$", label)
            if m and not vals:
                section, path = m.group(1), []
                continue
            if not vals:
                indent = ln.words[0]["x0"]
                path = [p for p in path if p[0] < indent - 2] + [(indent, label)]
                continue
            out.append({
                "section": section, "group_path": [p[1] for p in path], "line": label,
                **{c.key: _dollars(vals.get(c.key)) for c in cols},
                "cite": cite(pdf_page),
            })
    return out


DEPT_TABLE_KEYS = ["adopted_2026", "requested_2027", "proposed_2027", "change_vs_adopted", "change_vs_requested"]
_NUM = re.compile(r"\(?-?[\d,]+(\.\d+)?\)?")


def _dept_table(printed: int) -> list[dict]:
    """Summary p.13–16 layout: department rows × five right-aligned value columns.
    Parenthesised figures are DPW's division subtotal, NOT negatives: stored positive, flagged."""
    pdf_page = pdf_page_for(printed)
    page_lines = lines(pdf_page)
    hdr_i = next(i for i, ln in enumerate(page_lines) if ln.text.startswith("Budget Budget Budget")
                 or ("Adopted" in ln.text and "Proposed" in ln.text and "Requested" in ln.text))
    first = next(ln for ln in page_lines[hdr_i + 1:] if sum(1 for w in ln.words if _NUM.fullmatch(w["text"])) == 5)
    cols = [Column(k, w["x1"] - 20, w["x1"]) for k, w in
            zip(DEPT_TABLE_KEYS, [w for w in first.words if _NUM.fullmatch(w["text"])])]
    out, group = [], None
    for ln in page_lines[hdr_i + 1:]:
        label = ln.label(max_x=235).rstrip(" *").strip()
        if not label or "PROPOSED PLAN AND EXECUTIVE" in ln.text or label.startswith("*"):
            continue
        raw = {}
        for w in ln.words:
            if _NUM.fullmatch(w["text"]):
                col = min(cols, key=lambda c: abs(w["x1"] - c.x1))
                if abs(w["x1"] - col.x1) <= 8:
                    raw[col.key] = w["text"]
        if not raw:
            group = label
            continue
        indent = ln.words[0]["x0"]
        out.append({
            "label": label, "group": group if indent > 55 else None, "indent": round(indent, 1),
            "footnote_star": bool(re.search(r"\*\s*$", ln.label(max_x=235))),
            "is_division_subtotal": any(t.startswith("(") for t in raw.values()),
            **{k: (str(parse_decimal(raw[k].strip("()"))) if k in raw else None) for k in DEPT_TABLE_KEYS},
            "cite": cite(pdf_page),
        })
    return out


def positions_summary() -> list[dict]:
    """Summary p.13 'Change in Positions' (golden G15–G17). Counts are whole numbers."""
    rows = _dept_table(13)
    for r in rows:
        for k in DEPT_TABLE_KEYS:
            r[k] = int(r[k]) if r[k] is not None else None
    return rows


def fte_summary() -> list[dict]:
    """Summary p.14–16 estimated FTEs: O&M funded / non-O&M funded / all funding sources."""
    out = []
    for printed, funding in ((14, "om"), (15, "non_om"), (16, "all")):
        out += [{"funding": funding, **r} for r in _dept_table(printed)]
    return out


def _write(name: str, rows: list[dict]) -> int:
    import pandas as pd

    from common.config import PROCESSED
    PROCESSED.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_parquet(PROCESSED / f"{name}.parquet", index=False)
    return len(rows)


def main() -> dict:
    import json

    from common.config import PROCESSED
    counts = {
        "section_totals": _write("section_totals", section_totals()),
        "section_comparisons": _write("section_comparisons", section_comparisons()),
        "positions_summary": _write("positions_summary", positions_summary()),
        "fte_summary": _write("fte_summary", fte_summary()),
    }
    (PROCESSED / "assessed_value.json").write_text(json.dumps(assessed_value(), indent=2))
    return counts
