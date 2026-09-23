"""Summary department tables must add up to their own printed totals (P1.2 structural checks).
Verified document errors are excused only at their exact values (source_inconsistencies.yaml)."""
from collections import defaultdict
from decimal import Decimal

import pytest

from common.departments import departments
from common.inconsistencies import documented
from extract.dept_tables import extract_all

STAGES = ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027")
EXPENSE = {"salaries", "fringe", "operating", "equipment", "special_funds"}
NON_DEPT_ACCOUNTS = {"special-purpose-accounts", "fringe-benefit-offset", "gcp-source-of-funds"}
SECTION_A = {d["slug"] for d in departments() if d["section"] == "A" and d.get("summary_page")} - NON_DEPT_ACCOUNTS
NO_PRINTED_TOTAL = {("special-purpose-accounts", "149"), ("water-works", "202")}   # verified: no Totals row


@pytest.fixture(scope="module")
def tables():
    return extract_all()


def _d(v):
    return Decimal(str(v)) if v not in (None, "") else Decimal(0)


def _segments(rows):
    seg = []
    for r in rows:
        seg.append(r)
        if r["is_total"]:
            yield seg
            seg = []
    if seg:
        yield seg


def _check_segments(rows, cols, check, compare):
    by = defaultdict(list)
    for r in rows:
        by[r["dept"]].append(r)
    for dept, rs in by.items():
        for seg in _segments(rs):
            total = seg[-1]
            if not total["is_total"]:
                assert (dept, total["cite"]["printed_page"]) in NO_PRINTED_TOTAL, f"{dept}: table has no Totals row"
                continue
            for c in cols:
                extracted = sum(_d(r[c]) for r in seg[:-1])
                printed = _d(total[c])
                if extracted != printed:
                    assert compare(check, dept, c, total[c], extracted), (
                        f"{dept} {c}: rows {extracted} vs printed total {printed} (p.{total['cite']['printed_page']})")


def test_every_section_a_department_has_a_budget_summary(tables):
    have = {r["dept"] for r in tables["dept_summary"] if r["metric"] == "total_expenditures"}
    assert len(SECTION_A) == 24 and SECTION_A <= have


def test_dpw_divisions_are_distinct(tables):
    totals = {r["dept"]: r["proposed_2027"] for r in tables["dept_summary"] if r["metric"] == "total_expenditures"}
    dpw = [totals[s] for s in ("dpw-administrative-services", "dpw-infrastructure", "dpw-operations")]
    assert len(set(dpw)) == 3


@pytest.mark.parametrize("stage", STAGES)
def test_budget_summary_categories_sum_to_total(tables, stage):
    by = defaultdict(dict)
    for r in tables["dept_summary"]:
        if r["dept"] in SECTION_A:
            by[r["dept"]][r["metric"]] = r
    for dept, m in by.items():
        if "total_expenditures" not in m:
            continue
        s = sum(_d(m[k][stage]) for k in EXPENSE if k in m)
        assert s == _d(m["total_expenditures"][stage]), f"{dept} {stage}"


def test_budget_summary_change_column_is_proposed_minus_adopted(tables):
    for r in tables["dept_summary"]:
        if r["dept"] in SECTION_A and r.get("change_vs_adopted") is not None and r["proposed_2027"] is not None:
            assert _d(r["proposed_2027"]) - _d(r["adopted_2026"]) == _d(r["change_vs_adopted"]), (r["dept"], r["metric"])


def test_services_rows_sum_to_total(tables):
    _check_segments(tables["services"], ("operating", "capital", "grant", "ftes"), "services_rows_equal_total",
                    lambda chk, d, c, p, e: documented(chk, d, c, int(_d(p)) if c != "ftes" else p,
                                                       int(e) if c != "ftes" else str(e)))


def test_position_changes_rows_sum_to_total(tables):
    _check_segments(tables["position_changes"], ("positions", "om_ftes", "non_om_ftes"),
                    "position_changes_rows_equal_total",
                    lambda chk, d, c, p, e: documented(chk, d, c, p, str(e)))


def test_services_dash_is_null(tables):
    police = [r for r in tables["services"] if r["dept"] == "police" and r["description"].startswith("Provide leadership")]
    assert police and police[0]["capital"] is None and police[0]["grant"] is None


def test_kpi_labels_as_printed(tables):
    police = [r for r in tables["kpis"] if r["dept"] == "police"]
    assert police[0]["col_labels"] == ["2024 Actual", "2025 Projected", "2026 Planned"]


def test_capital_amounts_parsed(tables):
    by = {(r["dept"], r["name"]): r for r in tables["capital_projects"]}
    assert by[("police", "Police Vehicles")]["amount"] == 2_000_000
    assert by[("police", "Police Facilities Maintenance Program")]["amount"] == 2_115_000


def test_position_reasons_unwrapped(tables):
    admin = [r for r in tables["position_changes"] if r["dept"] == "administration"]
    assert admin[1]["reason"] == "Moved from ITMD to the Office of the Commissioner and changed titles"
