"""Number parsing shared by every extractor. Blank → None (never 0); parens → negative."""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Optional

_NUMBER_RE = re.compile(r"^(\(-?\$?[\d,]+(\.\d+)?\)|-?\$?[\d,]+(\.\d+)?)\*?$")
_NUM_FRAG_RE = re.compile(r"^[\d,().-]+$")


def is_number_token(text: str) -> bool:
    return bool(_NUMBER_RE.match(text.strip())) and any(c.isdigit() for c in text)


def parse_decimal(text: str) -> Optional[Decimal]:
    """'1,234' → 1234 · '(150,644)' → -150644 · '112.36' → 112.36 · '' / '-' → None."""
    s = text.strip().replace(",", "").replace("$", "").replace("*", "").replace(" ", "")
    if s in ("", "-", "—"):
        return None
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    if s.startswith("-"):
        neg, s = True, s[1:]
    if not re.fullmatch(r"\d+(\.\d+)?", s):
        return None
    v = Decimal(s)
    return -v if neg else v


def parse_dollars(text: str) -> Optional[int]:
    """Whole-dollar amount. Raises on cents: the books print whole dollars, so cents mean a misread."""
    v = parse_decimal(text)
    if v is None:
        return None
    if v != v.to_integral_value():
        raise ValueError(f"non-integer dollar amount {text!r}")
    return int(v)


def merge_split_numbers(words: list[dict], max_gap: float = 1.5) -> list[dict]:
    """Rejoin numbers pdfplumber splits mid-value ('7' + '5,536,864'), ported from
    mke-budget-commons. Gap < 1.5pt is far below the ~7pt code gap and ~46pt column gap."""
    out: list[dict] = []
    for w in sorted(words, key=lambda w: w["x0"]):
        if (out and _NUM_FRAG_RE.match(w["text"]) and _NUM_FRAG_RE.match(out[-1]["text"])
                and w["x0"] - out[-1]["x1"] < max_gap):
            prev = out[-1]
            out[-1] = {**prev, "text": prev["text"] + w["text"], "x1": w["x1"]}
        else:
            out.append(w)
    return out
