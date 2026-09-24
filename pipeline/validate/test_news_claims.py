"""News claims (docs/09 step 3) are held to their pages: every figure in what the budget "prints"
appears on the cited page, labels come from the fixed neutral set, and quoted budget sentences are
on the page word for word."""
import re

import pytest
import yaml

from common.config import PIPELINE_DATA
from common.summary_pdf import searchable_text

CLAIMS = yaml.safe_load((PIPELINE_DATA / "news_claims.yaml").read_text())
LABELS = {"matches", "rounded", "not_in_budget", "different_measure"}
FIGURE = re.compile(r"\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$\d+(?:\.\d+)?|\b\d+\.\d+\b")


@pytest.mark.parametrize("claim", CLAIMS, ids=[c["id"] for c in CLAIMS])
def test_claim_budget_side_is_on_its_page(claim):
    assert claim["label"] in LABELS
    assert claim["sources"] and all(s["quote"] for s in claim["sources"])
    page = re.sub(r"\s+", " ", searchable_text(claim["budget"]["cite"]["pdf_page"]))
    text = claim["budget"]["text"]
    for fig in FIGURE.findall(text):
        assert fig.lstrip("$") in page, f"{claim['id']}: {fig!r} not on pdf p.{claim['budget']['cite']['pdf_page']}"
    for quote in re.findall(r'"([^"]+)"', text):
        q = re.sub(r"\s+", " ", quote).rstrip(".").replace("’", "'")
        assert q[:1].lower() + q[1:] in page.replace("’", "'") or q in page.replace("’", "'"), f"{claim['id']}: quote not on page"
