"""
Narrative chunker for the 2027 Proposed Plan & Executive Budget Summary (docs/06).

Structure-aware: splits by department and section heading, splits bullet lists into one chunk per
bullet, drops table regions (those belong to the structured lane), and attaches citation metadata
plus a contextual header to every chunk. Adds one routing *table card* per extracted table and one
*chart card* per chart whose data is not in the text layer. Output: data/processed/chunks.jsonl and
data/processed/dept_crosswalk.json (no embeddings yet — P1.10).

Usage: uv run python -m extract.narrative_chunks            (defaults from common.config)
Requires poppler's pdftotext on PATH.

P1.5 changes to the prototype (docs/06 §10): department slug by Summary page range from
departments.yaml (covers DPW title variants and fund pages whose first line isn't the fund name);
prose sub-headings become `heading`; parent_section_id + linked_tables; budget_version from config;
page passed explicitly instead of a module global.
"""
import json, re, subprocess, sys
from dataclasses import dataclass, asdict, field

import pandas as pd

from common.config import BUDGET_VERSION, PROCESSED, SUMMARY_PDF, SUMMARY_PAGE_OFFSET as PAGE_OFFSET
from common.departments import by_slug, departments, summary_page_ranges

FOOTER = "2027 PROPOSED PLAN AND EXECUTIVE BUDGET SUMMARY"

# Headings that start narrative sections (keep) vs structured tables (skip; parsed elsewhere)
NARRATIVE_HEADS = {
    "MISSION:": "mission",
    "SUMMARY OF SERVICES DELIVERED BY THIS DEPARTMENT": "services_overview",
    "SERVICE HIGHLIGHTS": "service_highlight",
    "CAPITAL PROJECTS": "capital_project",
}
TABLE_HEADS = {
    "BUDGET SUMMARY": "budget_summary_table",
    "Key Performance Measures": "kpi_table",
    "DETAILED LISTING OF POSITION AND FULL TIME EQUIVALENTS' CHANGES": "position_changes_table",
    "DETAILED LISTING OF POSITION AND FULL TIME EQUIVALENTS’ CHANGES": "position_changes_table",
    "Description of Services Provided": "services_table",
}
FRONT_MATTER_LAST_PDF_PAGE = 10
SUMMARY_TABLE_PAGES = (17, 34)   # printed p.7-24: summary tables; keep only prose notes

NUM_TOKEN = re.compile(r"^[\$\-\(]*[\d][\d,\.]*%?\)?$")

@dataclass
class Chunk:
    id: str
    doc: str
    budget_version: str
    pdf_page: int
    printed_page: int
    page_end: int
    region: str            # intro | department | source_of_funds | special_fund | capital | other
    dept: str | None       # departments.yaml slug
    section_type: str
    heading: str
    ordinal: int
    text: str
    context_header: str = ""
    numbers: list = field(default_factory=list)   # numeric tokens present (for grounding: narrative-sourced)
    parent_section_id: str = ""
    linked_tables: list = field(default_factory=list)
    kind: str = "narrative"   # narrative | table_card | chart_card

def pages_text(pdf):
    out = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True).stdout
    return out.split("\f")

def is_tabular(line):
    toks = line.split()
    if not toks: return False
    nums = sum(bool(NUM_TOKEN.match(t)) for t in toks)
    return nums / len(toks) >= 0.5 or (len(toks) <= 3 and nums >= 1)

def clean(lines):
    out = []
    for l in lines:
        s = l.strip()
        if not s or s == FOOTER or re.fullmatch(r"\d{1,3}", s):  # footer + page numbers
            continue
        out.append(s)
    return out

def drop_label_runs(lines, min_run=3, short=6):
    """In pdftotext flow mode, tables become runs of short label lines. Drop runs of >= min_run
    consecutive short lines (bullets '•' and sub-bullets 'o' are kept)."""
    keep, run = [], []
    def end_run():
        if len(run) < min_run: keep.extend(run)
        run.clear()
    for l in lines:
        if len(l.split()) < short and l not in ("•", "o") and not l.endswith((".", ":")):
            run.append(l)
        else:
            end_run(); keep.append(l)
    end_run()
    return keep

def page_title(lines):
    for l in lines:
        if l.strip():
            return l.strip()
    return ""

def region_for(title, pdf_page):
    t = title.upper()
    if "BUDGET INTRODUCTION" in t: return "intro"
    if "SOURCE OF FUNDS" in t: return "source_of_funds"
    if t.startswith("C. CAPITAL") : return "capital"
    # fund letters G-N; "I. CITY BUDGETS UNDER THE CONTROL…" is Part I, not fund I (Summary p.25)
    if re.match(r"^[G-N]\. (?!CITY BUDGETS)", t) or "SPECIAL REVENUE" in t: return "special_fund"
    if "CLARIFICATION OF INTENT" in t: return "clarification_of_intent"
    if SUMMARY_TABLE_PAGES[0] <= pdf_page <= SUMMARY_TABLE_PAGES[1]: return "summary_tables"
    return "department"

_RANGES = None
ISSUED_IDS: set = set()

def slug_for_page(pdf_page):
    """departments.yaml slug whose Summary page range contains this page (None outside any)."""
    global _RANGES
    if _RANGES is None:
        _RANGES = summary_page_ranges()
    printed = pdf_page - PAGE_OFFSET
    return next((s for s, (a, b) in _RANGES.items() if a <= printed <= b), None)

SUBHEAD = re.compile(r"^[A-Z][\w&’'/,()-]*(?:\s+(?:[A-Z][\w&’'/,()-]*|of|and|the|for|to|in|on|&|-|–)){0,8}$")

def is_subheading(line, prev):
    """Prose sub-headings inside a department's narrative (DCD, DPW-ISD, Administration):
    a short Title-Case line with no closing punctuation, after a finished sentence."""
    words = line.split()
    if words[-1].lower() in ("and", "of", "the", "for", "to", "in", "on", "&", "-", "–"):
        return False     # heading wraps to the next line ('Office of the Commissioner and Economic')
    if line.count(",") >= 2:
        return False     # a wrapped list ('City Attorney, DNS, DPW, and Water')
    if words[0] in ("Total", "Number", "Percent", "Percentage", "Average"):
        return False     # KPI labels leaking from a table, not prose headings
    return (2 <= len(words) <= 9 and not line.endswith((".", ":", ",", ";")) and SUBHEAD.match(line)
            and not line.isupper() and (prev is None or prev.rstrip().endswith((".", ":", "”", ")"))))

def flush(buf, meta, chunks, max_words=320):
    if sum(len(x.split()) for x in buf) > max_words * 1.5:
        return split_paragraph_chunks(buf, meta, chunks, max_words)
    text = " ".join(x for x in buf if x != "o").strip()
    text = re.sub(r"\s+", " ", text)
    if len(text.split()) < 8:
        return
    meta["ordinal"] += 1
    base = f'{meta["region"]}:{meta["dept"] or "-"}:{meta["section_type"]}'
    n = meta["ordinal"]
    while f"{base}:{n}" in ISSUED_IDS:      # a region can recur (appendix / clarification / appendix,
        n += 1                              # Summary p.211-214), restarting the ordinal: keep ids unique
    ISSUED_IDS.add(f"{base}:{n}")
    c = Chunk(
        id=f"{base}:{n}",
        doc="summary", budget_version=BUDGET_VERSION,
        pdf_page=meta["start_page"], printed_page=meta["start_page"] - PAGE_OFFSET,
        page_end=meta["cur_page"] - PAGE_OFFSET,
        region=meta["region"], dept=meta["dept"], section_type=meta["section_type"],
        heading=meta["heading"], ordinal=meta["ordinal"], text=text,
    )
    where = by_slug()[c.dept]["name"] if c.dept else c.region.replace("_", " ").title()
    c.context_header = (f"City of Milwaukee 2027 Proposed Budget (Mayor's proposal, not adopted) — "
                        f"{where} — {c.section_type.replace('_',' ')} — Summary p.{c.printed_page}")
    c.numbers = re.findall(r"\$?\d[\d,]*(?:\.\d+)?(?:\s(?:million|billion))?%?", text)
    c.parent_section_id = f'{c.region}:{c.dept or "-"}:{c.section_type}'
    chunks.append(c)

def split_paragraph_chunks(buf, meta, chunks, max_words=320):
    """Pack paragraph text into ~320-word chunks on sentence boundaries."""
    text = re.sub(r"\s+", " ", " ".join(x for x in buf if x != "o"))
    sents = re.split(r"(?<=[\.\?\!])\s+(?=[A-Z•])", text)
    cur = []
    for s in sents:
        if sum(len(x.split()) for x in cur) + len(s.split()) > max_words and cur:
            _emit(cur, meta, chunks); cur = []
        cur.append(s)
    if cur: _emit(cur, meta, chunks)

def _emit(buf, meta, chunks):
    return flush(buf, meta, chunks, max_words=10**9)

def run(pdf=SUMMARY_PDF, out=None):
    ISSUED_IDS.clear()
    pages = pages_text(pdf)
    chunks, meta = [], {"ordinal": 0}
    buf, mode = [], None      # mode: 'narrative' | 'bullets' | 'table'
    for pi, raw in enumerate(pages, start=1):
        if pi <= FRONT_MATTER_LAST_PDF_PAGE: continue
        lines = clean(raw.split("\n"))
        if not lines: continue
        title = page_title(lines)
        lines = [lines[0]] + drop_label_runs(lines[1:])
        region = region_for(title, pi)
        dept = slug_for_page(pi) if region in ("department", "special_fund", "capital") else None
        if region == "department" and dept is None:
            # divider pages before the first department (Summary p.25-28); back matter after p.210
            region = "appendix" if pi - PAGE_OFFSET > 210 else "section_intro"
        if region in ("source_of_funds",):
            dept = "gcp-source-of-funds"
        if region == "summary_tables":
            lines = [lines[0]] + [l for l in lines[1:] if len(l.split()) >= 10 and not is_tabular(l)]
        if (region, dept) != (meta.get("region"), meta.get("dept")):
            if buf and mode != "table": (flush if mode == "bullets" else split_paragraph_chunks)(buf, meta, chunks)
            buf, mode = [], "narrative"
            meta.update(region=region, dept=dept, section_type="narrative" if region != "department" else "other",
                        heading=title, start_page=pi, ordinal=0)
        meta["cur_page"] = pi
        prev = None
        for l in lines[1:]:          # lines[0] is the page's running title
            head = next((h for h in {**NARRATIVE_HEADS, **TABLE_HEADS} if l.startswith(h)), None)
            if head:
                if buf and mode != "table": (flush if mode == "bullets" else split_paragraph_chunks)(buf, meta, chunks)
                buf = []
                if head in TABLE_HEADS:
                    mode = "table"; meta["section_type"] = TABLE_HEADS[head]
                else:
                    st = NARRATIVE_HEADS[head]
                    mode = "bullets" if st in ("service_highlight", "capital_project") else "narrative"
                    meta.update(section_type=st, heading=head, start_page=pi)
                    rest = l[len(head):].strip()
                    if rest: buf.append(rest)
                prev = l
                continue
            if mode == "table" or is_tabular(l):
                continue
            if region == "department" and mode in ("narrative", "bullets") and is_subheading(l, prev):
                if buf: (flush if mode == "bullets" else split_paragraph_chunks)(buf, meta, chunks)
                buf = []
                meta.update(heading=l, start_page=pi)
                prev = l
                continue
            if mode == "bullets" and l == "•":
                if buf: flush(buf, meta, chunks)
                buf = []; meta["start_page"] = pi
                prev = l
                continue
            buf.append(l)
            prev = l
    if buf and mode != "table": split_paragraph_chunks(buf, meta, chunks)
    chunks += table_cards() + chart_cards()
    attach_linked_tables(chunks)
    out = out or PROCESSED / "chunks.jsonl"
    with open(out, "w") as f:
        for c in chunks:
            f.write(json.dumps(asdict(c)) + "\n")
    write_crosswalk()
    return chunks

# --------------------------------------------------------------------------------------------
# Table cards: one short routing chunk per extracted table, naming the tool (docs/06 §3, docs/03 §3)
# --------------------------------------------------------------------------------------------
DEPT_TABLES = {
    "dept_summary": ("budget summary table: 2025 actual, 2026 adopted, 2027 requested and proposed "
                     "spending by category, FTEs, positions and revenues", "get_department('{slug}')"),
    "services": ("services table: operating, capital and grant budget and FTEs for each service",
                 "get_department('{slug}')"),
    "kpis": ("key performance measures table, with the year labels as printed", "get_kpis('{slug}')"),
    "position_changes": ("position changes table: positions and FTEs added or eliminated, with the reason for each",
                         "get_positions({{dept: '{slug}'}})"),
    "capital_projects": ("capital projects and their amounts", "get_capital_projects({{dept: '{slug}'}})"),
}
SECTION_TABLES = [
    ("section_totals", 7, 7, "2027 Proposed Budget and Tax Rate Compared to Prior Year: every budget section A–N, "
     "budget, non-levy and levy funding, 2026 vs 2027, and the tax rate", "get_budget_overview({scope})"),
    ("section_comparisons", 8, 10, "Comparisons by Budget Section: 2026 adopted, 2027 requested and 2027 proposed "
     "appropriations and funding sources for each section", "get_budget_overview({scope})"),
    ("positions_summary", 13, 13, "Change in Positions by department: 2026 adopted, 2027 requested and proposed",
     "get_positions({})"),
    ("fte_summary", 14, 16, "Estimated full-time equivalents by department: O&M funded, non-O&M funded and all funds",
     "get_positions({})"),
    ("revenues", 160, 162, "Source of Funds for General City Purposes: every revenue line by category in four "
     "stages, reserve withdrawals and the property tax levy", "get_revenue_breakdown({level})"),
]

def _card(id_, dept, first, last, text, section_type, linked):
    name = by_slug()[dept]["name"] if dept else "City of Milwaukee"
    c = Chunk(id=id_, doc="summary", budget_version=BUDGET_VERSION, pdf_page=first + PAGE_OFFSET,
              printed_page=first, page_end=last, region="department" if dept else "summary_tables",
              dept=dept, section_type=section_type, heading=section_type.replace("_", " "), ordinal=1,
              text=text, kind="table_card", linked_tables=linked)
    c.context_header = (f"City of Milwaukee 2027 Proposed Budget (Mayor's proposal, not adopted) — {name} — "
                        f"table card — Summary p.{first}")
    c.parent_section_id = f'table:{dept or "-"}:{section_type}'
    return c

def table_cards():
    cards = []
    for table, (desc, tool) in DEPT_TABLES.items():
        df = pd.read_parquet(PROCESSED / f"{table}.parquet")
        for slug, g in df.groupby("dept"):
            pages = sorted(int(c["printed_page"]) for c in g["cite"])
            name = by_slug()[slug]["name"]
            text = (f"{name} {desc}. The numbers are in the structured data, not this text: use "
                    f"{tool.format(slug=slug)}. Summary p.{pages[0]}" + (f"–{pages[-1]}" if pages[-1] != pages[0] else "") + ".")
            cards.append(_card(f"table:{slug}:{table}", slug, pages[0], pages[-1], text, f"{table}_table",
                               [f"{table}:{slug}"]))
    for table, first, last, desc, tool in SECTION_TABLES:
        text = (f"{desc}. The numbers are in the structured data, not this text: use {tool}. "
                f"Summary p.{first}" + (f"–{last}" if last != first else "") + ".")
        cards.append(_card(f"table:-:{table}", None, first, last, text, f"{table}_table", [table]))
    li = pd.read_parquet(PROCESSED / "line_items.parquet")
    prefix_slug = {p: d["slug"] for d in departments() for p in d.get("detailed") or []}
    for slug in sorted({prefix_slug[s] for s in li.section.unique() if s in prefix_slug}):
        name = by_slug()[slug]["name"]
        cards.append(_card(f"table:{slug}:line_items", slug, by_slug()[slug].get("summary_page") or 1,
                           by_slug()[slug].get("summary_page") or 1,
                           f"{name} line-item budget (Detailed budget, BMD-2 forms): every account, position "
                           f"title and pay range in four stages. Use search_budget_lines({{dept: '{slug}'}}). "
                           f"Detailed {', '.join(by_slug()[slug]['detailed'])}.x.",
                           "line_items_table", [f"line_items:{slug}"]))
    return cards

# --------------------------------------------------------------------------------------------
# Chart cards: charts whose data is not in the text layer (docs/02 §6). Never invent the series.
# --------------------------------------------------------------------------------------------
CHARTS = [
    ("requested_budget_gaps", 1, "printed title",
     "Chart: Requested Budget Gaps (in Millions), about 2005–2027. The underlying data is not in the "
     "document text; only figures stated in the prose may be quoted (e.g. pre-COVID gaps of $20–$60 million)."),
    ("ssr_vs_tax_levy", 2, "printed title",
     "Chart: State Shared Revenue & City Tax Levy (in Millions). The underlying data is not in the document "
     "text; only figures stated in the prose may be quoted."),
    ("ssr_actual_vs_inflation", 2, "described in prose ('the lower line on the above chart')",
     "Chart: State Shared Revenue actually received vs. adjusted for inflation since 1995. The underlying data "
     "is not in the document text; only figures stated in the prose may be quoted."),
    ("revenue_mix_1995_2027", 3, "described in prose ('pie charts on the following page'; also p.157)",
     "Chart: revenue mix for general city purposes, 1995 vs 2027 (pie charts). The underlying data is not in "
     "the document text; the prose states intergovernmental revenue fell from 63.7% to 38.1% of GCP revenue."),
    ("escalating_pension_costs", 4, "printed title",
     "Chart: Escalating Pension Costs (in Millions): city pension payment, WRS costs, payment to non-city "
     "CMERS agencies. The underlying data is not in the document text; only figures stated in the prose may be quoted."),
]

def chart_cards():
    out = []
    for key, page, basis, text in CHARTS:
        c = Chunk(id=f"chart:-:{key}", doc="summary", budget_version=BUDGET_VERSION,
                  pdf_page=page + PAGE_OFFSET, printed_page=page, page_end=page, region="intro", dept=None,
                  section_type="chart", heading=key, ordinal=1, text=f"{text} (Summary p.{page}; {basis}.)",
                  kind="chart_card")
        c.context_header = ("City of Milwaukee 2027 Proposed Budget (Mayor's proposal, not adopted) — "
                            f"Budget Introduction — chart card — Summary p.{page}")
        c.parent_section_id = "intro:-:chart"
        out.append(c)
    return out

def attach_linked_tables(chunks):
    """Every narrative chunk of a department links to that department's table cards."""
    by_dept = {}
    for c in chunks:
        if c.kind == "table_card" and c.dept:
            by_dept.setdefault(c.dept, []).extend(c.linked_tables)
    for c in chunks:
        if c.kind == "narrative" and c.dept:
            c.linked_tables = sorted(set(by_dept.get(c.dept, [])))

def write_crosswalk():
    """dept_crosswalk (docs/06 §5): Summary page range, Detailed prefixes, org and fund codes."""
    li = pd.read_parquet(PROCESSED / "line_items.parquet")
    ranges = summary_page_ranges()
    out = []
    for d in departments():
        rows = li[li.section.isin(d.get("detailed") or [])]
        rng = ranges.get(d["slug"])
        out.append({"dept": d["slug"],
                    "summary_pdf_pages": [rng[0] + PAGE_OFFSET, rng[1] + PAGE_OFFSET] if rng else None,
                    "summary_printed_pages": list(rng) if rng else None,
                    "detailed_page_prefix": d.get("detailed") or [],
                    "org_codes": sorted(rows.org.dropna().unique().tolist()),
                    "fund_codes": sorted(rows.fund.dropna().unique().tolist())})
    (PROCESSED / "dept_crosswalk.json").write_text(json.dumps(out, indent=2))
    return out

def main():
    return {"chunks": len(run())}

if __name__ == "__main__":
    cs = run(*(sys.argv[1:3]))
    print(f"{len(cs)} chunks")
