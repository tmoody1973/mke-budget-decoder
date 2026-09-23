"""departments.yaml loader + lookups shared by every extractor."""
from functools import lru_cache

import yaml

from common.config import PIPELINE_DATA


@lru_cache(maxsize=1)
def departments() -> tuple[dict, ...]:
    return tuple(yaml.safe_load((PIPELINE_DATA / "departments.yaml").read_text()))


def by_detailed_prefix() -> dict[str, str]:
    return {p: d["slug"] for d in departments() for p in d.get("detailed") or []}


def by_slug() -> dict[str, dict]:
    return {d["slug"]: d for d in departments()}


def summary_page_ranges(last_printed_page: int = 214) -> dict[str, tuple[int, int]]:
    """slug → (first, last) printed Summary page: title page up to the next title page."""
    starts = sorted((d["summary_page"], d["slug"]) for d in departments() if d.get("summary_page"))
    ends = [s for s, _ in starts[1:]] + [last_printed_page + 1]
    return {slug: (start, end - 1) for (start, slug), end in zip(starts, ends)}
