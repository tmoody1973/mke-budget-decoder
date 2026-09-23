"""P1.5b concept index for the Detailed budget (docs/06 §4): the distinct vocabulary of the
line-item book, so plain words ('consultants', '911 dispatchers') can resolve to codes and titles
before SQL. No embeddings here (P1.10). Glosses: account glosses come from a hand-drafted YAML
(unreviewed); position-title glosses need a batch model job and are left empty (open-questions).
"""
from __future__ import annotations

import pandas as pd
import yaml

from common.config import PIPELINE_DATA, PROCESSED
from common.departments import departments

CATEGORY_WORDS = {"SALARIES & WAGES", "OPERATING EXPENDITURES", "EQUIPMENT PURCHASES", "SPECIAL FUNDS",
                  "BUDGETARY CONTROL UNIT", "ADDITIONAL EQUIPMENT", "REPLACEMENT EQUIPMENT"}


def _dept_map() -> dict[str, str]:
    return {p: d["slug"] for d in departments() for p in d.get("detailed") or []}


def _glosses() -> dict[str, dict]:
    path = PIPELINE_DATA / "account_glosses.yaml"
    return {str(g["account"]): g for g in (yaml.safe_load(path.read_text()) or [])} if path.exists() else {}


def build() -> list[dict]:
    li = pd.read_parquet(PROCESSED / "line_items.parquet")
    li = li[li.block != "restated"]                       # restated sections repeat vocabulary
    li["dept"] = li.section.map(_dept_map())
    glosses = _glosses()
    out: list[dict] = []

    def add(kind, frame, key_cols, label_col="description", code_col=None):
        for key, g in frame.groupby(key_cols, dropna=False):
            label = str(g[label_col].iloc[0]).lstrip(" -.")
            code = (g[code_col].iloc[0] if code_col else None)
            gl = glosses.get(str(code)) if kind == "account" and code else None
            out.append({"kind": kind, "label": label, "code": code,
                        "dept_ids": sorted(set(g.dept.dropna())), "occurrences": len(g),
                        "gloss": gl["gloss"] if gl and gl.get("account_label") == label else None,
                        "gloss_reviewed": bool(gl and gl.get("reviewed_by")),
                        "cite": dict(g.cite.iloc[0])})

    body = li[~li.section.isin(["430", "480"])]
    add("account", body[body.row_type == "account"], ["account", "description"], code_col="account")
    add("position_title", body[body.row_type == "position"], ["description"])
    # Detailed headings often wrap over two lines ('1. BUDGET FOR PROVISIONS FOR' / 'EMPLOYEE
    # RETIREMENT'); a half is not a program name, and it adds noise to every concept search.
    fragment = (body.description.str.contains(r"(?:\b(?:FOR|OF|AND|THE|TO|BUDGETARY)|-|–)\s*$", case=False, regex=True)
                | body.description.str.upper().str.startswith("TOTAL")
                | body["flags"].map(lambda f: any(str(x).startswith("label_wraps") for x in f)))
    heads = body[(body.row_type == "heading") & ~body.description.str.upper().isin(CATEGORY_WORDS)
                 & ~body.description.str.contains(r"BCU|SUMMARY", regex=True) & ~fragment]
    add("org_unit", heads, ["description"])
    cap = li[(li.section == "480") & li.row_type.isin(["account", "item"])]
    add("capital_line", cap, ["description"], code_col="account")
    rev = li[(li.section == "430") & (li.row_type == "account")]
    add("revenue_line", rev, ["account", "description"], code_col="account")
    return out


def main() -> dict:
    rows = build()
    pd.DataFrame(rows).to_parquet(PROCESSED / "concepts.parquet", index=False)
    return {"concepts": len(rows)} | pd.Series([r["kind"] for r in rows]).value_counts().to_dict()


if __name__ == "__main__":
    print(main())
