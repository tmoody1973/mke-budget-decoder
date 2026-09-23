"""Row-level tests for the Detailed (BMD-2) parser, against real pages of the 2027 Proposed book.

Every expected value here was read off the PDF page named in the test.
"""
from decimal import Decimal

import pytest

from common.numbers import is_number_token, parse_decimal
from extract.detailed_lines import parse_detailed


@pytest.fixture(scope="module")
def parsed():
    return parse_detailed()


def row(rows, printed_page, line_no):
    [r] = [r for r in rows if r.printed_page == printed_page and r.line_no == line_no]
    return r


# --- number parsing -----------------------------------------------------------------------
@pytest.mark.parametrize("text,value", [
    ("1,234", Decimal(1234)), ("(150,644)", Decimal(-150644)), ("112.36", Decimal("112.36")),
    ("30,000*", Decimal(30000)), ("", None), ("-", None),
])
def test_parse_decimal(text, value):
    assert parse_decimal(text) == value


@pytest.mark.parametrize("text,ok", [("(150,644)", True), ("7BN", False), ("TOTAL*", False),
                                     ("(0.5", False), ("0.5)", False), ("2,586", True)])
def test_number_token(text, ok):
    assert is_number_token(text) is ok


# --- page coverage ------------------------------------------------------------------------
def test_only_non_bmd2_pages_skipped(parsed):
    _, stats = parsed
    assert stats["skipped_pages"] == [1, 2, 453, 454, 455]


def test_no_orphan_words(parsed):
    _, stats = parsed
    assert stats["orphan_words"] == {}


def test_stretched_pages_are_known(parsed):
    """Pages whose header drifts >2pt from docs/02 §3 (decision D10). New ones should be looked at."""
    _, stats = parsed
    assert set(stats["stretched_pages"]) == set(range(92, 97)) | set(range(216, 239)) | {244, 245}


def test_every_row_cited(parsed):
    rows, _ = parsed
    assert all(r.pdf_page and r.printed_page and 1 <= r.line_no <= 26 for r in rows)


# --- values -------------------------------------------------------------------------------
def test_g20_admin_net_salaries(parsed):
    """Golden G20 — Detailed 110.1 line 10."""
    r = row(parsed[0], "110.1", 10)
    assert r.account == "006000" and r.row_type == "rollup" and r.footnote_flag
    assert r.values == {"actual_2025": 10901893, "adopted_2026": 10130279,
                        "requested_2027": 10967573, "proposed_2027": 10501580}


def test_parens_are_negative(parsed):
    r = row(parsed[0], "110.12", 5)  # Grants and Aids Deduction
    assert r.row_type == "deduction"
    assert r.values["proposed_2027"] == -472629


def test_blank_cells_are_none_not_zero(parsed):
    r = row(parsed[0], "110.2", 7)  # Vehicle Repair Services: 2026 only
    assert r.values.get("adopted_2026") == 3000
    assert r.values.get("proposed_2027") is None and r.values.get("actual_2025") is None


def test_wide_fte_counts_route_to_units(parsed):
    """Police O&M FTEs print right-aligned into the dollars band on a stretched page."""
    r = row(parsed[0], "300.18", 16)
    assert r.row_type == "count"
    assert r.values["proposed_2027_units"] == Decimal("2349.45")
    assert r.values.get("proposed_2027") is None


def test_centered_unit_counts_are_kept(parsed):
    r = row(parsed[0], "150.1", 11)  # Temp. Customer Service Rep. I — units print centered
    assert r.values["proposed_2027_units"] == 15 and r.values["proposed_2027"] == 90485


def test_position_with_footnotes(parsed):
    r = row(parsed[0], "110.3", 18)  # Epidemiologist - Senior (X)(Y) 2LX
    assert r.row_type == "position" and r.pay_range == "2LX"
    assert r.footnote_codes == ["X", "Y"] and r.description == "Epidemiologist - Senior"
    assert r.values["proposed_2027"] == 101375


def test_footnote_prose_numbers_are_not_values(parsed):
    r = row(parsed[0], "300.19", 6)  # "(N) ... Position authority for 1 Police Detective"
    assert r.row_type == "note" and r.values == {}


def test_account_printed_short_kept_as_printed(parsed):
    r = row(parsed[0], "160.6", 20)
    assert r.account == "6300" and "account_printed_short" in r.flags and r.row_type == "rollup"


def test_fringe_without_account_is_rollup(parsed):
    assert row(parsed[0], "240.4", 23).row_type == "rollup"


def test_revenue_lines_have_no_sbcl(parsed):
    r = row(parsed[0], "430.1", 7)  # Water Works payment in lieu of taxes
    assert (r.fund, r.org, r.sbcl, r.account) == ("0001", "2110", None, "009020")
    assert r.values["proposed_2027"] == 16000000
