"""Summary department tables must add up to their own printed totals (P1.2 structural checks).
Verified document errors are excused only at their exact values (source_inconsistencies.yaml)."""
from collections import defaultdict
from decimal import Decimal

import pandas as pd
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
    if v is None or v == "" or (isinstance(v, float) and v != v):     # blank, or NaN from a DataFrame
        return Decimal(0)
    return Decimal(str(v))


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


KINDS = {"project", "list_heading", "funding_source", "context"}


def test_capital_rows_are_classified(tables):
    rows = tables["capital_projects"]
    assert {r["kind"] for r in rows} <= KINDS
    # every project has a name; a heading's amount is the sum of its items, so it is not a project
    assert all(r["name"] for r in rows if r["kind"] == "project"), [r["description"][:60] for r in rows if r["kind"] == "project" and not r["name"]]
    heading = next(r for r in rows if r["description"].startswith("The 2027 Capital Budget includes $4,115,000"))
    assert heading["kind"] == "list_heading"
    source = next(r for r in rows if r["description"].startswith("$19.25 million in levy-supported"))
    assert source["kind"] == "funding_source"


def test_capital_names_from_the_sentence(tables):
    names = {(r["name"] or "").lower(): r for r in tables["capital_projects"]}
    assert names["general it upgrades"]["amount"] == 150_000                 # Summary p.38 list item
    assert names["water main improvements"]["amount"] == 30_800_000         # p.201
    assert names["compliance loan program (clp)"]["amount"] == 962_189      # p.115, name before a dash
    lead = next(r for r in tables["capital_projects"] if r["description"].startswith("The cost to replace lead service lines"))
    assert lead["kind"] == "context"                                         # p.202: a per-line cost, not a project


def test_capital_sentence_not_split_at_street_abbreviation(tables):
    flood = next(r for r in tables["capital_projects"] if r["name"] == "Flood Mitigation")
    assert "Capitol Drive" in flood["description"] and flood["amount"] == 1_000_000   # p.205-206


def test_capital_printed_typo_is_kept_not_corrected(tables):
    port = next(r for r in tables["capital_projects"] if r["name"] == "Terminal & Facility Maintenance")
    assert port["amount_text"] == "$1,300,000 million" and port["amount"] is None   # Summary p.123 as printed


def test_position_reasons_unwrapped(tables):
    admin = [r for r in tables["position_changes"] if r["dept"] == "administration"]
    assert admin[1]["reason"] == "Moved from ITMD to the Office of the Commissioner and changed titles"


def _is_subtotal(label: str) -> bool:
    l = label.strip().lower()
    return l.startswith("subtotal") or (l.endswith("total") and not l.startswith("total"))   # 'O&M Total'


@pytest.mark.parametrize("stage", STAGES)
def test_every_budget_summary_block_sums_to_its_total(tables, stage):
    """Each block of every four-stage table (departments AND funds, expenditures and revenues
    separately) adds up to its printed Total. This is the check that would have caught the
    blank wrapped rows on Summary p.163 (review finding B1/B2, 2026-09-23). A Total followed by
    more rows in the same group carries forward ('Total Operating' + 'Capital Projects' =
    'Total Budget', Summary p.190)."""
    ds = pd.DataFrame(tables["dept_summary"])
    ds["page"] = ds.cite.map(lambda c: c["pdf_page"])
    checked = 0
    for (dept, page), g in ds.groupby(["dept", "page"], sort=False):
        items, group, carry = [], None, None
        for r in g.itertuples():
            if r.group == "personnel":
                continue
            if r.group != group:
                # sub-groups (Firemen's / Employees' funds, p.163) share one Total; only a carried
                # Total is dropped when the group changes (expenditure Total never feeds revenues)
                carry, group = None, r.group
            label = r.label.strip()
            if label.lower().startswith("total"):
                parts = [x for x in items if not _is_subtotal(x.label)]
                if parts:
                    got = sum(_d(getattr(x, stage)) for x in parts) + (_d(getattr(carry, stage)) if carry else 0)
                    assert got == _d(getattr(r, stage)), f"{dept} p.{page - 10} '{label}' {stage}: rows {got} vs printed {getattr(r, stage)}"
                    checked += 1
                items, carry = [], r
            else:
                items.append(r)
    assert checked >= 55          # ~62 blocks per stage across departments and funds


@pytest.mark.parametrize("change,base", [("change_vs_adopted", "adopted_2026"), ("change_vs_requested", "requested_2027")])
def test_change_columns_equal_computed_change(tables, change, base):
    """Every printed change column = proposed - base, in every four-stage table. Exceptions are
    the document's own printing errors, excused only at their exact printed and computed values."""
    for r in tables["dept_summary"]:
        if change not in r or (r["proposed_2027"] is None and r[base] is None):
            continue
        want = _d(r["proposed_2027"]) - _d(r[base])
        printed = r[change]
        if (printed is None and want == 0) or (printed is not None and _d(printed) == want):
            continue
        assert documented("change_column", f"{r['dept']}:{r['metric']}", change, str(printed), str(int(want))), (
            f"{r['dept']} p.{r['cite']['printed_page']} '{r['label']}' {change}: printed {printed}, computed {want}")
