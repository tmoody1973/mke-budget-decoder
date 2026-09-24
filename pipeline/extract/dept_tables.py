"""Summary department template (docs/02 §2) → dept_summary, services, kpis, capital_projects,
position_changes. One pass per department over its Summary page range (departments.yaml).

Bordered tables (services, KPIs, position changes) use pdfplumber's table finder for the cell
grid — records come from the printed cell borders, not from guessing by vertical distance —
and our own word list (common.summary_pdf.words, which rebuilds rotated glyphs) for the text.
The BUDGET SUMMARY table has no borders and is read line by line under its header words.
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Optional

from common.departments import departments, summary_page_ranges
from common.numbers import parse_decimal
from common.summary_pdf import Column, _pdf, assign_numbers, cite, lines, pdf_page_for, words

DASH = {"-", "—", "–", ""}

SUMMARY_METRICS = {
    "FTEs - Operations & Maintenance": "fte_om",
    "FTEs - Other": "fte_other",
    "Total Positions Authorized": "positions",
    "Salaries and Wages": "salaries",
    "Fringe Benefits": "fringe",
    "Operating Expenditures": "operating",
    "Equipment": "equipment",
    "Special Funds": "special_funds",
}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _num(text: Optional[str]) -> Optional[Decimal]:
    if text is None or text.strip() in DASH:
        return None
    return parse_decimal(text.strip().strip("[]"))     # '[4,998,805]' (Summary p.187), flagged by caller


def _dollars(text: Optional[str]) -> Optional[int]:
    v = _num(text)
    return None if v is None else int(v)


# --------------------------------------------------------------------------------------- #
# Budget summary (no borders)
# --------------------------------------------------------------------------------------- #
BLOCK_TITLES = {"SUMMARY OF EXPENDITURES": "expenditures", "SOURCE OF FUNDS": "source of funds"}
STAGE_KEYS = ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027")
WRAP_SAME_ROW = 6.5     # pt: a wrapped label half sits within ~5pt of its numbers; group headings ~10pt
CONNECTOR_END = re.compile(r"(-|–|\bfor|\bof|\band|\bthe|\bto)$", re.I)


def _is_year_header(ln) -> bool:
    toks = [x["text"] for x in ln.words]
    return any(t in ("Proposed", "Change", "Versus") for t in toks) or (
        toks and all(re.fullmatch(r"20\d\d", t) for t in toks if re.search(r"\d", t)) and not ln.label(max_x=180))


def budget_summary(slug: str, pdf_page: int) -> list[dict]:
    """Borderless four-stage table ('BUDGET SUMMARY', 'SUMMARY OF EXPENDITURES', 'SOURCE OF FUNDS').

    Rows are the lines that carry stage values. A row whose label wraps prints its numbers on a
    line of their own between the label halves (Summary p.163: 'Charges for Service Deferred' /
    numbers / 'Compensation'), so label-only lines within WRAP_SAME_ROW of a numbers line — or
    ending in a connector like '-' — join that row. Other label-only lines are group headings.
    Values printed in [brackets] are kept and flagged (Summary p.187, meaning not stated)."""
    page_lines = lines(pdf_page)
    try:
        hdr = next(ln for ln in page_lines if "Actual" in ln.text and "Proposed" in ln.text and "Versus" in ln.text)
    except StopIteration:
        return []
    sub = next(ln for ln in page_lines if ln.top > hdr.top and "Requested" in ln.text)
    w = {x["text"]: x for x in hdr.words}
    change = [x for x in sub.words if x["text"] in ("Adopted", "Requested") and x["x0"] > w["Proposed"]["x1"]]
    cols = [Column("actual_2025", w["Actual"]["x0"], w["Actual"]["x1"]),
            Column("adopted_2026", w["Adopted"]["x0"], w["Adopted"]["x1"]),
            Column("requested_2027", w["Requested"]["x0"], w["Requested"]["x1"]),
            Column("proposed_2027", w["Proposed"]["x0"], w["Proposed"]["x1"])]
    if len(change) == 2:
        cols += [Column("change_vs_adopted", change[0]["x0"], change[0]["x1"]),
                 Column("change_vs_requested", change[1]["x0"], change[1]["x1"])]
    stop = next((ln.top for ln in page_lines if ln.top > sub.top and "SUMMARY OF SERVICES" in ln.text), 10_000)
    title_above = [BLOCK_TITLES[ln.text.strip()] for ln in page_lines if ln.top < hdr.top and ln.text.strip() in BLOCK_TITLES]

    # pass 1: classify lines
    entries = []
    for ln in page_lines:
        if not (sub.top < ln.top < stop) or "PROPOSED PLAN AND EXECUTIVE" in ln.text:
            continue                                   # footer line ('190 2027 PROPOSED PLAN…', p.190)
        if ln.text.strip() in BLOCK_TITLES:
            entries.append({"top": ln.top, "title": BLOCK_TITLES[ln.text.strip()]})
            continue
        numeric = sum(1 for x in ln.words if re.search(r"\d", x["text"]))
        if len(ln.words) >= 8 and numeric < 2:
            break                                      # prose below the table (Summary p.163)
        if "Budget Budget" in ln.text or _is_year_header(ln):
            continue                                   # repeated header rows of a second block
        label = ln.label(max_x=cols[0].x0 - 5)
        vals = assign_numbers(ln, cols, left=35, right=16)
        stage = any(k in vals for k in STAGE_KEYS)
        if label or vals:
            entries.append({"top": ln.top, "label": label, "vals": vals, "stage": stage})

    # pass 2: attach wrapped label halves (and stray change-column values) to their numbers line
    rows = [e for e in entries if e.get("stage")]
    for e in entries:
        if "title" in e or e["stage"]:
            continue
        below = [r for r in rows if r["top"] > e["top"]]
        near = min(rows, key=lambda r: abs(r["top"] - e["top"]), default=None)
        target = None
        if e["label"] and CONNECTOR_END.search(e["label"]) and below:
            target = below[0]                          # 'Employer's Pension Contribution -' + next line
        elif near is not None and abs(near["top"] - e["top"]) <= WRAP_SAME_ROW:
            target = near
        if target is None:
            e["group"] = e["label"].lower() if e["label"] else None
            continue
        target.setdefault("parts", []).append((e["top"], e["label"]))
        for k, v in e["vals"].items():
            target["vals"].setdefault(k, v)
        e["merged"] = True

    out, group = [], (title_above[-1] if title_above else None)
    for e in sorted(entries, key=lambda e: e["top"]):
        if "title" in e:
            group = e["title"]
            continue
        if e.get("merged"):
            continue
        if not e["stage"]:
            if e.get("group"):
                group = e["group"]
            continue
        parts = sorted(e.get("parts", []) + [(e["top"], e["label"])])
        label = " ".join(p for _, p in parts if p).strip()
        revenue_side = group in ("revenues", "source of funds") or (group or "").endswith("revenues")
        if revenue_side:
            metric = "rev_total" if label == "Total" else "rev_" + _slug(label)
        elif label == "Total":
            metric = "total_expenditures"
        else:
            metric = SUMMARY_METRICS.get(label, _slug(label))
        flags = [f"printed_bracketed:{k}" for k, t in e["vals"].items() if str(t).startswith("[")]
        out.append({"dept": slug, "metric": metric, "label": label, "group": group,
                    **{c.key: (str(v) if (v := _num(e["vals"].get(c.key))) is not None else None) for c in cols},
                    "flags": flags, "label_wrapped": bool(e.get("parts")), "cite": cite(pdf_page)})
    return out


# --------------------------------------------------------------------------------------- #
# Bordered tables
# --------------------------------------------------------------------------------------- #
def _cell_text(pdf_page: int, bbox) -> str:
    if bbox is None:
        return ""
    x0, top, x1, bottom = bbox
    ws = [w for w in words(pdf_page) if w["x0"] >= x0 - 1 and w["x1"] <= x1 + 1
          and w["top"] >= top - 1 and w["bottom"] <= bottom + 1]
    ws.sort(key=lambda w: (round(w["top"]), w["x0"]))
    return re.sub(r"\s+", " ", " ".join(w["text"] for w in ws)).strip()


def bordered_tables(pdf_page: int) -> list[list[list[str]]]:
    tables = _pdf().pages[pdf_page - 1].find_tables()
    return [[[_cell_text(pdf_page, c) for c in row.cells] for row in t.rows] for t in tables]


SERVICE_COLS = {"operating": "operating", "capital": "capital", "grant": "grant", "fte": "ftes"}


def _services(slug, pdf_page, rows) -> list[dict]:
    """Columns mapped by header name, not position: some tables print only Operating and FTEs
    (Summary p.171), and a positional read put the FTE count under capital."""
    head = [h.lower() for h in rows[0]]
    idx = {key: next((i for i, h in enumerate(head) if word in h), None) for word, key in SERVICE_COLS.items()}
    cell = lambda r, key: r[idx[key]] if idx[key] is not None and idx[key] < len(r) else ""
    out = []
    for r in rows[1:]:
        desc = r[0] if r else ""
        if not desc and not any(cell(r, k) for k in idx):
            continue
        out.append({"dept": slug, "description": desc, "operating": _dollars(cell(r, "operating")),
                    "capital": _dollars(cell(r, "capital")), "grant": _dollars(cell(r, "grant")),
                    "ftes": (str(v) if (v := _num(cell(r, "ftes"))) is not None else None),
                    "is_total": desc.strip().lower() in ("total", "totals"), "cite": cite(pdf_page)})
    return out


def _kpis(slug, pdf_page, rows) -> list[dict]:
    """One row per measure, labels as printed. A parent measure with '•' sub-measures packed in one
    cell (Fire, Summary p.92) is split when every value cell holds exactly one value per bullet;
    the parent goes to `group`. If the counts don't line up, the row is kept as printed and flagged."""
    labels = rows[0][1:]
    out = []
    for r in rows[1:]:
        if not r or not r[0]:
            continue
        parent, *subs = [x.strip() for x in r[0].split("•")]
        cells = [c.split() for c in r[1:]]
        if subs and all(len(c) == len(subs) for c in cells):
            for i, sub in enumerate(subs):
                out.append({"dept": slug, "measure": sub, "group": parent, "col_labels": labels,
                            "values": [c[i] for c in cells], "footnote": None, "flags": [], "cite": cite(pdf_page)})
            continue
        out.append({"dept": slug, "measure": r[0], "group": None, "col_labels": labels, "values": r[1:],
                    "footnote": None, "flags": ["bulleted_values_not_split"] if subs else [], "cite": cite(pdf_page)})
    return out


def _position_changes(slug, pdf_page, rows) -> list[dict]:
    out = []
    for r in rows[1:]:
        pos, om, nonom, title, reason = (r + [""] * 5)[:5]
        merged = False
        if not title and not reason:
            if not any(x not in DASH for x in (pos, om, nonom)) or not out:
                continue
            # title/reason cells merged with the row above (Summary p.134 FTE correction pair)
            title, reason, merged = out[-1]["title"], out[-1]["reason"] or "", True
        out.append({"dept": slug, "positions": _str(pos), "om_ftes": _str(om), "non_om_ftes": _str(nonom),
                    "title": title, "reason": reason or None, "is_total": title.strip().lower() in ("total", "totals"),
                    "merged_with_previous": merged, "cite": cite(pdf_page)})
    return out


def _str(text: str) -> Optional[str]:
    v = _num(text)
    return None if v is None else str(v)


def _starts_sentence(prev: str, cur: str) -> bool:
    return bool(cur) and cur[0].isupper() and prev.rstrip().endswith((".", ")"))


def _column_starts(body, fte_x1: float, title_hdr_x1: float) -> tuple[float, float]:
    """Left edges of the Title and Reason columns, from the data: the most common x0 of a
    word that opens a line or follows a wide gap. Header words are centered over their
    columns, so their positions drift from the data by 5–20pt page to page (Summary p.104)."""
    from collections import Counter
    opens = Counter()
    for ln in body:
        prev = None
        for w in ln.words:
            if w["x0"] > fte_x1 and not re.fullmatch(r"\(?-?[\d.,]+\)?|-", w["text"]) \
                    and (prev is None or w["x0"] - prev["x1"] > 25):
                opens[round(w["x0"])] += 1
            prev = w
    title = [x for x, _ in opens.most_common() if x < title_hdr_x1]
    reason = [x for x, _ in opens.most_common() if x >= title_hdr_x1 - 30]
    return (title[0] - 3 if title else fte_x1 + 10), (reason[0] - 3 if reason else title_hdr_x1 + 60)


def unbordered_position_changes(slug: str, pdf_page: int, prev_geo: Optional[dict] = None,
                                return_geo: bool = False):
    """Position-change tables printed without cell borders (Administration, Summary p.39).
    Each record is anchored on its numbers row; reason lines between two anchors are split at
    the sentence start nearest the midpoint. Title-only lines far from any numbers row are
    group headings ('Office of the Commissioner'). A continuation page with no column header
    (Summary p.136) reuses the previous page's column layout."""
    page_lines = lines(pdf_page)
    hdr = next((ln for ln in page_lines if {"Positions", "Title", "Reason"} <= {w["text"] for w in ln.words}), None)
    if hdr is not None:
        h = {w["text"]: w for w in hdr.words}
        fte_hdrs = [w for w in hdr.words if w["text"] == "FTEs"]
        if len(fte_hdrs) != 2:
            return ([], None) if return_geo else []
        geo = {"fte_x1": fte_hdrs[-1]["x1"], "title_hdr_x1": h["Title"]["x1"],
               "num_cols": [Column("positions", h["Positions"]["x0"], h["Positions"]["x1"]),
                            Column("om_ftes", fte_hdrs[0]["x0"], fte_hdrs[0]["x1"]),
                            Column("non_om_ftes", fte_hdrs[1]["x0"], fte_hdrs[1]["x1"])]}
        start = hdr.top
    elif prev_geo is not None:
        intro = next((ln for ln in page_lines if ln.text.startswith("Specific ADDITIONAL")), None)
        if intro is None:
            return ([], None) if return_geo else []
        geo, start = prev_geo, intro.top
    else:
        return ([], None) if return_geo else []
    body0 = [ln for ln in page_lines if ln.top > start]
    title_min, reason_min = _column_starts(body0, geo["fte_x1"], geo["title_hdr_x1"])
    num_cols = geo["num_cols"]

    class _Hdr:            # keeps the loop below unchanged
        top = start
    hdr = _Hdr
    body = [ln for ln in page_lines if ln.top > hdr.top and "PROPOSED PLAN AND EXECUTIVE" not in ln.text]
    anchors, reasons, titles = [], [], []
    for ln in body:
        nums = [w for w in ln.words if w["x1"] < title_min and re.fullmatch(r"\(?-?[\d.,]+\)?|-", w["text"])]
        title = " ".join(w["text"] for w in ln.words if title_min <= w["x0"] < reason_min)
        reason = " ".join(w["text"] for w in ln.words if w["x0"] >= reason_min)
        if nums:
            anchors.append({"top": ln.top, "nums": nums, "title": title, "reason": [reason] if reason else []})
        else:
            if reason:
                reasons.append((ln.top, reason))
            if title:
                titles.append((ln.top, title))
        if title.strip().lower() in ("total", "totals"):
            break
    if not anchors:
        return ([], geo) if return_geo else []
    # reasons → anchors: before the first anchor → first; between anchors → split at sentence start
    tops = [a["top"] for a in anchors]
    for i, (top, text) in enumerate(reasons):
        j = sum(1 for t in tops if t < top)          # anchors above this line
        if j == 0:
            anchors[0]["reason"].insert(0, text)
            continue
        if j == len(anchors):
            anchors[-1]["reason"].append(text)
            continue
        above, below = anchors[j - 1], anchors[j]
        between = [(t, x) for t, x in reasons if above["top"] < t < below["top"]]
        mid = (above["top"] + below["top"]) / 2
        starts = [t for k, (t, x) in enumerate(between)
                  if k == 0 and _starts_sentence(above["reason"][-1] if above["reason"] else ".", x)
                  or k > 0 and _starts_sentence(between[k - 1][1], x)]
        split = min(starts, key=lambda t: abs(t - mid)) if starts else mid
        (below if top >= split else above)["reason"].append(text)
    group, out = None, []
    for top, title in titles:
        near = min(anchors, key=lambda a: abs(a["top"] - top))
        # a row with an empty title cell takes wrapped title lines up to 20pt away
        # (Summary p.55: 'Housing Rehab Specialist 4' / 'Real Estate Development Specialist')
        reach = 20 if not near["title"] or near.get("title_from_wrap") else 8
        if abs(near["top"] - top) <= reach:
            near["title_from_wrap"] = near.get("title_from_wrap", not near["title"])
            near["title"] = f"{near['title']} {title}".strip() if near["top"] < top else f"{title} {near['title']}".strip()
        else:
            near.setdefault("groups", []).append((top, title))
    for a in anchors:
        vals = {}
        for w in a["nums"]:
            col = min(num_cols, key=lambda c: abs((w["x0"] + w["x1"]) / 2 - (c.x0 + c.x1) / 2))
            vals[col.key] = w["text"]
        for top, title in sorted(a.get("groups", [])):
            if top < a["top"]:
                group = title
        out.append({"dept": slug, "positions": _str(vals.get("positions", "")),
                    "om_ftes": _str(vals.get("om_ftes", "")), "non_om_ftes": _str(vals.get("non_om_ftes", "")),
                    "title": a["title"], "reason": " ".join(a["reason"]) or None, "group": group,
                    "is_total": a["title"].strip().lower() in ("total", "totals"), "bordered": False, "cite": cite(pdf_page)})
    return (out, geo) if return_geo else out


# --------------------------------------------------------------------------------------- #
# Capital projects (bullets)
# --------------------------------------------------------------------------------------- #
MILLION_RE = re.compile(r"\(\$(?P<n>[\d.,]+)\s*(?P<unit>million|billion)?\)", re.I)


def _amount(m: re.Match) -> tuple[int, bool]:
    n = Decimal(m["n"].replace(",", ""))
    unit = (m["unit"] or "").lower()
    scale = {"million": 1_000_000, "billion": 1_000_000_000}.get(unit, 1)
    return int(n * scale), bool(unit)


# Street abbreviations end a line without ending a sentence ('…in N. 35th Street from W.' / 'Capitol
# Drive…', Summary p.205-206), so a line ending in one of them continues the item.
ABBREV_END = re.compile(r"(?:\b[A-Z]|\bSt|\bAve|\bDr|\bNo|\bInc|\bRd|\bBlvd)\.$")


def _ends_sentence(text: str) -> bool:
    t = text.rstrip()
    return t.endswith(".") and not ABBREV_END.search(t)


# '$150,000 for general IT upgrades' / 'includes $3.0 million for MFD Facilities Maintenance program.'
FOR_NAME = re.compile(r"\$[\d.,]+\s*(?:million|billion)?\s+for\s+(?:the\s+)?(?P<name>.+?)"
                      r"(?=,|\.(?:\s|$)|;|:|\s(?:which|that|to fund|to support|to begin|to continue|including)\b|$)")
DASH_NAME = re.compile(r"^(?P<name>[A-Z][^–:]{2,90}?)\s+[–-]\s+[A-Z]")     # 'Compliance Loan Program (CLP) - The …'
FUNDING = re.compile(r"^\$[\d.,]+\s*(?:million|billion)?\s+in\s", re.I)   # '$19.25 million in levy-supported City capital funds'


def capital_projects(slug: str, pages: list[int]) -> list[dict]:
    out, inside, cur = [], False, None
    for pdf_page in pages:
        for ln in lines(pdf_page, top_min=60, top_max=740):
            t = ln.text
            if t.strip() == "CAPITAL PROJECTS":
                inside = True
                continue
            if not inside:
                continue
            if (re.fullmatch(r"[A-Z][A-Z0-9 &'’,()./-]{6,}", t.strip())            # next all-caps heading
                    or t.startswith(("Key Performance", "Description of Services", "DESCRIPTION OF SERVICES"))
                    or re.match(r"^20\d\d 20\d\d", t)):                             # a table's year header
                inside = False
                cur = None
                continue
            if t.startswith("•"):
                cur = {"dept": slug, "text": t.lstrip("• ").strip(), "bullet": True, "cite": cite(pdf_page),
                       "pdf_pages": [pdf_page]}
                out.append(cur)
            elif cur is not None and (cur["bullet"] or not _ends_sentence(cur["text"])):
                cur["text"] += " " + t.strip()
                if pdf_page not in cur["pdf_pages"]:
                    cur["pdf_pages"].append(pdf_page)     # item continues across a page break (Summary p.205-206)
            else:   # a sentence, not a bullet ("…includes $3.0 million for MFD Facilities Maintenance")
                cur = {"dept": slug, "text": t.strip(), "bullet": False, "cite": cite(pdf_page), "pdf_pages": [pdf_page]}
                out.append(cur)
    SENTENCE_AMOUNT_RE = re.compile(r"\$(?P<n>[\d.,]+)\s*(?P<unit>million|billion)?", re.I)
    for c in out:
        paren = MILLION_RE.search(c["text"])
        m = paren or SENTENCE_AMOUNT_RE.search(c["text"])
        # "Police Vehicles ($2.0 million) – …" / "Advanced Planning Fund ($200,000): …" print a name
        # before a parenthesised amount. A bare "$3.0 million" inside a sentence has no name → None.
        colon = re.match(r"^([A-Z][^:]{2,100}?):\s", c["text"])
        dash, named_for = DASH_NAME.match(c["text"]), FOR_NAME.search(c["text"])
        if paren and paren.start() < 120:
            c["name"] = c["text"][:paren.start()].strip(" •:–-")
        elif colon and not colon.group(1).startswith("The ") and "." not in colon.group(1).replace("(", "").replace(")", "")[:-1]:
            c["name"] = colon.group(1).strip()           # 'Pump Facilities: The Sewer Maintenance Fund…' (p.205)
        elif dash:
            c["name"] = dash["name"].strip()
        elif named_for and not c["text"].rstrip().endswith(":"):
            c["name"] = named_for["name"].strip()
            c["name"] = c["name"][:1].upper() + c["name"][1:]
        else:
            c["name"] = None
        c["amount"], c["amount_from_millions"] = _amount(m) if m else (None, False)
        c["amount_text"] = m.group(0).strip() if m else None
        # A figure printed in millions that is itself a million or more ('$1,300,000 million', Summary
        # p.123) is a typo in the document. Keep the printed text; leave the amount unset, not guessed.
        if c["amount_from_millions"] and m and Decimal(m["n"].replace(",", "")) >= 1000:
            c["amount"] = None
        text = c["text"].rstrip()
        c["kind"] = ("funding_source" if FUNDING.match(text)
                     else "list_heading" if text.endswith(":")
                     else "project" if c["name"] else "context")
        c["description"] = c.pop("text")
    return out


# --------------------------------------------------------------------------------------- #
def extract_department(slug: str, first: int, last: int) -> dict[str, list]:
    pages = [pdf_page_for(p) for p in range(first, last + 1)]
    result = {"dept_summary": budget_summary(slug, pages[0]), "services": [], "kpis": [],
              "position_changes": [], "unknown_tables": []}
    last_kind, pc_geo = None, None
    for pdf_page in pages:
        found_bordered_pc = False
        for rows in bordered_tables(pdf_page):
            head = " ".join(rows[0]) if rows else ""
            if last_kind == "position_changes_bordered" and rows and len(rows[0]) == 5 and not any(
                    k in head for k in ("Position Title", "Description", "Key Performance", "Indicators")):
                # Headerless continuation of the previous page's position table (Summary p.135)
                result["position_changes"] += _position_changes(slug, pdf_page, [["header"]] + rows)
                found_bordered_pc = True
                continue
            if last_kind == "position_changes_bordered" and not rows:
                continue
            if head.upper().startswith("DESCRIPTION OF SERVICES"):
                result["services"] += _services(slug, pdf_page, rows)
            elif head.startswith(("Key Performance Measures", "Indicators")):
                result["kpis"] += _kpis(slug, pdf_page, rows)
            elif "Position Title" in head:
                result["position_changes"] += _position_changes(slug, pdf_page, rows)
                found_bordered_pc = True
                last_kind = "position_changes_bordered"
            else:
                result["unknown_tables"].append({"dept": slug, "pdf_page": pdf_page, "head": head[:80]})
        if not found_bordered_pc:
            if pc_geo is None and (last_kind or "").startswith("position_changes"):
                # layout from the last page that printed the column header (Summary p.134 → p.136)
                for earlier in reversed(pages[:pages.index(pdf_page)]):
                    _, pc_geo = unbordered_position_changes(slug, earlier, return_geo=True)
                    if pc_geo:
                        break
            got, geo = unbordered_position_changes(
                slug, pdf_page, pc_geo if (last_kind or "").startswith("position_changes") else None, return_geo=True)
            pc_geo = geo or pc_geo
            result["position_changes"] += got
            if got:
                last_kind = "position_changes_unbordered"
    result["capital_projects"] = capital_projects(slug, pages)
    result["position_changes"] = _sections_from_headings(result["position_changes"])
    return result


def _sections_from_headings(rows: list[dict]) -> list[dict]:
    """A row with a title but no numbers and no reason is a section heading printed inside the
    table ('Transportation Infrastructure', DPW-ISD Summary p.134-136): drop it as a row and carry
    it as `section` on the rows beneath, across page breaks."""
    out, section = [], None
    for r in rows:
        empty = all(r.get(k) is None for k in ("positions", "om_ftes", "non_om_ftes"))
        if empty and not r.get("reason") and not r["is_total"] and r["title"]:
            section = r["title"]
            continue
        out.append({**r, "section": None if r["is_total"] else section})
    return out


def extract_all() -> dict[str, list]:
    ranges = summary_page_ranges()
    out: dict[str, list] = {}
    for d in departments():
        if d["slug"] not in ranges:
            continue
        for k, v in extract_department(d["slug"], *ranges[d["slug"]]).items():
            out.setdefault(k, []).extend(v)
    return out


def _write(name: str, rows: list[dict]) -> int:
    import pandas as pd

    from common.config import PROCESSED
    pd.DataFrame(rows).to_parquet(PROCESSED / f"{name}.parquet", index=False)
    return len(rows)


def main() -> dict:
    from common.reason_category import reason_category
    r = extract_all()
    for row in r["position_changes"]:
        row["reason_category"] = None if row["is_total"] else reason_category(row["reason"])
    return {k: _write(k, v) for k, v in r.items() if k != "unknown_tables"} | {"unknown_tables": len(r["unknown_tables"])}
