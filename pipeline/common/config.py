"""Budget-version config: the one place the edition being extracted is named."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
PIPELINE_DATA = ROOT / "pipeline" / "data"

BUDGET_VERSION = "2027-proposed-3rd-run-2026-09-14"
RUN_LABEL = "3rd Run 9/14/26"

SUMMARY_PDF = RAW / "2027-Proposed-Plan-and-Executive-Budget-Summary.pdf"
DETAILED_PDF = RAW / "2027-Proposed-Detailed-Budget.pdf"
SUMMARY_PAGE_OFFSET = 10  # printed page N = PDF page N + 10 (docs/02 §1)
