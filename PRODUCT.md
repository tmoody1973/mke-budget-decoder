# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: Milwaukee residents on a phone**, arriving from a news story or social link with one question: "does this affect me?" (my tax bill, my library, my street, 911). They need plain language, personal relevance, and a way to take part (hearings, their alderperson).
- **Secondary: journalists** (newsrooms, public media, community reporters) on deadline: "what's the story, and can I cite this number?" They need exact figures with page citations, the four budget stages side by side, and exportable tables.
- Also: council staff, advocates, students; same needs as journalists, less deadline pressure.

Confirmed by Tarik, 2026-09-23. Personal project of Tarik Moody; not a Radio Milwaukee product.

## Product Purpose

MKE Budget Decoder makes the City of Milwaukee **2027 Proposed Executive Budget** (a 224-page summary and a 455-page line-item book, $2.26B all funds) understandable during the roughly seven weeks between the Mayor's proposal and the Common Council's vote in November. Residents explore it visually, get an estimated City Receipt for their address, and (later) ask questions in plain language. Success: a reporter finds any department's four-stage numbers with a citation in under 30 seconds on a phone; a resident learns what the budget means for their home.

## Positioning

Every number traces to the exact PDF page (and line) it came from, and the numbers come from a reconciled database, never from a language model. The budget is the Mayor's **proposal**, attributed as such, never described as final.

## Operating Context

- Source documents: `data/raw/2027-Proposed-Detailed-Budget.pdf`, `data/raw/2027-Proposed-Plan-and-Executive-Budget-Summary.pdf`; property data from the city's MPROP file (`data/raw/MPROP-Field-Documentation.pdf`).
- Timing: Council budget hearings in October; adoption by November 14. The Adopted budget loads beside Proposed later.
- Four budget stages appear side by side: 2025 Actual, 2026 Adopted, 2027 Requested, 2027 Proposed.
- "The city budget" has several scopes (General City Purposes $846.8M; all funds $2.26B); every total states its scope.

## Capabilities and Constraints

- Stack (decided, CLAUDE.md): Next.js App Router, TypeScript strict, Tailwind, shadcn/ui; Postgres (Neon) + Drizzle; CopilotKit + OpenUI + Mastra for the Ask feature later.
- Explore works without AI (P2); the AI guide (P3) reuses the same components.
- City Receipt (docs/07): address search over MPROP, owner and renter views chosen with "I own this" / "I rent here"; condo buildings fall back to a typed assessed value; exempt and state-assessed properties get no estimate.
- Privacy: owner names and mailing addresses never loaded; typed addresses never logged or stored; lookups rate-limited.
- Undecided: final product name (working name in use); services-per-resident population source.

## Brand Commitments

- Name on screen: **MKE Budget Decoder** (working name).
- Voice: neutral, explanatory, never advocacy. Explains what the documents say; does not argue for or against spending choices, predict Council votes, or call decisions good or bad.
- Not Radio Milwaukee branded. Colors and fonts live as tokens in one place so branding can be swapped later.

## Evidence on Hand

- Reconciled, cited budget data in `data/processed/` (golden numbers G1–G20 pass; human-reviewed 2026-09-23).
- MPROP snapshot of 159,949 parcels, 2026-09-23.
- No testimonials, users, press, or usage numbers exist. Do not fabricate any.

## Product Principles

1. Every number carries a citation to its page; a number without a source isn't shown.
2. Proposed is not adopted: attribute the budget to the Mayor's proposal everywhere.
3. Answer the visitor's question first; methodology and "how it was built" come second, but stay easy to find.
4. Never overclaim: say what the documents don't say (e.g. how much of rent is property tax, what bracketed figures mean).
5. Phone-first and usable by everyone: WCAG 2.1 AA, charts always have a table version, color is never the only signal.

## Accessibility & Inclusion

WCAG 2.1 AA. Charts have text summaries and table fallbacks; color is never the only signal; mobile-first because most residents arrive on a phone. Milwaukee is a majority-renter city, so renters get a truthful receipt too. Spanish is planned for v1.1.
