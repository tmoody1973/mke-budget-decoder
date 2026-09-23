"""Second, independent extraction check (pdftotext word coordinates vs the pipeline's pdfplumber
parse). Every extracted row must be found on its cited page, except the verified checker
limitations in pipeline/data/crosscheck_allowlist.yaml."""
import yaml

from common.config import PIPELINE_DATA
from validate.bbox_crosscheck import run

ALLOW = {(a["dept"], a["table"], a["row"], a["pdf_page"]) for a in
         yaml.safe_load((PIPELINE_DATA / "crosscheck_allowlist.yaml").read_text())}


def test_every_row_found_on_its_page_by_a_second_extractor():
    results = run()
    assert len(results) > 1200
    failing = {(r["dept"], r["table"], r["row"], r["page"]) for r in results if r["status"] != "ok"}
    new = failing - ALLOW
    assert not new, "rows not found on their cited page:\n" + "\n".join(map(str, sorted(new)))
    stale = ALLOW - failing
    assert not stale, "allowlisted rows now match — remove them from crosscheck_allowlist.yaml:\n" + "\n".join(map(str, sorted(stale)))
