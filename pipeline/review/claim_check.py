"""Check that curated statements say what their cited page says (TypeSafe Jev, System One).

Pattern: docs.typesafe.ai/cookbooks/citation_check. Split of work (Jev 1.13 is weak at numbers,
docs.typesafe.ai/model-jaggedness/jev-1.13):
  code  — every figure in a statement is on the cited page (validate/test_curated_data.py), and
          picks the few sentences around it as the passage (large irrelevant state hurts accuracy)
  Jev   — one semantic judgment per item:
          budget_facts → Choice: does the passage support / contradict / say nothing about it?
          glossary     → Noul: does the page's use of the term conflict with our definition?
            (definitions are our own plain-language explanations; pages use terms without
            defining them, so 'support' would be the wrong question)

Results go to pipeline/data/claim_checks.json (committed) keyed by a hash of the statement and
passage, so CI reads them without an API key and flags any statement edited since it was checked.
Run: uv run python -m review.claim_check        (needs TYPESAFE_API_KEY in .env.local)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from time import perf_counter

import yaml

from common.config import PIPELINE_DATA, ROOT
from common.summary_pdf import lines

MODEL = "jev-1.13.0"          # pinned: thresholds are only meaningful for one version
AUTO_ACCEPT = 0.8             # cookbook starting point; below it a person confirms
RESULTS = PIPELINE_DATA / "claim_checks.json"

RELATION_CRITERIA = {
    "supports": "The passage states what the statement says, or directly implies it. Small differences "
                "in wording are fine when the meaning is the same.",
    "contradicts": "The passage states something different from the statement, or implies the "
                   "statement is false or misleading.",
    "says_nothing": "The passage does not address what the statement says, either way.",
}
RELATION_INSTRUCTIONS = (
    "The `statement` was written to summarize the `passage`, which is taken from the City of "
    "Milwaukee 2027 Proposed Budget. Every number in the statement has already been checked by code "
    "and appears in the passage; judge the meaning, not the arithmetic. How does the passage relate "
    "to the statement?")
CONFLICT_INSTRUCTIONS = (
    "The `definition` is a plain-language explanation of the budget term `term`, written for residents. "
    "The `passage` is where the City of Milwaukee 2027 Proposed Budget uses that term. Does the way the "
    "passage uses the term conflict with the definition? Answer yes only if the passage uses the term "
    "to mean something the definition would get wrong; a passage that simply uses the term without "
    "defining it is not a conflict.")


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.;:])\s+(?=[A-Z0-9$“\"'(])", text) if s.strip()]


STOP = set("the a an of and or to in for on at by with from is are was were be this that these those it its "
           "which will as than more most each per".split())


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9$.%']+", text.lower()) if w not in STOP and len(w) > 2}


def passage(page: str, statement: str, anchors: list[str], window: int = 1, max_words: int = 220) -> str:
    """The best-matching sentence(s) for the statement, plus `window` neighbours each side.
    A sentence scores 3 per anchor it contains (dollar amounts, percentages, quoted phrases, or the
    glossary term) and 1 per shared content word; only the top-scoring sentences are kept."""
    sents = _sentences(page)
    target = _words(statement)
    scores = [3 * sum(a.lower() in s.lower() for a in anchors) + len(target & _words(s)) for s in sents]
    if not sents or max(scores) == 0:
        return ""
    best = max(scores)
    top = [i for i, sc in enumerate(scores) if sc >= best * 0.8][:3]
    keep = sorted({j for i in top for j in range(max(0, i - window), min(len(sents), i + window + 1))})
    return " ".join(" ".join(sents[j] for j in keep).split()[:max_words])


LETTER_SPACED = re.compile(r"(?:\b\S\b ){3,}\S\b")   # 'S O U R C E' — sideways text read letter by letter


def _page(doc: str, pdf_page: int) -> str:
    """Page text for passages: our rebuilt words only. searchable_text() joins pdfplumber's text and
    the rebuilt words, which suits 'is this figure on the page' but duplicates every sentence in a
    passage (reviewer finding, 2026-09-23); letter-by-letter sideways text is dropped."""
    if doc == "summary":
        text = " ".join(ln.text for ln in lines(pdf_page)).replace("’", "'")
        return re.sub(r"\s+", " ", LETTER_SPACED.sub(" ", text))
    import pdfplumber

    from common.config import DETAILED_PDF
    with pdfplumber.open(DETAILED_PDF) as pdf:
        # BMD-2 lines start with a printed line number (1-2 digits); drop it so sentences rejoin
        text = "\n".join(re.sub(r"^\d{1,2}(?:\s+|$)", "", ln) for ln in (pdf.pages[pdf_page - 1].extract_text() or "").splitlines())
        return re.sub(r"\s+", " ", text)


def items() -> list[dict]:
    facts = yaml.safe_load((PIPELINE_DATA / "budget_facts.yaml").read_text())
    gloss = yaml.safe_load((PIPELINE_DATA / "glossary.yaml").read_text())
    out = []
    for f in facts:
        page = _page(f["cite"]["doc"], f["cite"]["pdf_page"])
        quotes = re.findall(r"(?<![A-Za-z])'([^']+)'(?![A-Za-z])", f["statement"])
        anchors = quotes + re.findall(r"\$[\d,]+(?:\.\d+)?(?: million| billion)?|\d+(?:\.\d+)?%|\[[\d,]+\]", f["statement"])
        out.append({"id": f"fact:{f['id']}", "kind": "fact", "statement": f["statement"], "anchors": anchors,
                    "passage": passage(page, f["statement"], anchors), "cite": f["cite"]})
    for g in gloss:
        page = _page(g["cite"]["doc"], g["cite"]["pdf_page"])
        names = [g["cite_text"], *g.get("aliases", [])]
        out.append({"id": f"glossary:{g['term']}", "kind": "glossary", "term": g["term"], "names": names,
                    "definition_source": g.get("definition_source"),
                    "statement": g["plain_definition"],
                    "passage": passage(page, g["cite_text"] + " " + g["plain_definition"], names),
                    "cite": g["cite"]})
    return out


def sufficient(item: dict) -> bool:
    p = item["passage"].lower()
    if not p:
        return False
    if item["kind"] == "glossary":
        return any(n.lower() in p for n in item["names"])
    return all(a.lower() in p for a in item["anchors"])


def key(item: dict) -> str:
    """Changes whenever the statement, the passage or the model changes — a stale result is visible."""
    return hashlib.sha256(json.dumps([item["statement"], item["passage"], MODEL]).encode()).hexdigest()[:16]


def _load_env() -> None:
    env = ROOT / ".env.local"
    for line in env.read_text().splitlines() if env.exists() else []:
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def ask(client, item: dict) -> dict:
    from typesafe_sdk import Choice, Noul
    started = perf_counter()
    if item["kind"] == "fact":
        r = client.system_one(state={"statement": item["statement"], "passage": item["passage"]},
                              questions={"relation": Choice(instructions=RELATION_INSTRUCTIONS,
                                                            criteria=RELATION_CRITERIA)}, model=MODEL)
        a = r.answers["relation"]
        verdict = {"supports": "verified", "contradicts": "contradicted", "says_nothing": "unsupported"}[a.choice]
        out = {"relation": a.choice, "confidence": round(a.confidence, 3),
               "probabilities": {k: round(v, 3) for k, v in a.probabilities.items()}, "verdict": verdict}
        out["auto"] = a.confidence >= AUTO_ACCEPT
    else:
        r = client.system_one(state={"term": item["term"], "definition": item["statement"], "passage": item["passage"]},
                              questions={"conflict": Noul(instructions=CONFLICT_INSTRUCTIONS)}, model=MODEL)
        p = r.answers["conflict"].noul
        # a Noul near 0.5 means yes and no are similarly likely: that is the case a person reads
        out = {"conflict_probability": round(p, 3),
               "verdict": "conflict" if p >= 0.5 else "consistent", "auto": p <= 0.2 or p >= 0.8}
    return {**out, "model": r.model, "input_tokens": r.usage.input_tokens or 0,
            "seconds": round(perf_counter() - started, 2)}


def main() -> dict:
    _load_env()
    from typesafe_sdk import TypeSafeClient
    old = json.loads(RESULTS.read_text()) if RESULTS.exists() else {}
    results = {}
    with TypeSafeClient(model=MODEL, timeout=120.0) as client:
        for it in items():
            k = key(it)
            if it.get("definition_source") == "ours":
                # the document never defines the term; there is no page to check it against
                # (review finding 2026-09-23): a person approves the wording, no model call
                results[it["id"]] = {"key": k, "kind": it["kind"], "cite": it["cite"], "statement": it["statement"],
                                     "passage": it["passage"], "verdict": "definition_ours", "auto": False}
                continue
            prev = old.get(it["id"])
            if prev and prev.get("key") == k:          # cache: same statement, passage, model
                results[it["id"]] = prev
                continue
            if not sufficient(it):
                # the passage lacks the term / the statement's figures: a 'consistent' here would be a
                # false pass (reviewer finding), so no model call — a person reads the page
                results[it["id"]] = {"key": k, "kind": it["kind"], "cite": it["cite"], "statement": it["statement"],
                                     "passage": it["passage"], "verdict": "passage_insufficient", "auto": False}
                continue
            results[it["id"]] = {"key": k, "kind": it["kind"], "cite": it["cite"], "statement": it["statement"],
                                 "passage": it["passage"], **ask(client, it)}
    RESULTS.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")
    verdicts = {}
    for r in results.values():
        verdicts[r["verdict"]] = verdicts.get(r["verdict"], 0) + 1
    return {"items": len(results), "verdicts": verdicts, "for_review": sum(not r["auto"] for r in results.values()),
            "input_tokens": sum(r.get("input_tokens", 0) for r in results.values())}


if __name__ == "__main__":
    print(main())
