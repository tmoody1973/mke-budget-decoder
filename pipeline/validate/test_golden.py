"""Golden numbers G1–G20 (docs/02 §7), asserted against the extracted datasets.
Every expected value below is copied from docs/02 §7, which was read directly from the documents.
A failure here blocks deploy (CLAUDE.md principle 6)."""
from decimal import Decimal

import pandas as pd
import pytest

from common.config import PROCESSED


@pytest.fixture(scope="module")
def d():
    load = lambda n: pd.read_parquet(PROCESSED / f"{n}.parquet")
    return {n: load(n) for n in ("section_totals", "section_comparisons", "dept_summary", "positions_summary",
                                 "revenues", "line_items")}


def st(d, section, line):
    r = d["section_totals"]
    return r[(r.section == section) & (r.line == line)].iloc[0]


def dept(d, slug, metric):
    r = d["dept_summary"]
    return r[(r.dept == slug) & (r.metric == metric)].iloc[0]


def pos(d, label):
    r = d["positions_summary"]
    return r[r.label == label].iloc[0]


def rev(d, line):
    r = d["revenues"]
    return r[(r.source == "summary") & (r.line == line)].iloc[0]


def test_g1_all_funds(d):
    t = st(d, "TOTAL", "budget")
    assert (t.proposed_2027, t.adopted_2026, t.change) == (2_261_087_412, 2_075_687_722, 185_399_690)


def test_g2_general_city_purposes(d):
    a = st(d, "A", "budget")
    assert (a.proposed_2027, a.adopted_2026) == (846_796_205, 815_673_383)
    c = d["section_comparisons"]
    req = c[(c.section == "A") & (c.line == "Total Appropriations")].iloc[0]
    assert req.requested_2027 == 878_902_850


def test_g3_total_levy(d):
    t = st(d, "TOTAL", "levy")
    assert (t.proposed_2027, t.adopted_2026, t.change) == (343_557_288, 336_820_871, 6_736_417)


def test_g4_tax_rate(d):
    t = st(d, "TOTAL", "levy")
    assert (Decimal(t.tax_rate_2027), Decimal(t.tax_rate_2026)) == (Decimal("7.29"), Decimal("7.61"))


def test_g5_assessed_value():
    import json
    av = json.loads((PROCESSED / "assessed_value.json").read_text())
    assert av["value"] == 47_141_816_729 and "August 31, 2026" in av["text"]


def test_g6_gcp_levy(d):
    a = st(d, "A", "levy")
    assert (a.proposed_2027, a.adopted_2026) == (143_688_740, 147_307_020)


def test_g7_tsf_withdrawal(d):
    c = d["section_comparisons"]
    r = c[(c.section == "A") & (c.line == "Tax Stabilization Fund Withdrawal")].iloc[0]
    assert (r.proposed_2027, r.adopted_2026) == (41_301_000, 32_300_000)


@pytest.mark.parametrize("gid,section,value", [
    ("G8", "B", 273_417_384), ("G9", "C", 316_607_345), ("G10", "D", 326_623_735), ("G12", "J", 228_909_690)])
def test_g8_to_g12_sections(d, gid, section, value):
    assert st(d, section, "budget").proposed_2027 == value, gid


def test_g11_economic_development_fund(d):
    i = st(d, "I", "budget")
    assert (i.proposed_2027, i.adopted_2026) == (0, 15_000_000)


def test_g13_police_four_stages(d):
    p = dept(d, "police", "total_expenditures")
    stages = tuple(int(Decimal(p[c])) for c in ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027"))
    assert stages == (330_680_888, 310_111_835, 345_822_092, 343_937_125)
    assert int(Decimal(p.change_vs_adopted)) == 33_825_290


def test_g14_fire(d):
    f = dept(d, "fire", "total_expenditures")
    assert (int(Decimal(f.proposed_2027)), int(Decimal(f.adopted_2026))) == (172_888_103, 165_408_632)


def test_g15_emergency_communications(d):
    e = dept(d, "emergency-communications", "total_expenditures")
    assert int(Decimal(e.proposed_2027)) == 25_770_876
    assert int(Decimal(e.change_vs_adopted)) == -1_401_068
    p = pos(d, "Emergency Communications, Dept. of")
    assert (p.adopted_2026, p.proposed_2027) == (241, 230)


def test_g16_total_positions(d):
    p = pos(d, "Total Budgeted Positions")
    assert (p.proposed_2027, p.adopted_2026, p.change_vs_adopted) == (7_844, 7_818, 26)


def test_g17_police_positions(d):
    p = pos(d, "Police Department")
    assert (p.proposed_2027, p.adopted_2026) == (2_585, 2_526)
    assert int(Decimal(dept(d, "police", "positions").proposed_2027)) == 2_585


def test_g18_sales_tax(d):
    """$58.8M to GCP = the Source of Funds line rounded to $0.1M; $218.2M is narrative-only (budget_facts)."""
    assert round(rev(d, "Local Sales Tax").proposed_2027 / 1e6, 1) == 58.8


def test_g19_state_shared_revenue(d):
    s = rev(d, "State Shared Revenue (General)")
    assert round(s.proposed_2027 / 1e6, 1) == 260.0
    assert round((s.proposed_2027 - s.adopted_2026) / 1e6, 1) == 5.5


def test_g20_admin_net_salaries_detailed(d):
    li = d["line_items"]
    r = li[(li.printed_page == "110.1") & (li.line_no == 10)].iloc[0]
    assert r.description == "NET SALARIES & WAGES TOTAL" and r.account == "006000"
    assert (r.actual_2025, r.adopted_2026, r.requested_2027, r.proposed_2027) == (10_901_893, 10_130_279, 10_967_573, 10_501_580)
