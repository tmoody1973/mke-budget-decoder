# 06 — RAG Ingestion: how both PDFs are indexed

**Short version:** the two PDFs are treated completely differently. The **Summary** is the only real RAG corpus, and it's small. The **Detailed** budget is never chunked for semantic search; it's parsed into rows (docs/02) and gets a small *concept index* so plain-language words can find the right accounts, positions, and org units. Numbers are answered from SQL in every case.

## 1. What each document is, measured

| | Summary (224 pp) | Detailed (455 pp) |
|---|---|---|
| Nature | Narrative + tables + charts | 100% fixed-form line items (BMD-2) |
| Narrative text | ~41,000 words after removing tables, footers, front matter (≈55k tokens) | Essentially none (footnotes and notes only) |
| Tables | Budget summaries, services, KPIs, position changes, section totals, revenues | Every page |
| Vocabulary | Open prose | 216 distinct account descriptions ("Professional Services", "Energy"…); ~1,500 position titles; ~500 org/program headings |
| RAG role | Narrative lane | Concept lane (entity resolution), not text retrieval |

Measured with the prototype in `pipeline/extract/narrative_chunks.py`: **225 chunks**, median 213 words, p95 319, max 404.

## 2. Three retrieval lanes

```
User question
   │
   ├─ Structured lane (numbers) ── typed SQL tools over tables from BOTH PDFs  ← all figures
   │
   ├─ Narrative lane (why / what / plans) ── hybrid search over Summary chunks ← context, quotes
   │
   └─ Concept lane (words → codes) ── small index over Detailed vocabulary
                                      "consultants" → account 634000 "Professional Services"
                                      "911 dispatchers" → "Emergency Communications Officer" titles
                                      "tree planting" → DPW Operations / Forestry units, capital line
                                      → then Structured lane
```

The agent picks lanes by picking tools (`search_budget_text` = narrative lane; `search_budget_lines`/`get_positions` call the concept lane internally before SQL). Most good answers use two lanes: SQL for "how much," narrative for "why," both cited.

## 3. Summary PDF → narrative chunks

### Extraction
- Use `pdftotext` flow mode (not `-layout`) for prose: sentences flow correctly across wrapped lines.
- Flow mode shreds tables into runs of short label lines and number columns. Remove them: drop numeric-dense lines, and drop runs of ≥3 consecutive short label lines. Tables are captured separately with coordinates for the structured lane.
- Drop: front matter (PDF 1–10) except the alderperson list (goes to a table), the footer `2027 PROPOSED PLAN AND EXECUTIVE BUDGET SUMMARY`, page numbers, the TOC, the org chart.
- Summary-table pages (printed 7–24): keep only prose notes (e.g. "Excluding temporary and seasonal staff, the 2027 proposed budget reflects an increase of 26 positions…"); the tables go to SQL.

### Chunking by structure, not token windows
The Summary repeats a template for every department, so chunk boundaries come from the document:

| Section | Chunk rule | Why |
|---|---|---|
| `MISSION:` | 1 chunk | Short, identity of the department |
| `SUMMARY OF SERVICES DELIVERED…` prose | Paragraph-packed to ≤320 words | Overview questions |
| `SERVICE HIGHLIGHTS` bullets | **1 chunk per bullet** (sub-bullets `o` merged into parent); if a department writes prose instead of bullets, pack paragraphs | Each bullet is a distinct initiative; precise citations |
| `CAPITAL PROJECTS` bullets | 1 chunk per project | Name + amount + purpose |
| Budget Introduction (p.1–6) | Paragraph-packed; keep the five-driver list together | The "why" story |
| Source of Funds (p.156–162) | One chunk per revenue subsection (Intergovernmental, Property Taxes, Charges for Services…) | Revenue questions |
| Special Revenue Funds, Capital, Debt, Retirement narratives | Paragraph-packed per fund | |
| Clarification of Intent (p.212) | 1 chunk per paragraph | Legal/process questions |
| Budget Summary / Services / KPI / Position tables | **Not chunked.** One short *table card* per table instead (below) | Numbers live in SQL |

### Chunk record

```json
{
  "id": "department:POLICE DEPARTMENT:service_highlight:1",
  "doc": "summary", "budget_version": "2027-proposed-3rd-run-2026-09-14",
  "pdf_page": 127, "printed_page": 117, "page_end": 117,
  "region": "department", "dept": "police", "section_type": "service_highlight",
  "heading": "SERVICE HIGHLIGHTS", "ordinal": 1,
  "text": "The 2027 budget funds the maximum number of annual classes (3) each at the maximum level of recruits per class (65)…",
  "context_header": "City of Milwaukee 2027 Proposed Budget (Mayor's proposal, not adopted) — Police Department — service highlight — Summary p.117",
  "numbers": ["3", "65"],
  "parent_section_id": "department:police:service_highlight",
  "linked_tables": ["dept_summary:police", "position_changes:police", "kpis:police"]
}
```

- `context_header` is prepended to the text **for embedding and for BM25**, not shown to users. This is contextual retrieval with deterministic context (we know the structure, so no LLM is needed to write it). Optionally add a one-sentence LLM-written context (Haiku-class) for intro and fund chunks, where position in the document carries meaning.
- `dept` is normalized to the same slug the SQL tables use, so a narrative hit can pull its department's numbers.
- `numbers` marks figures that appear in narrative. The grounding guard accepts them only when shown as a cited quote, labeled as the document's wording.

### Table cards (routing chunks)
For each structured table, create one short chunk that describes what the table holds and points to the tool, e.g.:
"Police Department Budget Summary table: 2025 actual, 2026 adopted, 2027 requested and proposed expenditures, FTEs, positions and revenues. Use get_department('police'). Summary p.116."
If retrieval returns a table card, the agent calls the named tool instead of quoting text. This stops the model from reading numbers out of mangled table text.

### Charts
Create a chart card per chart (title, what it shows, page, "underlying data not in the document text"). If the series are later obtained from the Budget office or transcribed and reviewed, they go to SQL and the card points to the tool.

## 4. Detailed PDF → concept index (not RAG)

Chunking 455 pages of BMD-2 forms would give semantic search thousands of near-identical rows ("General Office Expense" appears 75 times). Instead:

1. Parse every row into `line_items` / `position_lines` (docs/02 §3).
2. Build `concepts` from the distinct vocabulary:

```
concepts   id, kind ('account'|'position_title'|'org_unit'|'capital_line'|'revenue_line'),
           label (as printed), code (account no. / org / sbcl), dept_ids[],
           gloss (plain-language description + synonyms), embedding, tsv
```

   - ~216 account descriptions, each with a hand-reviewed gloss and synonyms: *Professional Services — consultants, contractors, outside experts, studies*; *Energy — electricity, natural gas, utilities*; *Vehicle Repair Services — fleet maintenance*.
   - ~1,500 position titles, gloss generated in batch by a Haiku-class model and spot-checked ("Emergency Communications Officer — 911 call-taker/dispatcher").
   - ~500 org/program headings (e.g. "ELDERLY & DISABLED HOUSING", "OFFICE OF THE COMMISSIONER"), linked to their department.
   - Capital and revenue line names from the Detailed capital (43 pages) and revenue listing sections.
3. Query flow: user words → hybrid search over `concepts` (top 5) → the tool filters SQL by the resolved codes/titles → results with Detailed page + line citations. If the concept match is weak or ambiguous, the tool returns candidates and the agent shows `ScopePicker`/`DeptDisambiguator`.

Total index size: ~2,300 small entries. Cheap to embed, fast, precise.

## 5. Linking the two documents

Every narrative chunk and every structured row shares a department slug. Also store the crosswalk:

```
dept_crosswalk  dept_id, summary_pdf_pages int4range, detailed_page_prefix ('300' for Police),
                org_codes text[] ('1510' for Administration), fund_codes text[]
```

This enables answers like "why is Emergency Communications cutting positions?" to combine the position-change reasons (Summary p.80, SQL), the service highlights (narrative), and the line items (Detailed 210.x), all cited.

## 6. Retrieval pipeline (narrative lane)

1. **Filters first.** If the question resolves to a department (aliases table), filter `dept`; if it's about revenue/taxes, filter `region in (source_of_funds, intro)`.
2. **Hybrid search.** Postgres full-text (`tsv` over header + text) and pgvector cosine (Voyage embeddings), top 20 each, merged with reciprocal rank fusion.
3. **Rerank** top 20 → 5 (Voyage reranker or a Haiku-class judge).
4. **Section expansion.** For bullets, also return sibling bullets' titles so the agent sees the whole section; for department questions, the "department dossier" option: load the department's entire narrative (mission + overview + all highlights + capital; typically 1–3k tokens). For a corpus this small, loading the whole section beats top-k fragments.
5. Return `SourceQuotes` data: ≤2 sentences per chunk, with citations and a link to open the page.

**Full-context baseline.** The entire cleaned narrative is ≈55k tokens. For evals, run the same questions with the whole narrative in a cached prompt. If the retrieval pipeline scores meaningfully below this baseline, retrieval is the problem, not the model. Don't ship full-context as the default (cost and latency per question on a public site), but it's the ceiling to measure against.

## 7. When narrative and tables disagree

Narrative figures are often rounded, scoped differently, or framed. Example: the introduction says the proposal cut "about $33.5 million" from requests (p.5), while the General City Purposes table shows $32.1M between requested and proposed (p.8). Rule: the table figure is the primary number, stated with its scope; the narrative figure can appear as a quote attributed to the document ("the budget introduction describes this as about $33.5 million in reductions"). Log every such pair found during P1 review into `budget_facts` with both citations.

## 8. Versioning and the Adopted budget

Chunk ids are stable (`region:dept:section:ordinal`) and every chunk carries `budget_version`. When the Adopted budget arrives, ingest it as a new version, diff chunk text by id to produce "What changed in the narrative," and default retrieval to the version the user is viewing.

## 9. Retrieval evals

From `docs/05-QUESTION-BANK.md`, each narrative question gets expected page(s). Measure recall@5 and MRR for the narrative lane, concept-resolution accuracy for the concept lane ("consultants" → 634000), and compare end-to-end answers with the full-context baseline. Targets: recall@5 ≥ 0.9 on department questions, ≥ 0.8 on cross-cutting questions.

## 10. Prototype status

`pipeline/extract/narrative_chunks.py` runs on the real Summary PDF today and produces 225 chunks. Known gaps for Claude Code to finish in P1.5:
- Normalize `dept` titles to slugs (DPW division titles vary: "DEPARTMENT OF PUBLIC WORKS – INFRASTRUCTURE SERVICES DIVISION").
- Special-revenue-fund pages whose first line isn't the fund name land with `dept = null`; map by page range from the TOC.
- A few departments write highlights as prose with sub-headings (DCD, DPW-ISD, Administration); currently paragraph-packed, which is acceptable, but sub-headings should become `heading`.
- Add `parent_section_id`, `linked_tables`, table cards, chart cards.
- Unit tests: golden chunks (e.g. Police has 18 service-highlight bullets and 3 capital-project chunks on p.117–119).
