"""Hand-curated YAML is held to its pages: every figure in a statement must appear on the cited
page, and every narrative-vs-table pair must match the extracted table. (Anti-criterion: no number
typed by hand into outputs unless it is in hand-curated YAML with a citation that checks out.)"""
import re

import pandas as pd
import pytest
import yaml

from common.config import PIPELINE_DATA, PROCESSED
from common.summary_pdf import searchable_text

FIGURE = re.compile(r"\$[\d,]+(?:\.\d+)?(?: million| billion)?|\d+(?:\.\d+)?%|\(\d+\)|\b\d{2,}\b")


page_text = searchable_text


def _load(name):
    return yaml.safe_load((PIPELINE_DATA / name).read_text())


FACTS = _load("budget_facts.yaml")
FEES = _load("fees.yaml")


@pytest.mark.parametrize("fact", FACTS, ids=[f["id"] for f in FACTS])
def test_fact_figures_appear_on_cited_page(fact):
    text = page_text(fact["cite"]["pdf_page"])
    quoted = re.findall(r"(?<![A-Za-z])'([^']+)'(?![A-Za-z])", fact["statement"])
    for q in quoted:
        assert q.replace("’", "'") in text, f"quote not on page: {q!r}"
    for fig in FIGURE.findall(fact["statement"]):
        assert fig in text, f"{fact['id']}: {fig!r} not found on pdf p.{fact['cite']['pdf_page']}"


@pytest.mark.parametrize("fee", FEES, ids=[f["fee"] for f in FEES])
def test_fee_source_text_is_verbatim(fee):
    text = page_text(fee["cite"]["pdf_page"])
    assert fee["source_text"].replace("’", "'") in text
    assert f"${fee['value_2027']}" in fee["source_text"]
    if not fee["is_derived"]:
        assert f"${fee['value_2026']}" in fee["source_text"]


def test_derived_sewer_base_is_arithmetic():
    sewer = next(f for f in FEES if f["fee"] == "sewer_stormwater_avg")
    from decimal import Decimal
    assert Decimal(sewer["value_2027"]) - Decimal("5.14") == Decimal(sewer["value_2026"])


def test_fee_revenue_matches_source_of_funds_table():
    rev = pd.read_parquet(PROCESSED / "revenues.parquet")
    by_line = dict(zip(rev[rev.source == "summary"].line, rev[rev.source == "summary"].proposed_2027))
    names = {"solid_waste": "Solid Waste Fee", "extra_cart": "Extra Garbage Cart Fee",
             "snow_ice": "Snow and Ice Control Fee", "street_lighting": "Street Lighting Fee"}
    for f in FEES:
        if f["fee"] in names:
            assert by_line[names[f["fee"]]] == f["revenue_2027"], f["fee"]


def test_table_pairs_match_extracted_tables():
    rev = pd.read_parquet(PROCESSED / "revenues.parquet")
    rev_lines = dict(zip(rev[rev.source == "summary"].line, rev[rev.source == "summary"].proposed_2027))
    comp = pd.read_parquet(PROCESSED / "section_comparisons.parquet")
    for f in FACTS:
        pair = f.get("table_pair")
        if not pair:
            continue
        line = pair["line"]
        if f["id"] == "tsf-withdrawal-2027":
            got = rev_lines["Tax Stabilization Fund Withdrawal (Sustainable)"] + rev_lines["Tax Stabilization Fund Withdrawal (Revenue Anticipation)"]
        elif f["id"] == "cut-from-requests":
            got = int(comp[(comp.section == "A") & (comp.line == "Total Appropriations")].change_vs_requested.iloc[0])
        else:
            got = rev_lines[line]
        assert got == pair["value"], f["id"]


GLOSSARY = _load("glossary.yaml")


def _any_page_text(doc: str, pdf_page: int) -> str:
    if doc == "summary":
        return page_text(pdf_page)
    import pdfplumber

    from common.config import DETAILED_PDF
    with pdfplumber.open(DETAILED_PDF) as pdf:
        return re.sub(r"\s+", " ", pdf.pages[pdf_page - 1].extract_text() or "")


@pytest.mark.parametrize("entry", GLOSSARY, ids=[g["term"] for g in GLOSSARY])
def test_glossary_term_printed_on_cited_page(entry):
    text = _any_page_text(entry["cite"]["doc"], entry["cite"]["pdf_page"]).lower()
    assert entry["cite_text"].lower().replace("’", "'") in text.replace("’", "'"), entry["term"]


def test_glossary_size_and_no_numbers():
    assert 35 <= len(GLOSSARY) <= 50
    for g in GLOSSARY:
        assert not re.search(r"\$\s?\d|\d{1,3},\d{3}|\d{5,}", g["plain_definition"]), f"definition states an amount: {g['term']}"


@pytest.mark.parametrize("entry", [g for g in GLOSSARY if g.get("also_cite")], ids=lambda g: g["term"])
def test_glossary_additional_citations_mention_the_term(entry):
    names = [entry["cite_text"], *entry.get("aliases", []), entry["term"].split(" (")[0]]
    for c in entry["also_cite"]:
        text = _any_page_text(c["doc"], c["pdf_page"]).lower()
        want = [c["cite_text"]] if c.get("cite_text") else names   # a citation can name its own exact phrase
        assert any(n.lower() in text for n in want), f"{entry['term']}: none of {want} on pdf p.{c['pdf_page']}"
