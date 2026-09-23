"""P1.4 revenues: three printed sources, each row cited to its own page.

1. Summary p.160-161 'Source of Funds for General City Purposes' tables (category → line, 4 stages)
2. Detailed 430.x revenue listing (coded lines, from line_items)
3. Special-revenue fund revenue lines from each fund's budget summary (e.g. Transportation p.190)
"""
from __future__ import annotations

import pandas as pd

from common.config import PROCESSED
from common.departments import by_slug
from common.summary_pdf import pdf_page_for
from extract.dept_tables import budget_summary

STAGES = ("actual_2025", "adopted_2026", "requested_2027", "proposed_2027")


def _int(v):
    return None if v is None or pd.isna(v) else int(float(v))


def summary_source_of_funds() -> list[dict]:
    """Lines after 'Total General Fund Revenue' (Summary p.162) are the levy and reserve
    withdrawals; they take the printed 'Amount to be Raised Pursuant to 18-02-6' as category."""
    out, after_gf = [], None
    for printed in (160, 161, 162):
        for r in budget_summary("gcp-source-of-funds", pdf_page_for(printed)):
            if after_gf is None and r["label"].startswith("Amount to be Raised"):
                after_gf = r["label"]
            out.append({"source": "summary", "fund": "general", "dept": None,
                        "category": after_gf or r["group"],
                        "line": r["label"], "is_total": r["label"].lower().startswith("total"),
                        **{s: _int(r[s]) for s in STAGES}, "account": None, "cite": r["cite"]})
    return out


def detailed_revenue_listing() -> list[dict]:
    li = pd.read_parquet(PROCESSED / "line_items.parquet")
    rev = li[(li.section == "430") & li.row_type.isin(["account", "rollup", "item"])]
    return [{"source": "detailed", "fund": r.fund or "general", "dept": None,
             "category": (list(r.hierarchy_path) or [None])[-1], "line": r.description,
             "is_total": bool(r.is_subtotal), **{s: _int(getattr(r, s)) for s in STAGES},
             "account": r.account, "cite": dict(r.cite)} for r in rev.itertuples()]


def fund_revenue_lines() -> list[dict]:
    ds = pd.read_parquet(PROCESSED / "dept_summary.parquet")
    depts = by_slug()
    rows = ds[ds.group.fillna("").str.contains("revenue") & ds.dept.map(lambda d: depts[d]["section"] not in ("A",))]
    return [{"source": "summary", "fund": r.dept, "dept": r.dept, "category": "fund revenues",
             "line": r.label, "is_total": r.metric == "rev_total",
             **{s: _int(getattr(r, s)) for s in STAGES}, "account": None, "cite": dict(r.cite)}
            for r in rows.itertuples()]


def main() -> dict:
    rows = summary_source_of_funds() + detailed_revenue_listing() + fund_revenue_lines()
    pd.DataFrame(rows).astype({s: "Int64" for s in STAGES}).to_parquet(PROCESSED / "revenues.parquet", index=False)
    return {"revenues": len(rows)}
