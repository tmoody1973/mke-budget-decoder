"""Per-unit reconciliation of the Detailed book, ported from mke-budget-commons reconcile_city.py.

Inside every decision unit, for every stage, the printed lines must add up to the unit's own
printed category totals. This is the 'is a line missing?' check (Socratic stop 2): if a line were
dropped or put in the wrong column, its category would stop adding up. Exact match; a mismatch is
a finding with its delta, excused only by an exact entry in source_inconsistencies.yaml.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import pandas as pd

from common.config import PROCESSED

STAGES = ("adopted_2026", "requested_2027", "proposed_2027", "actual_2025")
TOTALS = {
    "net_salaries": re.compile(r"^NET SALARIES & WAGES TOTAL"),
    "operating": re.compile(r"^OPERATING EXPENDITURES TOTAL"),
    "equipment": re.compile(r"^EQUIPMENT PURCHASES TOTAL"),
    "special": re.compile(r"^SPECIAL FUNDS( TOTAL)?$"),
}


@dataclass
class Check:
    section: str
    unit: str
    first_page: str
    check: str
    stage: str
    printed: int
    extracted: int

    @property
    def ok(self) -> bool:
        return self.printed == self.extracted


CATEGORY_HEADS = {"SALARIES & WAGES", "OPERATING EXPENDITURES", "EQUIPMENT PURCHASES", "SPECIAL FUNDS"}


def units(li: pd.DataFrame):
    """Split decision-unit rows into units, each ending at its unit-total row. A unit begins at
    its first category heading: valued rows before it are fund-level lines printed between units
    (Transportation 510.3 'CAPITAL IMPROVEMENTS PROGRAM') and belong to no unit's categories."""
    cur, started = [], False
    for r in li.itertuples():
        if r.row_type == "heading" and r.description.upper() in CATEGORY_HEADS:
            started = True
        if started or r.is_unit_total:
            cur.append(r)
        if r.is_unit_total:
            yield cur
            cur, started = [], False


def _v(r, stage):
    v = getattr(r, stage)
    return 0 if pd.isna(v) else int(v)


def _itemized(lines, stage) -> bool:
    return any(not pd.isna(getattr(r, stage)) for r in lines)


def _equipment_lines(rows) -> list:
    """Subtotal rows, plus items after the last subtotal that no subtotal covers."""
    out, pending = [], []
    for r in rows:
        if r.row_type == "rollup" and r.description.upper().startswith("SUBTOTAL"):
            out.append(r)
            pending = []
        elif r.row_type in ("account", "item"):
            pending.append(r)
        elif r.row_type == "rollup":          # the EQUIPMENT PURCHASES TOTAL itself
            break
    return out + pending


def reconcile_unit(rows) -> list[Check]:
    """A check runs only when the unit itemizes that stage: the book prints 2025 actuals for
    equipment and special funds on the totals alone (commons: NOT_RECONCILABLE, never a FAIL)."""
    out = []
    head = rows[0]
    by_total = {k: [r for r in rows if r.row_type == "rollup" and rx.match(r.description.upper())]
                for k, rx in TOTALS.items()}
    for stage in STAGES:
        # operating: account lines in the operating category == 006300 total
        ops = [r for r in rows if r.category == "operating" and r.row_type in ("account", "item")]
        if by_total["operating"] and ops and _itemized(ops, stage):
            out.append(Check(head.section, head.hierarchy_path[-1], head.printed_page, "operating", stage,
                             sum(_v(r, stage) for r in by_total["operating"]), sum(_v(r, stage) for r in ops)))
        # salaries: positions + adjustments + deductions == 006000 net (no per-position 2025 actuals)
        sal = [r for r in rows if r.category == "salaries" and r.row_type in ("position", "adjustment", "deduction")]
        if by_total["net_salaries"] and sal and stage != "actual_2025" and _itemized(sal, stage):
            out.append(Check(head.section, head.hierarchy_path[-1], head.printed_page, "net_salaries", stage,
                             sum(_v(r, stage) for r in by_total["net_salaries"]), sum(_v(r, stage) for r in sal)))
        # equipment: each group's printed subtotal, or its items where no subtotal is printed
        # (Detailed 220.15 prints 'Replacement Equipment 250' with no subtotal line) == 006800
        subs = _equipment_lines([r for r in rows if r.category == "equipment"])
        if by_total["equipment"] and subs and _itemized(subs, stage):
            out.append(Check(head.section, head.hierarchy_path[-1], head.printed_page, "equipment", stage,
                             sum(_v(r, stage) for r in by_total["equipment"]), sum(_v(r, stage) for r in subs)))
        # special: items printed ABOVE the SPECIAL FUNDS TOTAL line == that total (transfer lines
        # printed after it, e.g. Transportation 510.8 'TRANSFER TO CAPITAL FUND', are not special items)
        end = rows.index(by_total["special"][0]) if by_total["special"] else len(rows)
        sp = [r for r in rows[:end] if r.category == "special" and r.row_type in ("account", "item")]
        if by_total["special"] and sp and _itemized(sp, stage):
            out.append(Check(head.section, head.hierarchy_path[-1], head.printed_page, "special", stage,
                             sum(_v(r, stage) for r in by_total["special"]), sum(_v(r, stage) for r in sp)))
    return out


def run() -> list[Check]:
    li = pd.read_parquet(PROCESSED / "line_items.parquet")
    du = li[li.block == "decision_unit"]
    checks = []
    for sec, g in du.groupby("section", sort=False):
        for u in units(g):
            checks += reconcile_unit(u)
    return checks


if __name__ == "__main__":
    cs = run()
    bad = [c for c in cs if not c.ok]
    print(f"{len(cs)} checks, {len(bad)} mismatches")
    for c in bad[:40]:
        print(f"  {c.section} {c.first_page:>7} {c.check:13s} {c.stage:15s} printed={c.printed:>12,} "
              f"lines={c.extracted:>12,} diff={c.printed - c.extracted:>10,}  {c.unit[:40]}")
