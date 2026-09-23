"""reason_category on real reason strings from the 2027 Proposed Summary position tables."""
import pytest

from common.reason_category import reason_category


@pytest.mark.parametrize("reason,category", [
    ("Fund city supported position previoulsy paid as a contract employee through ARPA funded DVHRT grant.", "contract_to_city"),
    ("Convert Sensitive Crimes contract to city position to reflect IRS standards for the work", "contract_to_city"),
    ("Delete position previoulsy paid through ARPA funded DVHRT grant.", "arpa_sunset"),
    ("Grant ending before end of year", "grant_change"),
    ("Moved onto grant", "grant_change"),
    ("Moved onto levy", "grant_change"),
    ("Reflect acceptance of FY25 COPS Hiring Grant.", "grant_change"),
    ("New Position - State & Federal Reimbursable", "grant_change"),
    ("Position Title Reclassification", "reclassification"),
    ("Reclassified", "reclassification"),
    ("Retitled", "reclassification"),
    ("Correction - Pay Range", "reclassification"),
    ("Moved from Office of the Commissioner to ITMD", "transfer"),
    ("Moved to Library", "transfer"),
    ("New position for 2027 Budget", "new_funded"),
    ("Additional support for Sunday hours", "new_funded"),
    ("Converting to full time position", "new_funded"),
    ("Position eliminated", "other"),          # not stated as vacant — never implied
    ("Budget Reduction - Unfunded Auxiliary", "other"),
    ("Technical correction", "other"),
    (None, "other"),
])
def test_reason_category(reason, category):
    assert reason_category(reason) == category
