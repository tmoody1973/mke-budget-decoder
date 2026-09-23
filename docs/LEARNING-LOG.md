# Learning log

## 2026-09-22 — P1.3, reading the Detailed budget

**What we expected.** docs/02 described the 455-page line-item book as one fixed form: columns within 2 points on every page, 26 numbered lines, a handful of row types. The plan was to port a parser that already worked on last year's Adopted book.

**What happened.** The form is fixed, but the printing isn't. Thirty pages are stretched sideways. City Treasurer centers its counts under the header. Police's FTE counts are wide enough to spill into the dollars column. Footnote paragraphs run straight through the number columns. Some totals have no account code, or print "6300" for "006300". Summary sheets close with a line that says only "SUMMARY (1BCU=3DU)". Every one showed up as a loud failure or a sum that didn't match, never as a quiet wrong number, because the parser refuses anything it can't place and the tests compare the city's own totals.

**What we now believe.** For a government document, the reconciliation tests are the product and the parser is a draft that has to pass them. The document also has real errors of its own: Transportation's unit total leaves out lines it lists. So "make the test pass" can't mean "loosen the test". It has to mean "record the exact numbers and why".

## 2026-09-23 — Checking our own words, not just our numbers

**What we expected.** The tests already proved every figure in the curated facts and glossary sat on its cited page, so the wording felt covered.

**What happened.** A small judgment model (TypeSafe Jev) read each statement beside its page and flagged "budget gap" as a possible conflict (0.54). The page defines the gap as the cost of continuing current services minus expected revenue; the glossary said department requests minus available money. The numbers were never the problem. The definition was.

**What we now believe.** A number check and a meaning check are different tests, and both are needed. The useful design keeps them apart: code verifies numbers exactly, the model only judges meaning, and anything the model isn't confident about goes to a person.

## 2026-09-23 — The checker needed checking

**What we expected.** Jev's first pass left 6 items for review, and the rest looked settled.

**What happened.** Tarik read all six against the PDF. None was a factual error, but four were problems with the *checker*, not the wording. Every sentence in a passage appeared twice (the page's raw text and our rebuilt text were joined together). Sideways table text came through letter by letter. Two glossary terms cited pages that only *use* the term. And an irrelevant passage could still come back "consistent", which is a false pass. After the fixes, the stricter checker also caught a bad citation (special revenue fund), a definition that wasn't in the document at all, and a sentence I'd added about a table that the cited narrative page can't support.

**What we now believe.** A model's "consistent" is only as good as the passage it was shown. The evidence step has to prove the evidence is there (the term, the figures) before a model is asked anything; otherwise the check can pass things it never looked at. Human review of the first batch is what found this.
