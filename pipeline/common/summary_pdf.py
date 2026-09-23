"""Coordinate helpers for Summary-book tables (docs/02 §2: coordinates, not regex over text)."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import pdfplumber

from common.config import SUMMARY_PAGE_OFFSET, SUMMARY_PDF
from common.numbers import is_number_token


@lru_cache(maxsize=1)
def _pdf():
    return pdfplumber.open(SUMMARY_PDF)


def pdf_page_for(printed: int) -> int:
    return printed + SUMMARY_PAGE_OFFSET


@lru_cache(maxsize=256)
def words(pdf_page: int) -> tuple:
    page = _pdf().pages[pdf_page - 1]
    upright = page.filter(lambda o: o.get("object_type") != "char" or o.get("upright", True))
    normal = upright.extract_words(keep_blank_chars=False, use_text_flow=False)
    rotated = _words_from_chars([c for c in page.chars if not c.get("upright", True)])
    return tuple(sorted(normal + rotated, key=lambda w: (round(w["top"]), w["x0"])))


def _words_from_chars(chars: list[dict], gap: float = 1.0, line_tol: float = 2.0) -> list[dict]:
    """Some Summary tables (p.8–10, every department BUDGET SUMMARY) flag glyphs as non-upright, so pdfplumber won't join
    them into words. The glyphs still sit on horizontal lines with real space characters:
    join touching glyphs, split at spaces and gaps."""
    out: list[dict] = []
    cur: dict | None = None
    for c in sorted(chars, key=lambda c: (round(c["top"] / line_tol), c["x0"])):
        if cur and (abs(c["top"] - cur["top"]) > line_tol or c["x0"] - cur["x1"] > gap
                    or c["x0"] < cur["x1"] - 1 or c["text"] == " "):   # a jump back left = new word
            out.append(cur)
            cur = None
        if c["text"] == " ":
            continue
        if cur is None:
            cur = {"text": c["text"], "x0": c["x0"], "x1": c["x1"], "top": c["top"], "bottom": c["bottom"]}
        else:
            cur["text"] += c["text"]
            cur["x1"] = c["x1"]
    if cur:
        out.append(cur)
    return out


def page_count() -> int:
    return len(_pdf().pages)


def page_text(pdf_page: int) -> str:
    return _pdf().pages[pdf_page - 1].extract_text() or ""


def cite(pdf_page: int) -> dict:
    return {"doc": "summary", "pdf_page": pdf_page, "printed_page": str(pdf_page - SUMMARY_PAGE_OFFSET)}


@dataclass
class Line:
    top: float
    words: list[dict]

    @property
    def text(self) -> str:
        return " ".join(w["text"] for w in self.words)

    def label(self, max_x: float) -> str:
        return " ".join(w["text"] for w in self.words if w["x1"] <= max_x).strip()


def lines(pdf_page: int, top_min: float = 0, top_max: float = 10_000, tol: float = 3.0) -> list[Line]:
    """Words grouped into visual lines by `top` (within tol points), left to right."""
    out: list[Line] = []
    for w in sorted((w for w in words(pdf_page) if top_min <= w["top"] <= top_max), key=lambda w: w["top"]):
        if out and abs(w["top"] - out[-1].top) <= tol:
            out[-1].words.append(w)
        else:
            out.append(Line(w["top"], [w]))
    for ln in out:
        ln.words.sort(key=lambda w: w["x0"])
    return out


@dataclass(frozen=True)
class Column:
    key: str
    x0: float
    x1: float


def assign_numbers(line: Line, columns: list[Column], left: float = 30, right: float = 12) -> dict[str, str]:
    """Numeric tokens → the column whose header span (widened) they overlap, nearest by x1.
    Returns the raw printed text per column; callers parse. Unplaced numbers raise."""
    out: dict[str, str] = {}
    for w in line.words:
        if not is_number_token(w["text"].replace("$", "").strip("[]")):   # '[4,998,805]' (p.187)
            continue
        hits = [c for c in columns if w["x0"] <= c.x1 + right and w["x1"] >= c.x0 - left]
        if not hits:
            continue
        col = min(hits, key=lambda c: abs(w["x1"] - c.x1))
        if col.key in out:
            raise ValueError(f"two numbers under {col.key!r} on line {line.text!r}")
        out[col.key] = w["text"]
    return out


def find_word(pdf_page: int, text: str, top_min: float = 0, top_max: float = 10_000) -> Optional[dict]:
    return next((w for w in words(pdf_page) if w["text"] == text and top_min <= w["top"] <= top_max), None)


def searchable_text(pdf_page: int) -> str:
    """pdfplumber's text plus our rebuilt words: rotated-glyph tables print letter-spaced in
    extract_text (Summary p.116 'S a la rie s'). Normalised whitespace and apostrophes."""
    import re
    raw = page_text(pdf_page)
    rebuilt = " ".join(ln.text for ln in lines(pdf_page))
    return re.sub(r"\s+", " ", raw + " " + rebuilt).replace("’", "'")
