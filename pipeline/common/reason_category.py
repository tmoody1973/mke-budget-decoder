"""Rule-based category for a position change's printed reason (docs/05). The raw reason is
always shown alongside; the category only groups. Order matters: first match wins.

Conservative on purpose: 'vacant_elimination' needs the word 'vacant' — 'Position eliminated'
alone does not say whether anyone held the job (docs/05: vacant ≠ layoff), so it is 'other'."""
import re

RULES = [
    ("contract_to_city", r"contract (employee|staff)|contract to city|convert\w* .*(contract|temporary)"),
    ("arpa_sunset", r"\barpa\b"),
    ("grant_change", r"\bgrant\b|onto levy|off of levy|onto capital|movement onto capital|reimbursable"),
    ("vacant_elimination", r"\bvacan"),
    ("reclassification", r"reclass|classification|retitle|title|name change|pay range|promotion"),
    ("transfer", r"\bmov(ed|ing|e)\b|transfer"),
    ("new_funded", r"\bnew\b|\badd(ed|ition|itional)?\b|\bfunded\b|\bcreated\b|full time|expan"),
]
_COMPILED = [(cat, re.compile(p, re.I)) for cat, p in RULES]


def reason_category(reason: str | None) -> str:
    if not reason:
        return "other"
    return next((cat for cat, rx in _COMPILED if rx.search(reason)), "other")
