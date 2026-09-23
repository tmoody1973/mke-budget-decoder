"""Detailed budget (BMD-2 forms) → line_items rows. Deterministic, no LLM.

Ported from mke-budget-commons/parsers/city_detailed.py (column-anchor idea, nearest-x1
value assignment, split-number merge, section headers, adjustment vocabulary), with three
changes for the 2027 Proposed book (Plans/temporal-moseying-garden.md P1.3):

1. Rows are keyed by the printed line number (1–26) in the left margin, not by top/3
   buckets — every row gets `line_no` for its citation for free.
2. Zones are derived per page from the header words. Some pages are horizontally
   stretched (Emergency Communications ±7.9pt, Police ±5.3pt vs docs/02 §3), so fixed
   zone limits would misplace numbers there. See docs/decisions.md D10.
3. Blank cells stay None. Integer dollars, Decimal units.

This module does row extraction + row typing. Hierarchy (dept → BCU → summary block vs
decision unit → category) is a second pass: see `assign_hierarchy`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Iterator, Optional

import pdfplumber

from common.config import DETAILED_PDF
from common.numbers import is_number_token, merge_split_numbers, parse_decimal

# Column keys left→right, matching the 7 DOLLARS/UNITS header words on every BMD-2 page.
COLUMNS = ("actual_2025", "adopted_2026_units", "adopted_2026",
           "requested_2027_units", "requested_2027", "proposed_2027_units", "proposed_2027")
UNIT_COLS = {c for c in COLUMNS if c.endswith("_units")}
LEFT_COLS = COLUMNS[:3]
RIGHT_COLS = COLUMNS[3:]
UNIT_PAIR = {"adopted_2026": "adopted_2026_units", "requested_2027": "requested_2027_units",
             "proposed_2027": "proposed_2027_units"}
# docs/02 §3 header x0 per column. Used only to sanity-check the per-page anchors.
SPEC_X0 = (214, 269, 311, 574, 616, 671, 713)
SPEC_TOLERANCE = 2.0      # docs/02 §3; exceeded on stretched pages → logged, not fatal
HARD_TOLERANCE = 10.0     # beyond this the page layout is something else → fail loudly

HEADER_MAX_TOP = 90
BODY_MIN_TOP, BODY_MAX_TOP = 90, 575
FOOTER_MIN_TOP = 575
ROW_SNAP = 4.0            # a word joins the numbered line whose top is within ±4pt

SECTION_HEADERS = {
    "SALARIES & WAGES": "salaries",
    "OPERATING EXPENDITURES": "operating",
    "EQUIPMENT PURCHASES": "equipment",
    "SPECIAL FUNDS": "special",
}
RESERVED_ROLLUP_ACCOUNTS = {"006000", "006100", "006300", "006800"}
PAY_RANGE_RE = re.compile(r"^[0-9A-Z]{2,4}$")  # 1UX, 7BN, EOE
FOOTNOTE_CODE_RE = re.compile(r"\(([A-Z0-9/]{1,6})\)")
FOOTNOTE_DEF_RE = re.compile(r"^\([A-Z0-9/]{1,6}\)\s+\S")
FOOTNOTE_ONLY_RE = re.compile(r"^(\([A-Z0-9/]{1,6}\))+$")
ADJUSTMENT_RE = re.compile(r"OVERTIME|PERSONNEL COST|WAGE RATE|RATE CHANGE|ALL OTHER SALAR|"
                           r"SALARY ADJUST|VACANCY|TURNOVER|LUMP SUM|ALLOCATION")
# Printed rollups recognized by wording because the account code is sometimes omitted.
ROLLUP_TEXT_RE = re.compile(r"ESTIMATED EMPLOYEE FRINGE BENEFITS")
COUNT_RE = re.compile(r"TOTAL NUMBER OF POSITIONS AUTHORIZED|O&M FTE")
FOOTER_RE = re.compile(r"^(?P<dept>.+?)\s+(?P<page_id>\d{3}\.\d+)\s+(?P<run>\d\w\w Run \S+)\s*$")


@dataclass
class PageGeometry:
    anchors: dict[str, float]      # column key → header word x1 (numbers are right-aligned)
    spans: dict[str, tuple[float, float]]  # column key → header word (x0, x1)
    max_spec_dev: float
    code_max_x: float              # FUND/ORG/SBCL/ACCOUNT sit left of this
    left_max_x1: float             # 2025/2026 values end by this
    pay_min_x: float
    right_min_x: float
    code_x: dict[str, float]       # FUND/ORG/SBCL/ACCOUNT header x0, to place codes


@dataclass
class Row:
    pdf_page: int
    printed_page: str
    line_no: int
    dept_printed: str
    fund: Optional[str] = None
    org: Optional[str] = None
    sbcl: Optional[str] = None
    account: Optional[str] = None
    description_raw: str = ""
    pay_range: Optional[str] = None
    values: dict = field(default_factory=dict)
    row_type: str = ""
    category: Optional[str] = None
    note: Optional[str] = None
    hierarchy_path: list[str] = field(default_factory=list)
    block: Optional[str] = None
    flags: list[str] = field(default_factory=list)

    @property
    def description(self) -> str:
        """Display text: asterisks (appropriation-control markers) and footnote codes removed."""
        d = FOOTNOTE_CODE_RE.sub("", self.description_raw.replace("*", ""))
        return re.sub(r"\s+", " ", d).strip()

    @property
    def footnote_flag(self) -> bool:
        return "*" in self.description_raw

    @property
    def footnote_codes(self) -> list[str]:
        return FOOTNOTE_CODE_RE.findall(self.description_raw)

    @property
    def has_values(self) -> bool:
        return any(v is not None for v in self.values.values())

    @property
    def upper(self) -> str:
        return self.description.upper()


class LayoutError(RuntimeError):
    pass


def page_geometry(words: list[dict], pdf_page: int) -> Optional[PageGeometry]:
    """Derive column anchors and zone limits from this page's own header row."""
    hdr = sorted((w for w in words if w["top"] < HEADER_MAX_TOP and w["text"] in ("DOLLARS", "UNITS")),
                 key=lambda w: w["x0"])
    if not hdr:
        return None
    if len(hdr) != len(COLUMNS):
        raise LayoutError(f"PDF p.{pdf_page}: expected 7 DOLLARS/UNITS header words, got {len(hdr)}")
    devs = [abs(w["x0"] - s) for w, s in zip(hdr, SPEC_X0)]
    if max(devs) > HARD_TOLERANCE:
        raise LayoutError(f"PDF p.{pdf_page}: header anchor {max(devs):.1f}pt from docs/02 §3 spec")
    if [w["text"] for w in hdr] != ["DOLLARS", "UNITS", "DOLLARS", "UNITS", "DOLLARS", "UNITS", "DOLLARS"]:
        raise LayoutError(f"PDF p.{pdf_page}: header words out of order")
    labels = {w["text"]: w for w in words if w["top"] < HEADER_MAX_TOP and w["x0"] < 200}
    code_x = {k: labels[k]["x0"] for k in ("FUND", "ORG", "SBCL", "ACCOUNT") if k in labels}
    rng = next((w for w in words if w["top"] < HEADER_MAX_TOP and w["text"] == "RANGE"), None)
    anchors = {c: w["x1"] for c, w in zip(COLUMNS, hdr)}
    return PageGeometry(
        anchors=anchors,
        spans={c: (w["x0"], w["x1"]) for c, w in zip(COLUMNS, hdr)},
        max_spec_dev=max(devs),
        code_max_x=hdr[0]["x0"] - 8,                       # codes end before the 2025 DOLLARS column
        left_max_x1=anchors["adopted_2026"] + 15,           # right-aligned values overhang header x1 ~9pt
        pay_min_x=(rng["x0"] - 6) if rng else hdr[3]["x0"] - 40,
        right_min_x=hdr[3]["x0"] - 5,
        code_x=code_x,
    )


# A value sits under its header word: right-aligned (dollars end ~10pt past the header's
# x1; ~16 on stretched pages) or centered (City Treasurer unit counts). A number belongs to
# a column when its span overlaps the header span widened by these margins.
BAND_LEFT, BAND_RIGHT = 12.0, 16.0


def _aligned_column(geo: "PageGeometry", keys, w: dict) -> Optional[str]:
    """The column this number sits under, or None (a number inside prose)."""
    hits = [k for k in keys
            if w["x0"] <= geo.spans[k][1] + BAND_RIGHT and w["x1"] >= geo.spans[k][0] - BAND_LEFT]
    return min(hits, key=lambda k: abs(w["x1"] - geo.anchors[k])) if hits else None


CODE_RE = re.compile(r"^[0-9A-Z]{4}$")  # FUND 0001 · ORG 1510 · SBCL R999


def _assign_codes(row: Row, code_words: list[dict], geo: PageGeometry) -> list[dict]:
    """FUND/ORG/SBCL/ACCOUNT by header x position. Returns words that aren't codes.

    Revenue pages omit SBCL; some fringe-benefit rows omit the ACCOUNT (Detailed 160.5
    line 25 prints 0001 1310 R999 with no 006100). Codes are still filed where present."""
    leftovers = []
    acct_x = geo.code_x.get("ACCOUNT", 148)
    for w in code_words:
        if re.fullmatch(r"\d{4,6}", w["text"]) and row.account is None and w["x0"] > acct_x - 4:
            row.account = w["text"]   # as printed; Detailed 160.6 prints "6300" for 006300
            if len(w["text"]) < 6:
                row.flags.append("account_printed_short")
            continue
        slots = {k: x for k, x in geo.code_x.items() if k != "ACCOUNT"}
        key = min(slots, key=lambda k: abs(w["x0"] - slots[k])) if slots else None
        if key and CODE_RE.match(w["text"]) and abs(w["x0"] - slots[key]) < 12 \
                and getattr(row, key.lower()) is None:
            setattr(row, key.lower(), w["text"])
        else:
            leftovers.append(w)
    return leftovers


def extract_row(words: list[dict], geo: PageGeometry, base: Row) -> Row:
    row = base
    code_words, desc_words = [], []
    cells: dict[str, list[dict]] = {}
    for w in merge_split_numbers(words):
        x0, x1, t = w["x0"], w["x1"], w["text"]
        numeric = is_number_token(t)
        if x0 < geo.code_max_x:
            code_words.append(w)
        elif numeric and x1 <= geo.left_max_x1 and _aligned_column(geo, LEFT_COLS, w):
            cells.setdefault(_aligned_column(geo, LEFT_COLS, w), []).append(w)
        elif x0 < geo.pay_min_x:
            desc_words.append(w)
        elif x0 < geo.right_min_x:
            if PAY_RANGE_RE.match(t) and row.pay_range is None:
                row.pay_range = t
            else:
                desc_words.append(w)
        elif numeric and _aligned_column(geo, RIGHT_COLS, w):
            cells.setdefault(_aligned_column(geo, RIGHT_COLS, w), []).append(w)
        else:
            desc_words.append(w)
        in_value_zone = x1 <= geo.left_max_x1 or x0 >= geo.right_min_x
        if numeric and in_value_zone and x0 >= geo.code_max_x and w in desc_words:
            row.flags.append(f"unaligned_number:{t}@{x1:.0f}")
    desc_words = _assign_codes(row, code_words, geo) + desc_words
    row.description_raw = " ".join(w["text"] for w in sorted(desc_words, key=lambda w: w["x0"])).strip()
    is_count = bool(COUNT_RE.search(row.description_raw.upper()))
    for col, toks in cells.items():
        if len(toks) > 1:
            raise LayoutError(f"PDF p.{row.pdf_page} line {row.line_no}: two numbers in {col}: "
                              f"{[t['text'] for t in toks]}")
        text = toks[0]["text"]
        value = parse_decimal(text)
        if is_count and col in UNIT_PAIR and UNIT_PAIR[col] not in cells:
            # Count rows hold only counts; wide FTE figures ("2352.95" on Police pages)
            # print right-aligned into the dollars band. Move to the paired units column.
            row.values[UNIT_PAIR[col]] = value
        elif col in UNIT_COLS or is_count:
            row.values[col] = value
        elif value is not None and value != value.to_integral_value():
            # Some departments print 2025 actual FTEs in the 2025 EXPENDITURE dollars
            # column on position lines (Detailed 220.13 line 2 "16.67"). Keep as printed, flag.
            if col != "actual_2025":
                raise LayoutError(f"PDF p.{row.pdf_page} line {row.line_no} {col}: non-integer "
                                  f"dollars {text!r}")
            row.values[col] = value
            row.flags.append("actual_2025_not_dollars")
        else:
            row.values[col] = int(value) if value is not None else None
    return row


def read_footer(words: list[dict]) -> Optional[re.Match]:
    text = " ".join(w["text"] for w in sorted((w for w in words if w["top"] > FOOTER_MIN_TOP),
                                                key=lambda w: w["x0"]))
    return FOOTER_RE.match(text)


def iter_page_rows(page, pdf_page: int, stats: dict) -> Iterator[Row]:
    words = page.extract_words()
    footer = read_footer(words)
    geo = page_geometry(words, pdf_page) if footer else None
    if footer is None or geo is None:
        stats["skipped_pages"].append(pdf_page)
        return
    if geo.max_spec_dev > SPEC_TOLERANCE:
        stats["stretched_pages"][pdf_page] = round(geo.max_spec_dev, 1)
    body = [w for w in words if BODY_MIN_TOP < w["top"] < BODY_MAX_TOP]
    line_nos = [w for w in body if w["x0"] < geo.code_x.get("FUND", 45) - 3
                and re.fullmatch(r"\d{1,2}", w["text"])]
    taken = {id(w) for w in line_nos}
    for n, anchor in enumerate(sorted(line_nos, key=lambda w: w["top"]), start=1):
        if int(anchor["text"]) != n:
            raise LayoutError(f"PDF p.{pdf_page}: line numbers not sequential at {anchor['text']}")
    for anchor in line_nos:
        mine = [w for w in body if id(w) not in taken and abs(w["top"] - anchor["top"]) <= ROW_SNAP]
        taken.update(id(w) for w in mine)
        base = Row(pdf_page=pdf_page, printed_page=footer["page_id"], line_no=int(anchor["text"]),
                   dept_printed=footer["dept"].strip())
        row = extract_row(mine, geo, base)
        if row.description_raw or row.has_values or row.account:
            yield row
    orphans = [w["text"] for w in body if id(w) not in taken]
    if orphans:
        stats["orphan_words"][pdf_page] = orphans


def _is_caps_name(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    return len(letters) >= 5 and "".join(letters).isupper()


def _acct6(account: Optional[str]) -> Optional[str]:
    return account.zfill(6) if account else None


def is_prose(row: Row, in_footnotes: bool) -> bool:
    """A footnote definition "(X) ..." or a continuation line inside a footnote block.
    Footnote prose runs across the number columns and can contain digits that happen to
    align ("Position authority for 1 Police Detective", Detailed 300.19)."""
    if row.pay_range or row.account:
        return False
    return bool(FOOTNOTE_DEF_RE.match(row.description_raw)) or in_footnotes


def classify(row: Row, category: Optional[str], in_footnotes: bool = False) -> str:
    """Row type from content + the running money category. Order matters."""
    d, du = row.description, row.upper
    if not row.has_values and not row.account and not row.pay_range:
        if du in SECTION_HEADERS:
            return "heading"
        letters = [c for c in d if c.isalpha()]
        if letters and d == d.upper():
            return "heading"
        if re.match(r"^(Subtotal|Total)\b", d):
            return "rollup"                    # printed total with blank values
        if d in ("Additional Equipment", "Replacement Equipment"):
            return "heading"
        return "note"
    if is_prose(row, in_footnotes):
        return "note"                          # "(X) Private Auto Allowance…" footnote prose
    if ROLLUP_TEXT_RE.search(du) or (_acct6(row.account) in RESERVED_ROLLUP_ACCOUNTS
                                     and re.search(r"\bTOTAL\b", du)):
        return "rollup"
    if COUNT_RE.search(du):
        return "count"
    if "DEDUCTION" in du:
        return "deduction"
    if re.search(r"\bTOTAL\b", du) or du.startswith("SUBTOTAL") or du.startswith("GROSS SALARIES"):
        # Title-case items that merely mention "total" are not totals ("Hoists (8 in total)").
        if d.upper() == d or re.match(r"^(Subtotal|Total|Gross)\b", d):
            return "rollup"
    if re.search(r"\d\s*BCU\b|BCU\s*=|BCU'S", du):
        return "rollup"                        # 'SUMMARY (1BCU=3DU)' closes a block (Detailed 220.2)
    if du == "SPECIAL FUNDS" and row.has_values:
        return "rollup"                        # summary-block special funds total prints unlabeled
    if category == "salaries" and not row.account:
        if row.pay_range or FOOTNOTE_ONLY_RE.match(d):
            return "position"
        if du == "OTHER" or ADJUSTMENT_RE.search(du):
            return "adjustment"
        units = [v for k, v in row.values.items() if k in UNIT_COLS and v is not None]
        if any(u < 0 or u != u.to_integral_value() for u in units):
            return "note"                      # "(0.5 FTE)" style footnote overflow
        return "position"                      # pay range wrapped off this line (commons finding)
    if row.account:
        return "account"
    return "item"                              # valued, uncoded: equipment/special/capital lines


GLUED_PAY_RE = re.compile(r"^(?P<text>.*\))(?P<pay>[0-9][A-Z]{2})$")


def _split_glued_pay_range(row: Row) -> None:
    """'Beach Water Monitoring Tech. (0.11FTE)(BCHW)9PN' → pay range 9PN (Detailed 250.28)."""
    if row.pay_range:
        return
    m = GLUED_PAY_RE.match(row.description_raw)
    if m:
        row.description_raw, row.pay_range = m["text"], m["pay"]
        row.flags.append("pay_range_glued")


def parse_detailed(pdf_path=DETAILED_PDF) -> tuple[list[Row], dict]:
    """Every BMD-2 row in the book, typed, with its running money category."""
    stats = {"skipped_pages": [], "stretched_pages": {}, "orphan_words": {}}
    rows: list[Row] = []
    category = None
    in_footnotes = False
    with pdfplumber.open(pdf_path) as pdf:
        for pdf_page, page in enumerate(pdf.pages, start=1):
            for row in iter_page_rows(page, pdf_page, stats):
                if row.upper in SECTION_HEADERS and not row.has_values:
                    category = SECTION_HEADERS[row.upper]
                _split_glued_pay_range(row)
                caps = any(c.isalpha() for c in row.description_raw) and \
                    row.description_raw == row.description_raw.upper()
                starts_block = row.account or row.pay_range or (
                    caps and not FOOTNOTE_DEF_RE.match(row.description_raw))
                if starts_block:
                    in_footnotes = False
                row.row_type = classify(row, category, in_footnotes)
                if FOOTNOTE_DEF_RE.match(row.description_raw) and row.row_type == "note":
                    in_footnotes = True
                if row.row_type == "note" and row.has_values:
                    stray = {k: str(v) for k, v in row.values.items() if v is not None}
                    row.flags.append(f"prose_numbers_not_values:{stray}")
                    row.values = {}
                if row.row_type == "position" and row.values.get("actual_2025") is not None:
                    # No per-position 2025 actuals exist; a figure here is a unit-level amount
                    # or a headcount printed on the first line (Detailed 220.11, 540.16). Kept
                    # as printed; never summed as this position's pay.
                    row.flags.append("actual_2025_not_position_pay")
                row.category = category if row.row_type not in ("heading", "note") else None
                if row.row_type == "note" and rows and not row.has_values:
                    prev = rows[-1]
                    prev.note = f"{prev.note} {row.description_raw}".strip() if prev.note else row.description_raw
                rows.append(row)
                # 006300/006800 totals close their category even where headers are omitted.
                # Only a printed TOTAL closes a category. Special-fund items reuse account 006300
                # (Detailed 110.14 line 17), so the code alone must not switch categories.
                if row.row_type == "rollup" and "OPERATING EXPENDITURES TOTAL" in row.upper:
                    category = "equipment"
                elif row.row_type == "rollup" and "EQUIPMENT PURCHASES TOTAL" in row.upper:
                    category = "special"
    join_wrapped_labels(rows)
    assign_hierarchy(rows)
    return rows, stats


# --------------------------------------------------------------------------------------- #
# Second pass: wrapped labels, then hierarchy + block. The block is what stops double
# counting (Socratic stop 1, 2026-09-22): the BCU summary sheet restates its decision units,
# so it is used as a CHECK (summary == sum of decision units) and never summed by queries.
# --------------------------------------------------------------------------------------- #
# Whole sections that restate money counted in another section (verified on the page):
#   320 DPW summary → 330/340/350 · 400 SPA total → 360–390 · 420 GCP total → all GCP depts
#   450/460 → itemize lines 440.1:20 and 440.2:2 · 470 → restates 440.2:5 · 560 Water Works recap
RESTATED_SECTIONS = {"320", "400", "420", "450", "460", "470", "560"}
SUMMARY_HEADER_RE = re.compile(r"SUMMARY|BCU'S|BCU\s*=\s*([2-9]|\d\d)\s*DU")
BCU_TAG_RE = re.compile(r"^\(?\d\s*BCU\s*=")
CATEGORY_ROLLUP_RE = re.compile(r"SALARIES|FRINGE|OPERATING EXPENDITURES|EQUIPMENT|SPECIAL FUNDS|"
                                r"BEFORE ADJUSTMENTS|SUBTOTAL|POSITIONS|FTE")
WRAP_TAIL_RE = re.compile(r"\b(FOR|BY|TO|OF|AND|THE)\s*$|-\s*$", re.I)


def section_of(row: Row) -> str:
    return row.printed_page.split(".")[0]


def join_wrapped_labels(rows: list[Row]) -> None:
    """A total whose label wraps prints its number only on the second line
    ('TOTAL BUDGET FOR PROVISION FOR' / 'EMPLOYEE RETIREMENT 273,417,384', Detailed 440.2).
    Prefix the first line's text onto the valued line and re-type it; the first line stays
    as a valueless heading, flagged."""
    for prev, cur in zip(rows, rows[1:]):
        if (prev.printed_page != cur.printed_page or cur.line_no != prev.line_no + 1
                or prev.has_values or prev.account or not cur.has_values or cur.account
                or cur.pay_range or prev.row_type == "note" and not re.search(r"total", prev.description_raw, re.I)):
            continue
        p = prev.description_raw
        if re.search(r"\btotal\b", p, re.I) or WRAP_TAIL_RE.search(p) or BCU_TAG_RE.match(cur.description_raw):
            cur.description_raw = f"{p} {cur.description_raw}"
            cur.flags.append(f"label_joined_from_line_{prev.line_no}")
            prev.flags.append(f"label_wraps_into_line_{cur.line_no}")
            prev.row_type = "heading"
            cur.row_type = classify(cur, cur.category)


MONEY_COLS = ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027")
ANCHOR_RE = re.compile(r"NET SALARIES & WAGES TOTAL|ESTIMATED EMPLOYEE FRINGE BENEFITS|"
                       r"OPERATING EXPENDITURES TOTAL|EQUIPMENT PURCHASES TOTAL|^SPECIAL FUNDS( TOTAL)?$")


EXPLICIT_UNIT_TOTAL_RE = re.compile(r"BCU|DECISION UNIT|UNIT TOTAL|DIVISION TOTAL|SECTION TOTAL|OFFICE .*TOTAL")


def is_category_anchor(row: Row) -> bool:
    return row.row_type == "rollup" and bool(ANCHOR_RE.search(row.upper))


def is_unit_total(row: Row) -> bool:
    return "unit_total" in row.flags


def _closes_unit(row: Row, acc: dict) -> bool:
    """A unit's grand total is the line whose every money column equals the sum of the
    unit's printed category anchors (006000+006100+006300+006800+special). Wording alone
    can't tell 'LIBRARY-PATRON EXPERIENCE & STRATEGY' (a total) from 'TRANSFER TO CAPITAL
    FUND' (an item); the arithmetic can."""
    if not row.has_values or row.account or row.pay_range or is_category_anchor(row):
        return False
    if not (_is_caps_name(row.description) or "BCU" in row.upper):
        return False
    if EXPLICIT_UNIT_TOTAL_RE.search(row.upper):
        return True
    if "EXPENSE TOTAL" in row.upper:
        return False     # 'OPERATING & MAINTENANCE EXPENSE TOTAL' is mid-unit (Detailed 510.8)
    return all((row.values.get(c) or 0) == acc[c] for c in MONEY_COLS) and any(acc.values())


def assign_hierarchy(rows: list[Row]) -> None:
    """hierarchy_path = [dept as printed, unit title]; block per the table in docs/decisions D11."""
    i = 0
    while i < len(rows):
        sec = section_of(rows[i])
        j = i
        while j < len(rows) and section_of(rows[j]) == sec:
            j += 1
        _assign_section(rows[i:j], restated=sec in RESTATED_SECTIONS)
        i = j


def _assign_section(rows: list[Row], restated: bool) -> None:
    opening = []
    for r in rows:
        if r.upper in SECTION_HEADERS:
            break
        if r.row_type == "heading":
            opening.append(r.description_raw)
    has_summary = any(SUMMARY_HEADER_RE.search(t.upper()) for t in opening)
    block = "restated" if restated else ("bcu_summary" if has_summary else "decision_unit")
    title_parts: list[str] = []
    title = "BCU SUMMARY" if block == "bcu_summary" else " ".join(opening[:2]).strip()
    collecting = block != "bcu_summary"
    acc = dict.fromkeys(MONEY_COLS, 0)
    for r in rows:
        if collecting and r.row_type == "heading" and r.upper not in SECTION_HEADERS \
                and not any(f.startswith("label_wraps") for f in r.flags):
            title_parts.append(r.description.rstrip(" -"))
        elif r.upper in SECTION_HEADERS or r.has_values:
            if collecting and title_parts:
                title = " – ".join(title_parts)
            collecting = False
        r.block = block
        r.hierarchy_path = [r.dept_printed, title]
        if is_category_anchor(r):
            for c in MONEY_COLS:
                acc[c] += r.values.get(c) or 0
            continue
        if _closes_unit(r, acc):
            r.row_type = "rollup"
            r.flags.append("unit_total")
            acc = dict.fromkeys(MONEY_COLS, 0)
            if block == "bcu_summary":
                block = "decision_unit"
            title_parts, collecting = [], True


def is_subtotal(row: Row) -> bool:
    return row.row_type in ("rollup", "count")


# --------------------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------------------- #
def _cite(r: Row) -> dict:
    return {"doc": "detailed", "pdf_page": r.pdf_page, "printed_page": r.printed_page, "line_no": r.line_no}


def _units(v) -> Optional[str]:
    return None if v is None else str(v)   # Decimal kept exact as text; loader casts to numeric(10,2)


def line_item_records(rows: list[Row]) -> list[dict]:
    out = []
    for r in rows:
        v = r.values
        out.append({
            "dept_printed": r.dept_printed, "section": section_of(r),
            "row_type": r.row_type, "block": r.block, "category": r.category,
            "hierarchy_path": r.hierarchy_path,
            "fund": r.fund, "org": r.org, "sbcl": r.sbcl, "account": r.account,
            "description": r.description, "description_raw": r.description_raw,
            "pay_range": r.pay_range, "footnote_codes": r.footnote_codes,
            "actual_2025": _money(v.get("actual_2025")),
            "adopted_2026_units": _units(v.get("adopted_2026_units")), "adopted_2026": v.get("adopted_2026"),
            "requested_2027_units": _units(v.get("requested_2027_units")), "requested_2027": v.get("requested_2027"),
            "proposed_2027_units": _units(v.get("proposed_2027_units")), "proposed_2027": v.get("proposed_2027"),
            "is_subtotal": r.row_type in ("rollup", "count"),
            "is_unit_total": is_unit_total(r),
            "is_position": r.row_type == "position",
            "is_deduction": r.row_type == "deduction",
            "footnote_flag": r.footnote_flag, "note": r.note, "flags": r.flags,
            "pdf_page": r.pdf_page, "printed_page": r.printed_page, "line_no": r.line_no,
            "cite": _cite(r),
        })
    return out


def _money(v):
    """actual_2025 is sometimes a printed count (flagged); only whole dollars go in the money column."""
    return v if isinstance(v, int) or v is None else None


def position_records(rows: list[Row]) -> list[dict]:
    return [{
        "dept_printed": r.dept_printed, "section": section_of(r), "block": r.block,
        "hierarchy_path": r.hierarchy_path, "title": r.description, "footnote_codes": r.footnote_codes,
        "pay_range": r.pay_range,
        "adopted_2026_units": _units(r.values.get("adopted_2026_units")), "adopted_2026": r.values.get("adopted_2026"),
        "requested_2027_units": _units(r.values.get("requested_2027_units")), "requested_2027": r.values.get("requested_2027"),
        "proposed_2027_units": _units(r.values.get("proposed_2027_units")), "proposed_2027": r.values.get("proposed_2027"),
        "pdf_page": r.pdf_page, "printed_page": r.printed_page, "line_no": r.line_no, "cite": _cite(r),
    } for r in rows if r.row_type == "position"]


def main() -> dict:
    import json

    import pandas as pd

    from common.config import PROCESSED
    rows, stats = parse_detailed()
    PROCESSED.mkdir(parents=True, exist_ok=True)
    money = {c: "Int64" for c in ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027")}
    li = pd.DataFrame(line_item_records(rows)).astype(money)   # nullable int: blank stays NULL
    pl = pd.DataFrame(position_records(rows)).astype({k: v for k, v in money.items() if k != "actual_2025"})
    li.to_parquet(PROCESSED / "line_items.parquet", index=False)
    pl.to_parquet(PROCESSED / "position_lines.parquet", index=False)
    report = {"rows": len(rows), "positions": sum(r.row_type == "position" for r in rows),
              "skipped_pages": stats["skipped_pages"], "stretched_pages": stats["stretched_pages"]}
    (PROCESSED / "detailed_extract_report.json").write_text(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    print(main())
