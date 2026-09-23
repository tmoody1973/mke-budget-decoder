"""MPROP snapshot for the City Receipt (docs/07, decision D15).

Streams the city's Master Property File from data.milwaukee.gov and keeps only the fields the
receipt needs. Owner names and mailing addresses are never read (`usecols`), so they never reach
disk, git or the database. Refreshed by hand about once a quarter: assessments change once a year,
and a receipt should not move week to week for reasons unrelated to the budget.

Field meanings are from data/raw/MPROP-Field-Documentation.pdf (city file dated fall 2024);
see docs/open-questions.md for what the documentation does not settle.

Run: uv run python -m extract.mprop
"""
from __future__ import annotations

import json
from datetime import date

import pandas as pd

from common.config import PROCESSED

RESOURCE_ID = "0a2c7f31-cd15-4151-8222-09dd57d5f16d"
CSV_URL = f"https://data.milwaukee.gov/datastore/dump/{RESOURCE_ID}"

KEEP = [
    "TAXKEY", "YR_ASSMT", "TAX_RATE_CD",
    "HOUSE_NR_LO", "HOUSE_NR_HI", "HOUSE_NR_SFX", "SDIR", "STREET", "STTYPE",
    "C_A_CLASS", "C_A_TOTAL", "C_A_EXM_TYPE", "C_A_EXM_TOTAL", "P_A_TOTAL", "P_A_EXM_TOTAL",
    "NR_UNITS", "OWN_OCPD", "LAND_USE", "LAND_USE_GP", "BLDG_TYPE",
    "DPW_SANITATION", "GEO_ALDER", "LOT_AREA", "CORNER_LOT",
]
INTS = ["HOUSE_NR_LO", "HOUSE_NR_HI", "C_A_TOTAL", "C_A_EXM_TOTAL", "P_A_TOTAL", "P_A_EXM_TOTAL",
        "NR_UNITS"]
NEVER = ("OWNER_NAME_1", "OWNER_NAME_2", "OWNER_NAME_3", "OWNER_MAIL_ADDR", "OWNER_CITY_STATE", "OWNER_ZIP")


def build(source: str = CSV_URL) -> pd.DataFrame:
    df = pd.read_csv(source, usecols=KEEP, dtype=str, keep_default_na=False)
    df = df.apply(lambda c: c.str.strip()).replace({"": None})
    for c in INTS:
        df[c] = pd.to_numeric(df[c], errors="raise").astype("Int64")
    df["LOT_AREA"] = pd.to_numeric(df.LOT_AREA, errors="raise")   # square feet; 7,594 have decimals
    assert not set(NEVER) & set(df.columns)
    return df[KEEP]


def main() -> dict:
    df = build()
    df.to_parquet(PROCESSED / "parcels.parquet", index=False)
    meta = {"source": CSV_URL, "resource_id": RESOURCE_ID, "snapshot_date": date.today().isoformat(),
            "rows": len(df), "yr_assmt": df.YR_ASSMT.value_counts().to_dict()}
    (PROCESSED / "parcels_meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    return meta


if __name__ == "__main__":
    print(main())
