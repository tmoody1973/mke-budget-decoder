"""
Prototype narrative chunker for the 2027 Proposed Plan & Executive Budget Summary.

Structure-aware: splits by department and section heading, splits bullet lists into one chunk per
bullet, drops table regions (those belong to the structured lane), and attaches citation metadata
plus a contextual header to every chunk. Output: data/processed/chunks.jsonl (no embeddings yet).

Usage: python -m extract.narrative_chunks <summary.pdf> <out.jsonl>
Requires poppler's pdftotext on PATH.
"""
import json, re, subprocess, sys
from dataclasses import dataclass, asdict, field

PAGE_OFFSET = 10          # printed page N == PDF page N + 10
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
CURRENT_PAGE = [0]

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
    dept: str | None
    section_type: str
    heading: str
    ordinal: int
    text: str
    context_header: str = ""
    numbers: list = field(default_factory=list)   # numeric tokens present (for grounding: narrative-sourced)

def pages_text(pdf):
    out = subprocess.run(["pdftotext", pdf, "-"], capture_output=True, text=True).stdout
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

def region_for(title):
    t = title.upper()
    if "BUDGET INTRODUCTION" in t: return "intro"
    if "SOURCE OF FUNDS" in t: return "source_of_funds"
    if t.startswith("C. CAPITAL") : return "capital"
    if re.match(r"^[G-N]\. ", t) or "SPECIAL REVENUE" in t: return "special_fund"
    if "CLARIFICATION OF INTENT" in t: return "clarification_of_intent"
    if SUMMARY_TABLE_PAGES[0] <= CURRENT_PAGE[0] <= SUMMARY_TABLE_PAGES[1]: return "summary_tables"
    return "department"

def flush(buf, meta, chunks, max_words=320):
    if sum(len(x.split()) for x in buf) > max_words * 1.5:
        return split_paragraph_chunks(buf, meta, chunks, max_words)
    text = " ".join(x for x in buf if x != "o").strip()
    text = re.sub(r"\s+", " ", text)
    if len(text.split()) < 8:
        return
    meta["ordinal"] += 1
    c = Chunk(
        id=f'{meta["region"]}:{meta["dept"] or "-"}:{meta["section_type"]}:{meta["ordinal"]}',
        doc="summary", budget_version="2027-proposed-3rd-run-2026-09-14",
        pdf_page=meta["start_page"], printed_page=meta["start_page"] - PAGE_OFFSET,
        page_end=meta["cur_page"] - PAGE_OFFSET,
        region=meta["region"], dept=meta["dept"], section_type=meta["section_type"],
        heading=meta["heading"], ordinal=meta["ordinal"], text=text,
    )
    where = c.dept.title() if c.dept else c.region.replace("_", " ").title()
    c.context_header = (f"City of Milwaukee 2027 Proposed Budget (Mayor's proposal, not adopted) — "
                        f"{where} — {c.section_type.replace('_',' ')} — Summary p.{c.printed_page}")
    c.numbers = re.findall(r"\$?\d[\d,]*(?:\.\d+)?(?:\s(?:million|billion))?%?", text)
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

def run(pdf, out):
    pages = pages_text(pdf)
    chunks, meta = [], {"ordinal": 0}
    buf, mode = [], None      # mode: 'narrative' | 'bullets' | 'table'
    for pi, raw in enumerate(pages, start=1):
        if pi <= FRONT_MATTER_LAST_PDF_PAGE: continue
        CURRENT_PAGE[0] = pi
        lines = clean(raw.split("\n"))
        if not lines: continue
        title = page_title(lines)
        lines = [lines[0]] + drop_label_runs(lines[1:])
        region = region_for(title)
        dept = title if region == "department" else None
        if region == "summary_tables":
            dept = None
            lines = [lines[0]] + [l for l in lines[1:] if len(l.split()) >= 10 and not is_tabular(l)]
        if (region, dept) != (meta.get("region"), meta.get("dept")):
            if buf and mode != "table": (flush if mode == "bullets" else split_paragraph_chunks)(buf, meta, chunks)
            buf, mode = [], "narrative"
            meta.update(region=region, dept=dept, section_type="narrative" if region != "department" else "other",
                        heading=title, start_page=pi, ordinal=0)
        meta["cur_page"] = pi
        for l in lines[1:] if l_is_title(lines[0], title) else lines:
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
                continue
            if mode == "table":
                # a table ends when real prose resumes (long non-numeric line) — e.g. services prose
                if len(l.split()) >= 12 and not is_tabular(l) and meta["section_type"] == "budget_summary_table":
                    pass
                continue
            if is_tabular(l):
                continue
            if mode == "bullets" and l == "•":
                if buf: flush(buf, meta, chunks)
                buf = []; meta["start_page"] = pi
                continue
            buf.append(l)
    if buf and mode != "table": split_paragraph_chunks(buf, meta, chunks)
    with open(out, "w") as f:
        for c in chunks:
            f.write(json.dumps(asdict(c)) + "\n")
    return chunks

def l_is_title(first, title):
    return first == title

if __name__ == "__main__":
    cs = run(sys.argv[1], sys.argv[2])
    print(f"{len(cs)} chunks")
