# Decisions log

| # | Decision | Why | Revisit if |
|---|---|---|---|
| D1 | Structured-first data, RAG only for narrative | Budget questions are numeric; vector search over tables misquotes numbers | Users mostly ask narrative "why" questions (check logs) |
| D2 | Controlled generative UI: only our components; figures bound via ids/Query, never model literals | Every number must be traceable to a page | — |
| D9 | OpenUI Lang as the answer-composition language, rendered inside CopilotKit chat; CopilotKit keeps agent loop, shared state, HITL, canvas control | Live, composable, editable answers with data bound at render time; tiny shareable Board artifacts; official CopilotKit integration | P3.0 spike shows Claude's Lang is invalid >5% or ungrounded literals slip past lint, or streaming in the CopilotKit slot is janky → fall back to CopilotKit tool-call rendering with the same library |
| D3 | Postgres + pgvector (Neon) over Convex | SQL aggregations (sums, rankings, diffs) plus hybrid search in one store | Realtime collaboration on Boards becomes central |
| D4 | Mastra agent behind CopilotKit via AG-UI | Proven in Budget Compass; typed tools, evals | CopilotKit's built-in agent covers needs with less glue |
| D5 | Fresh repo; port Budget Compass pipeline utilities and MPROP lookup | Different budget stage/year and scope; avoid Nova-specific code | — |
| D6 | No accounts in v1; Boards shared by URL | Lower friction for residents; no personal data stored | Users ask to save many boards |
| D7 | Explore ships before Ask | Useful during hearings even if the agent slips | — |
| D8 | Every table keyed by budget_version | Adopted budget arrives in November | — |

---

## D10 — Column positions are read from each page, not checked against one fixed ruler

**Decision.** The Detailed-budget parser finds each page's columns from that page's own header row and places a number under the header it sits beneath. The ±2-point "every page must match the spec" rule from docs/02 §3 is kept as a warning, not a hard stop.

**Why this came up.** The spec said column positions are identical on every page to within 2 points (a point is 1/72 of an inch). On the real 2027 Proposed PDF that's true for 420 of 450 pages. The other 30 are Emergency Communications (off by up to 7.9 pt), Police (5.3 pt) and the DPW summary (2.0 pt). Those pages are slightly stretched sideways, not just shifted. And City Treasurer prints its position counts centered under the header instead of right-aligned. If we got this wrong, a number could land in the wrong year's column. That's the worst kind of error for this project, because it looks right.

**Options.**
1. *Enforce ±2 pt and stop on failure* (the spec). Honest, but the pipeline can't run at all on 30 real pages.
2. *Use fixed column positions with a wider tolerance.* Runs, but on a stretched page a number near a boundary can be put in the neighbouring column without any error.
3. *Read the columns from each page's own headers* and accept a number only if it sits under a header. Stop loudly if a page has the wrong number of headers, headers out of order, or drift over 10 pt.

**What we chose and why.** Option 3 (Claude, during P1.3; Tarik to confirm). Every number either lines up with a column on its own page or is reported. On the real book, 0 numbers failed to line up and 0 words were left unattached. Pages over 2 pt are listed by a test, so a new stretched page gets noticed.

**What we gave up.** The simple "every page is identical" guarantee. A page that's stretched *and* has a number that sits halfway between two columns would still go to the nearer one. Nothing stops that except the reconciliation sums (P1.8).

**How we'll know if this was right.** The P1.8 reconciliation suite: every decision unit's lines add up to its printed totals, in every year column, including on the 30 stretched pages. A wrong-column number would show up there as a mismatch.

**What actually happened.**

---

## D11 — Every Detailed row is labeled "real money", "summary", or "restated", and only real money is ever added up

**Decision.** The parser tags each Detailed-budget row with a `block`: `decision_unit` (real money, counted once), `bcu_summary` (a department's summary sheet that repeats its own offices), or `restated` (a whole section that repeats money from another section). Queries sum only `decision_unit`. The other two are used as checks.

**Why this came up.** The book tells the same money two or three times. Administration's summary sheet (110.1–110.2) restates its ten offices. Section 420 restates the whole $846.8M General City Purposes budget. Sections 450–470 restate lines of 440. A tool that adds up "every salary row for Administration" would roughly double the answer and show it with confidence.

**Options.**
1. *Drop the summary rows at extraction.* Simple, but it throws away the city's own totals, which are the best way to check the parser.
2. *Keep everything and trust query authors to filter.* Every future query is one forgotten filter away from a doubled number.
3. *Keep everything, label every row, check summary = sum of offices in tests, and sum only real money by default.*

**What we chose and why.** Option 3. Tarik's call in the Socratic stop: "use the summary as a validation of the total and never use summary in the front end". Claude added the row label that makes that rule enforceable, since the book doesn't print it. On the real book the check passes for 11 summary sections × 6 kinds of total × 4 year columns. The two exceptions are verified errors in the document (Transportation 510, below).

**What we gave up.** Labeling depends on reading where a summary ends. That took several rules: explicit "BCU/DECISION UNIT" wording, or a line whose numbers equal its categories added up. A new layout next year could fool it. The tests would catch that as a mismatch but can't fix it.

**How we'll know if this was right.** `validate/test_bcu_blocks.py` stays green on the Adopted budget in November without new rules. In P2, department totals built from `decision_unit` rows equal the Summary book's department totals (P1.8 cross-document check).

**What actually happened.**

---

## D12 — A small judgment model checks that our written statements match their pages; code still checks every number

**Decision.** TypeSafe's Jev model (`jev-1.13.0`, pinned) reads each hand-written fact and glossary definition beside the passage it cites and returns a typed verdict: *supports / contradicts / says nothing* for facts, and a probability of *conflict* for glossary terms. Low-confidence verdicts go to a person. Results are stored and committed, so CI checks them without calling the API.

**Why this came up.** The pipeline already proves every **number** in a curated statement appears on its cited page. That's a plain text match. It couldn't tell whether the **sentence around the number** says what we claim. Reading 56 statements against their pages by hand is slow, and it's the kind of check people skim.

**Options.**
1. *Human review only.* Most trustworthy per item, but it's the step most likely to be rushed or skipped.
2. *A general chat model writes a critique.* Flexible, but it returns prose that code can't act on, costs more per call, and can argue itself into anything.
3. *A judgment model returning typed answers with calibrated confidence* (Jev), with code keeping all arithmetic, as TypeSafe's own docs recommend.

**What we chose and why.** Option 3 (Tarik chose Jev; Claude designed the split). Code picks the few sentences around each statement's figures, and Jev judges meaning only. The first run cost about $0.002 for 56 checks and took 13 seconds. It caught a real error: my glossary defined "budget gap" as department requests minus available money, but the budget itself defines it as the cost of **continuing current services** minus expected revenue. After the fix, the conflict probability fell from 0.54 to 0.09.

**What we gave up.** Another vendor and API key in the loop (for the checking step only; nothing user-facing depends on it). Jev's verdict is a judgment, not proof, so a "verified" statement can still be subtly wrong. The 0.8 confidence bar is the cookbook's starting point, not one tuned on budget text.

**How we'll know if this was right.** When Tarik reviews the 6 queued items and spot-checks some of the auto-accepted ones, Jev's auto verdicts should agree with his. If it misses things a person catches, raise the bar or drop the step.

**What actually happened.**

---

## D13 — A second, independent PDF reader re-finds every extracted row in CI

**Decision.** `validate/bbox_crosscheck.py` (ported from the 2026-09-23 external review) reads the PDFs a second way, with poppler's `pdftotext -bbox` word positions instead of the pipeline's pdfplumber, and must re-find every extracted row's values on its cited page. 31 known checker limitations are allowlisted, each with a reason. The test fails on any new unmatched row **and** on any allowlisted row that starts matching.

**Why this came up.** The review found two rows stored blank (Retirement, Summary p.163) while all 483 tests passed. Every test compared the pipeline's output with itself or with the city's printed totals, and all of them read the page through the same parser. A parser's blind spot is invisible to tests built on that parser.

**Options.**
1. *Only add the missing sum check.* It would have caught this bug, but only bugs that break a total.
2. *Human spot-check only.* Good, but slow, and it covers a sample.
3. *A second extractor on every row*, plus the sum check.

**What we chose and why.** Options 1 and 3 together (the review proposed the cross-check; Tarik brought it in; Claude ported it and added the block-sum test). Both were red-proofed: putting the original bug back makes the block-sum test fail by exactly the two missing rows ($505,390), and changing one stored value by $1 makes the cross-check name that row.

**What we gave up.** The two readers disagree on 31 rows for layout reasons, and those need an allowlist someone has to keep honest. The cross-check adds poppler to CI and about 6 seconds.

**How we'll know if this was right.** In November, the Adopted budget load should produce either zero new cross-check failures or failures that are real extraction bugs, not new layout noise.

**What actually happened.**

---

## D14 — The database is reloaded as a whole, one budget version at a time, inside one transaction

**Decision.** `pnpm db:load` (scripts/load.ts) deletes every row belonging to the budget version and inserts the extracted data fresh, all inside one database transaction. It reads the committed data files directly, and Drizzle's typed schema checks every row on the way in.

**Why this came up.** The data is rebuilt from the PDFs whenever the parser improves (the review fixes changed several tables). A loader that updates rows in place has to know which rows changed, and can leave stale rows behind when a row disappears (e.g. a page footer that used to be stored as a row, B5).

**Options.**
1. *Update in place (upsert).* Keeps row ids stable, but needs a natural key for every table and still needs a separate delete pass for vanished rows.
2. *Delete-and-reload the version in one transaction.* Simple and always matches the files exactly. Ids change on every load.
3. *Load into a new version each time and switch a pointer.* Keeps history, but adds version bookkeeping we don't need before November.

**What we chose and why.** Option 2 (Claude). The first real run proved the safety property: a duplicate chunk id failed the load on the last table, and the database was left untouched. The same run found a real chunker bug. A second full load was verified to create no duplicates.

**What we gave up.** Row ids aren't stable across loads, so nothing outside the database should store them. Shared Boards (P4) must reference rows by citation (page + line) or by natural keys, not by id. A reload takes ~10 seconds, during which readers see the old data (the transaction hides the partial state).

**How we'll know if this was right.** When the Adopted budget arrives in November it loads as a second version beside Proposed without touching Proposed's rows, and `lib/db/load.test.ts` passes for both.

**What actually happened.**

## D15 — The first screen answers the visitor's question, and the address-based tax receipt ships in P2

**Decision.** The Overview page reads top to bottom: a one-line framing with cited totals; question buttons drawn from news highlights and the question bank (each opens the Explore view that answers it; in P3 the same buttons become chat prompts); a City Receipt box where a resident types an address; a small dashboard of charts, each with a table version and citation chips; the department list; and a footer with how to use it, how it was built, and related stories. The address lookup against MPROP (the city's Master Property File, one row per parcel with its assessed value) moves from v1.1 into P2.

**Why this came up.** Most visitors arrive on a phone from a news story, holding one question, usually "does this affect me?" The honest answer to "are my taxes going up?" depends on each home's assessed value: the city levy rises about 2% while the rate falls from $7.61 to $7.29. A page that opens with methodology or a list of stories makes them scroll past the answer.

**Options.**
1. *Assessed-value box now, address lookup in v1.1 (the PRD's plan).* Small; ships before the October hearings; but residents must know their assessed value.
2. *Address lookup in P2.* Residents just type where they live; renters get a receipt too (docs/07). Costs MPROP handling for ~160,000 parcels, renter/condo/multi-unit cases, frontage defaults, and the privacy and rate-limit rules in docs/07 §8.
3. *No receipt in P2.* Fastest; leaves the most common question unanswered.

**What we chose and why.** Option 2 (Tarik). The receipt is the feature residents will actually use, and Budget Compass already proved the MPROP lookup works. Page order (Tarik and Claude, worked through Socratically): answer first, trust material second.

**What we gave up.** P2 grows by the receipt work, so the Explore release is more likely to land after the start of the October hearings, which is when the tool matters most. Budget Compass's lookup code is not ported as-is: it builds its database query by pasting the typed address into SQL text (an injection risk), so only its address-parsing approach carries over.

**How we'll know if this was right.** The two worked examples in docs/07 §4 pass to the cent; a test proves no owner name or mailing address reaches any response; and P2 ships a working address receipt before the Council's budget hearings end.

**What actually happened.**

## D16 — The site looks like an almanac table: the "Blue Book Table" design

**Decision.** The app's look is modeled on the Wisconsin Blue Book's statistical tables. White paper, navy ink and one blue used only for sources and links. Figures in ruled columns, in Libre Franklin (an open version of Franklin Gothic, the face American almanacs used). Every rate carries a numbered source, and every assumption a lettered note. No cards, shadows or rounded boxes. The full rules are in `DESIGN.md`.

**Why this came up.** The project had no design at all, only the Next.js starter page. The first screen people see (the City Receipt) needed one. Civic budget tools tend to look like one of two things: a generic dashboard, or a government form. Tarik ruled out anything that feels like a fintech ad, a government form, a campaign or a toy.

**Options.**
1. *Milwaukee sign-painter's window* (dealt at random by the design tool): lettered like a corner-store price board. It's distinctive and local, but hand lettering can tip into nostalgic or cute.
2. *Blue Book Table*: exact, footnoted and trusted. The risk is that it's the closest option to the "government form" feel.
3. *Nixie-tube counter*: glowing digits on a dark panel. Very clear numbers, but it reads as a gadget, not civic life.
4. *The category standard*: an open-budget dashboard. Safe, but it looks like every other one.

**What we chose and why.** Option 2 (Tarik, on the design decision page). It matches the product's core promise: every number has a source. To keep it from becoming a government form, it's built with roomy rows, plain words and one table doing all the work (Claude).

**What we gave up.** A more memorable, Milwaukee-specific look (options 1 and 3). Almanac tables also get dense fast on a phone, so labels had to be shortened to stay at two lines or fewer. Two shortened labels: "Sewer + stormwater" and "Snow & ice and lighting (40 ft)".

**How we'll know if this was right.** A resident on a phone finds their estimate and taps through to a source without instructions. Nobody testing it calls it "a government form".

**What actually happened.**

## D17 — News coverage is shown next to the budget's own figures, never as data

**Decision.** The site links to news coverage by topic and, in a later step, lines up specific news figures against the budget pages with neutral labels (Matches the budget / Rounded / Not in the budget documents / Different measure). Articles appear as headline, outlet, date and link only. Every label is reviewed by Tarik before publication. Plan: `docs/09-NEWS-AND-CIVIC.md`.

**Why this came up.** Residents meet the budget through news stories first. Those stories are the questions people arrive with ("roads, roads, roads", parking fees, police classes) — but a few of their figures do not match the documents as extracted (for example a reported "3% property tax increase" against a city levy up 2.0% with a falling rate).

**Options.**
1. *Ignore coverage.* Simplest; misses the questions people actually have.
2. *Summarize articles in our own words, figures included.* Friendly, but it launders unverified figures into a tool whose promise is "every number traced to its page."
3. *Link coverage by topic and set its specific figures beside the budget's, with reviewed neutral labels.* More work; keeps the promise and serves journalists.

**What we chose and why.** Option 3 (Tarik, 2026-09-23), headline-and-link only, labels human-reviewed. It turns the coverage into entry points without letting any unverified figure look like budget data.

**What we gave up.** Speed (each label needs a human check) and some friendliness (no pull quotes). A label like "Not in the budget documents" can read as criticism of an outlet even when the figure came from an interview; the wording must stay descriptive.

**How we'll know if this was right.** Reporters cite the site's page references; no outlet objects to how its story is represented; no label has to be withdrawn.

**What actually happened.**

## D18 — The City Receipt gets its own color and a shareable receipt picture

**Decision.** The receipt lookup sits in a marigold frame on a sheet of receipt paper, and a finished estimate can be saved or shared as a 1080×1350 picture drawn like a store receipt, with the app's link at the bottom. The picture leaves out the address and the assessed value.

**Why this came up.** Tarik: the receipt section should "pop with some color", and the result should be something people post on Instagram, LinkedIn and X. The site's design rules allowed only one accent color, and a shared picture of a home's tax figures could tell strangers where someone lives and what the house is worth.

**Options.**
1. *Keep the navy-on-white look; add a plain "download" of the table.* Consistent, but nobody posts a table.
2. *Marigold frame plus a receipt-style picture without the address.* Stands out in a feed and on the page; breaks the one-accent rule in one named place.
3. *Same, with the full address printed.* Feels most like a real receipt; publishes a home's location and value to anyone who sees the post.

**What we chose and why.** Option 2 (Tarik chose "no address" and one 4:5 size; Claude chose marigold and the frame-around-paper layout). The picture is redrawn on the server from the same request as the on-screen receipt, so it can't show a number the screen doesn't, and nobody can make a fake one by editing a link.

**What we gave up.** Design purity: there are now two accent colors. The picture carries no clickable source marks, only a line of page numbers. Without an address, a posted receipt can't be checked by a stranger.

**How we'll know if this was right.** People share the picture (visible as visits from social links), nobody asks us to take one down for privacy, and nobody mistakes it for a real tax bill.

**What actually happened.**
