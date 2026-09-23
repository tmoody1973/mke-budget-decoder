"""Stored Jev judgments for curated statements (review/claim_check.py). Runs offline: CI reads the
committed results and never calls the API. Numbers are checked by code elsewhere
(test_curated_data.py); these results judge only whether the wording matches the page."""
import json

import pytest

from common.config import PIPELINE_DATA
from review.claim_check import items, key

RESULTS = json.loads((PIPELINE_DATA / "claim_checks.json").read_text())
ITEMS = items()


@pytest.mark.parametrize("item", ITEMS, ids=[i["id"] for i in ITEMS])
def test_statement_has_a_current_check(item):
    """Editing a statement (or its page passage) without re-running review.claim_check fails here."""
    stored = RESULTS.get(item["id"])
    assert stored, f"{item['id']}: never checked — run `uv run python -m review.claim_check`"
    assert stored["key"] == key(item), f"{item['id']}: statement or passage changed since it was checked"


@pytest.mark.parametrize("item", ITEMS, ids=[i["id"] for i in ITEMS])
def test_no_statement_contradicts_its_page(item):
    stored = RESULTS[item["id"]]
    assert stored["verdict"] not in ("contradicted", "conflict", "no_passage"), (
        f"{item['id']}: {stored['verdict']} — read the passage and fix the statement")


def test_every_check_used_the_pinned_model():
    assert {r["model"] for r in RESULTS.values() if "model" in r} == {"jev-1.13.0"}
