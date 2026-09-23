"""MPROP snapshot (extract/mprop.py): privacy and shape checks on the committed file."""
import json

import pandas as pd

from common.config import PROCESSED
from extract.mprop import KEEP

P = pd.read_parquet(PROCESSED / "parcels.parquet")
META = json.loads((PROCESSED / "parcels_meta.json").read_text())


def test_no_owner_fields_ever():
    """docs/07 §8: owner names and mailing addresses never leave the city's file."""
    assert list(P.columns) == KEEP
    assert not [c for c in P.columns if "OWNER" in c or "MAIL" in c]


def test_one_row_per_taxkey_and_matches_meta():
    assert P.TAXKEY.is_unique and P.TAXKEY.str.fullmatch(r"\d{10}").all()
    assert len(P) == META["rows"] > 150_000


def test_assessments_non_negative():
    for c in ("C_A_TOTAL", "C_A_EXM_TOTAL", "P_A_TOTAL", "P_A_EXM_TOTAL"):
        assert (P[c].dropna() >= 0).all(), c


def test_taxable_and_exempt_never_overlap():
    """C_A_TOTAL is already the taxable assessment: exempt parcels (class 9) carry 0 there and
    their value in C_A_EXM_TOTAL. So taxable = C_A_TOTAL, not C_A_TOTAL - C_A_EXM_TOTAL."""
    for cur, exm in (("C_A_TOTAL", "C_A_EXM_TOTAL"), ("P_A_TOTAL", "P_A_EXM_TOTAL")):
        assert not ((P[cur] > 0) & (P[exm].fillna(0) > 0)).any()
