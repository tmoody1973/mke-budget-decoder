"""Documented source-document arithmetic errors (pipeline/data/source_inconsistencies.yaml)."""
from functools import lru_cache

import yaml

from common.config import PIPELINE_DATA


@lru_cache(maxsize=1)
def _entries() -> tuple:
    return tuple(yaml.safe_load((PIPELINE_DATA / "source_inconsistencies.yaml").read_text()) or ())


def documented(check: str, section: str, column: str, printed: int, extracted: int) -> bool:
    """True only if this exact mismatch — same check, place and both numbers — was verified."""
    return any(e["check"] == check and e["section"] == section and e["column"] == column
               and e["printed"] == printed and e["extracted"] == extracted for e in _entries())
