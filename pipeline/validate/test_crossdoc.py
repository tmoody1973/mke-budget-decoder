"""Summary ↔ Detailed cross-document checks (P1.8). The two books are printed separately; every
department's total and position count must agree between them, in every stage. A disagreement
is only a document error once BOTH books pass their own internal checks (Socratic stop 2)."""
from decimal import Decimal

import pandas as pd
import pytest

from common.config import PROCESSED
from common.departments import by_slug
from common.inconsistencies import documented

STAGES = ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027")
# Summary p.13 label → departments.yaml slug (labels as printed on the page)
P13 = {
    "Administration, Dept. of": "administration", "Assessor's Office": "assessor", "City Attorney": "city-attorney",
    "City Development, Dept. of": "city-development", "City Treasurer": "city-treasurer",
    "Common Council City Clerk": "common-council-city-clerk",
    "Community Wellness and Safety, Dept. of": "community-wellness-safety",
    "Compliance and Engagement, Dept. of": "compliance-engagement", "Comptroller's Office": "comptroller",
    "Election Commission": "election-commission", "Emergency Communications, Dept. of": "emergency-communications",
    "Employee Relations, Dept. of": "employee-relations", "Fire and Police Commission": "fire-police-commission",
    "Fire Department": "fire", "Health Department": "health", "Library": "library", "Mayor's Office": "mayor",
    "Municipal Court": "municipal-court", "Neighborhood Services, Dept. of": "neighborhood-services",
    "Police Department": "police", "Port Milwaukee": "port",
    "Administrative Services Division": "dpw-administrative-services",
    "Infrastructure Services Division": "dpw-infrastructure", "Operations Division": "dpw-operations",
    "Transportation Fund": "transportation-fund", "Sewer Maintenance Fund": "sewer-maintenance-fund",
}


@pytest.fixture(scope="module")
def li():
    return pd.read_parquet(PROCESSED / "line_items.parquet")


def _top(li, slug):
    """Rows of the department's top level: its BCU summary sheet if it has one, else its units."""
    rows = li[li.section.isin(by_slug()[slug]["detailed"])]
    summary = rows[rows.block == "bcu_summary"]
    return summary if len(summary) else rows[rows.block == "decision_unit"]


def detailed_total(li, slug, stage):
    top = _top(li, slug)
    return int(top[top.is_unit_total][stage].fillna(0).sum())


def detailed_positions(li, slug, stage):
    top = _top(li, slug)
    rows = top[top.description.str.upper().str.startswith("TOTAL NUMBER OF POSITIONS AUTHORIZED")]
    if not len(rows):
        # single-unit departments print no positions-authorized line; the count is the units on
        # NET SALARIES & WAGES TOTAL (Detailed 120.4 line 6: 53 = Summary p.13 Assessor)
        rows = top[top.description.str.upper().str.startswith("NET SALARIES & WAGES TOTAL")]
    col = f"{stage}_units"
    return int(sum(Decimal(v) for v in rows[col].dropna())) if len(rows) else None


SECTION_A_DEPTS = [s for s in P13.values() if by_slug()[s]["section"] == "A"]


@pytest.mark.parametrize("slug", SECTION_A_DEPTS)
@pytest.mark.parametrize("stage", STAGES)
def test_department_total_matches_across_books(li, slug, stage):
    ds = pd.read_parquet(PROCESSED / "dept_summary.parquet")
    row = ds[(ds.dept == slug) & (ds.metric == "total_expenditures")].iloc[0]
    summary = int(Decimal(row[stage])) if row[stage] is not None else 0
    assert summary == detailed_total(li, slug, stage), f"{slug} {stage}: Summary p.{row.cite['printed_page']}"


@pytest.mark.parametrize("label,slug", P13.items())
@pytest.mark.parametrize("stage", ("adopted_2026", "requested_2027", "proposed_2027"))
def test_positions_match_across_books(li, label, slug, stage):
    p13 = pd.read_parquet(PROCESSED / "positions_summary.parquet")
    printed = int(p13[p13.label == label][stage].iloc[0])
    assert printed == detailed_positions(li, slug, stage), f"{label} {stage}"


def test_position_change_totals_match_p13():
    """Each department's position-changes Totals row = its p.13 change vs adopted (where printed)."""
    pc = pd.read_parquet(PROCESSED / "position_changes.parquet")
    p13 = pd.read_parquet(PROCESSED / "positions_summary.parquet").set_index("label")
    tot = pc[pc.is_total & pc.positions.notna()].groupby("dept").positions.first()
    checked = 0
    for label, slug in P13.items():
        if slug in tot.index and pc[pc.dept == slug].is_total.sum() == 1:
            listed, printed = int(Decimal(tot[slug])), int(p13.loc[label, "change_vs_adopted"])
            assert listed == printed or documented("position_changes_vs_p13", slug, "positions", printed, listed), slug
            checked += 1
    assert checked >= 10
