"""The double-counting guard (ISC-58, Socratic stop 1).

A BCU summary sheet restates its decision units. It is used as a CHECK and never summed.
If the parser puts a row on the wrong side of that line, these sums stop matching.
"""
import re
from collections import defaultdict

import pytest

from common.inconsistencies import documented
from extract.detailed_lines import is_unit_total, parse_detailed, section_of

MONEY = ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027")
CATEGORY_TOTALS = {
    "net_salaries": r"NET SALARIES & WAGES TOTAL",
    "fringe": r"ESTIMATED EMPLOYEE FRINGE BENEFITS",
    "operating": r"OPERATING EXPENDITURES TOTAL",
    "equipment": r"EQUIPMENT PURCHASES TOTAL",
    "special": r"^SPECIAL FUNDS( TOTAL)?$",
}


@pytest.fixture(scope="module")
def sections():
    rows, _ = parse_detailed()
    by = defaultdict(list)
    for r in rows:
        by[section_of(r)].append(r)
    return {s: rs for s, rs in by.items() if any(r.block == "bcu_summary" for r in rs)}


def _sum(rows, col):
    return sum(r.values.get(col) or 0 for r in rows)


def test_expected_sections_have_summary_blocks(sections):
    assert set(sections) == {"110", "140", "220", "240", "250", "260", "340", "350", "510", "540", "570"}


@pytest.mark.parametrize("kind,pattern", CATEGORY_TOTALS.items())
@pytest.mark.parametrize("col", MONEY)
def test_summary_category_equals_sum_of_decision_units(sections, kind, pattern, col):
    for sec, rs in sections.items():
        pick = [r for r in rs if r.row_type == "rollup" and re.search(pattern, r.upper)]
        summary = _sum([r for r in pick if r.block == "bcu_summary"], col)
        units = _sum([r for r in pick if r.block == "decision_unit"], col)
        assert summary == units, f"section {sec} {kind} {col}: summary {summary:,} vs units {units:,}"


@pytest.mark.parametrize("col", MONEY)
def test_bcu_total_equals_unit_totals(sections, col):
    """BCU total = Σ decision-unit totals, except exact mismatches verified on the page and
    recorded in pipeline/data/source_inconsistencies.yaml (Transportation 510)."""
    for sec, rs in sections.items():
        printed = _sum([r for r in rs if r.block == "bcu_summary" and is_unit_total(r)], col)
        extracted = _sum([r for r in rs if r.block == "decision_unit" and is_unit_total(r)], col)
        if printed != extracted:
            assert documented("bcu_total_equals_unit_totals", sec, col, printed, extracted), (
                f"section {sec} {col}: BCU {printed:,} vs sum of units {extracted:,}")


def test_every_decision_unit_section_has_a_unit_total(sections):
    for sec, rs in sections.items():
        assert any(is_unit_total(r) for r in rs if r.block == "decision_unit"), sec
