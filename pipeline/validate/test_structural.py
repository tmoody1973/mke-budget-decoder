"""Structural reconciliation (P1.8): the documents' own arithmetic, re-done from extracted rows."""
import pandas as pd
import pytest

from common.config import PROCESSED
from common.inconsistencies import documented
from validate.reconcile import run as reconcile_units


def test_every_decision_unit_adds_up():
    """Inside every Detailed decision unit, lines == printed category totals, every stage.
    This is the 'no line is missing' check. Mismatches must be verified document errors."""
    checks = reconcile_units()
    assert len(checks) > 600
    bad = [c for c in checks if not c.ok and not documented(
        f"unit_{c.check}", f"{c.section}:{c.first_page}", c.stage, c.printed, c.extracted)]
    assert not bad, "\n".join(f"{c.section} {c.first_page} {c.check} {c.stage}: printed {c.printed:,} "
                              f"vs lines {c.extracted:,}" for c in bad)


@pytest.fixture(scope="module")
def p7():
    return pd.read_parquet(PROCESSED / "section_totals.parquet")


@pytest.mark.parametrize("line", ["budget", "non_levy", "levy"])
@pytest.mark.parametrize("col", ["adopted_2026", "proposed_2027", "change"])
def test_p7_sections_sum_to_subtotals_and_total(p7, line, col):
    v = {r.section: r[col] for _, r in p7[p7.line == line].iterrows()}
    assert sum(v[s] for s in "ABCDF") == v["SUBTOTAL_ABCDF"]
    assert sum(v[s] for s in "GHIJKMN") == v["SUBTOTAL_GHIJKMN"]
    assert v["SUBTOTAL_ABCDF"] + v["SUBTOTAL_GHIJKMN"] == v["TOTAL"]


@pytest.mark.parametrize("col", ["adopted_2026", "proposed_2027"])
def test_p7_budget_equals_non_levy_plus_levy(p7, col):
    for s, g in p7.groupby("section"):
        v = dict(zip(g.line, g[col]))
        assert v["budget"] == v["non_levy"] + v["levy"], s


def test_detailed_gcp_total_equals_g2():
    li = pd.read_parquet(PROCESSED / "line_items.parquet")
    r = li[(li.printed_page == "420.1") & (li.line_no == 3)].iloc[0]
    assert r.description == "TOTAL BUDGETS FOR GENERAL CITY PURPOSES" and r.proposed_2027 == 846_796_205


def test_gcp_revenue_categories_sum_to_total():
    rev = pd.read_parquet(PROCESSED / "revenues.parquet")
    s = rev[(rev.source == "summary") & (rev.fund == "general") & rev.is_total].set_index("line").proposed_2027
    cats = ["Total Taxes", "Total Licenses and Permits", "Total Intergovernmental Revenue",
            "Total Charges for Services", "Total Fines and Forfeitures", "Total Miscellaneous Revenue",
            "Total Fringe Benefits"]
    assert sum(s[c] for c in cats) == s["Total General Fund Revenue"]
    lines = rev[(rev.source == "summary") & (rev.fund == "general") & ~rev.is_total].set_index("line").proposed_2027
    reserves_levy = (lines["Tax Stabilization Fund Withdrawal (Sustainable)"]
                     + lines["Tax Stabilization Fund Withdrawal (Revenue Anticipation)"] + lines["Property Tax Levy"])
    assert s["Total General Fund Revenue"] + reserves_levy == s["Total Sources of Funds for General City Purposes"] == 846_796_205
