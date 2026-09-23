"""Golden checks for the narrative chunker (docs/06 §10)."""
import collections
import json

import pytest

from common.config import PROCESSED
from extract.narrative_chunks import run


@pytest.fixture(scope="module")
def chunks():
    run()
    return [json.loads(line) for line in open(PROCESSED / "chunks.jsonl")]


def test_police_highlights_and_capital(chunks):
    pol = collections.Counter(c["section_type"] for c in chunks if c["dept"] == "police" and c["kind"] == "narrative")
    assert pol["service_highlight"] == 18 and pol["capital_project"] == 3


def test_every_department_region_chunk_has_a_slug(chunks):
    assert all(c["dept"] for c in chunks if c["kind"] == "narrative" and c["region"] in ("department", "special_fund", "capital"))


def test_chunk_sizes_within_docs06_bounds(chunks):
    words = [len(c["text"].split()) for c in chunks if c["kind"] == "narrative"]
    assert min(words) >= 8 and max(words) <= 480     # 320-word packing, ×1.5 hard cap


def test_parent_section_and_links(chunks):
    narrative = [c for c in chunks if c["kind"] == "narrative"]
    assert all(c["parent_section_id"] for c in narrative)
    police = next(c for c in narrative if c["dept"] == "police")
    assert "dept_summary:police" in police["linked_tables"] and "position_changes:police" in police["linked_tables"]


def test_table_and_chart_cards(chunks):
    kinds = collections.Counter(c["kind"] for c in chunks)
    assert kinds["chart_card"] == 5
    ids = {c["id"] for c in chunks}
    assert {"table:police:dept_summary", "table:-:section_totals", "table:-:revenues"} <= ids
    card = next(c for c in chunks if c["id"] == "table:police:dept_summary")
    assert "get_department('police')" in card["text"] and "$" not in card["text"]   # cards route, never quote numbers


def test_dpw_divisions_have_distinct_slugs(chunks):
    slugs = {c["dept"] for c in chunks if c["dept"] and c["dept"].startswith("dpw")}
    assert {"dpw-administrative-services", "dpw-infrastructure", "dpw-operations"} <= slugs


def test_crosswalk(chunks):
    cw = {d["dept"]: d for d in json.loads((PROCESSED / "dept_crosswalk.json").read_text())}
    assert cw["administration"]["org_codes"][0] == "1510" or "1510" in cw["administration"]["org_codes"]
    assert cw["police"]["detailed_page_prefix"] == ["300"] and cw["police"]["summary_printed_pages"] == [116, 120]
