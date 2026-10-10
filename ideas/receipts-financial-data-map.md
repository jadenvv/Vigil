# Receipts — a map of every financial number

**Status:** parked idea, saved Oct 10 2026. Not the hackathon build (that's the marketing-compliance scanner). See **TODO** at the bottom.

## The idea

Every number a finance team publishes, in decks, board packs, lender reports, investor updates and filings, comes from somewhere: a cell in a spreadsheet, a query on the accounting system, a calculation across several files. Today that link lives only in an analyst's head. When it breaks, numbers go stale or wrong and nobody can tell which ones to trust.

**Receipts builds the map:** for every number in every document, a recorded "recipe" saying exactly where it comes from and how it's calculated, approved by a person.

Once the map exists:
- **Checking** a new deck is automatic: every number is recomputed from its recipe (🔴 stale, 🟠 mismatch, ✅ verified, ⚪ can't verify).
- **The AI's job shrinks every quarter.** It only proposes recipes for *new* numbers; approved recipes run as plain code. The AI is never trained on the data. What grows is the customer's own map.
- **Every number has a receipt** (file, cell, math, who approved it): an audit trail for reviewers, auditors and regulators.

Hackathon-sized version (stale numbers in quarterly decks): `old/research/05-receipts.md`. Pitch: `old/research/06-pitch.md`.

## What we already know (Oct 10 research)

- **Pain signals:** an FP&A analyst on rebuilding the quarterly deck: "Quite painful and time consuming" (r/FPandA). Finance teams spend 26% of their time checking or fixing AI output; 75% name the missing audit trail as the top barrier to trusting AI (Datarails, Oct 2026). 46% think an AI-made error probably went undetected (Macabacus, Sep 2026). Evidence is thin on how *often* stale numbers actually cause harm.
- **Adjacent tools:**
  - UpSlide AI Consistency Check and Macabacus Deck Check AIR check a deck *against itself*.
  - UpSlide links and Workiva keep *linked* numbers in sync, but Workiva requires moving reporting onto its platform.
  - NotebookLM answers questions with citations but has no per-number map.
  - None found maps typed-in numbers to their sources across documents and periods.
- **Hard part:** mapping real numbers is hard. Many are derived (margins, "adjusted" figures, joins across files, period logic, units, rounding). Not buildable in a day beyond made-up data.

## Moat hypotheses (to test)

1. **The map itself:** each customer's approved recipe map is proprietary, accumulates every quarter, and is painful to rebuild elsewhere (switching cost).
2. **System of record for "where did this number come from":** once auditors and lenders accept receipts as evidence, it becomes embedded in close and reporting workflows.
3. **Cross-customer patterns:** common metric definitions (ARR, adjusted EBITDA, headcount) learned across customers, from approved recipe *structures* rather than customer data, make new customers' mapping faster.
4. **Integration surface:** connectors to ERPs, data warehouses, Excel, PowerPoint and Google Workspace. Defensible only if deep; easy to copy if shallow.

## TODO: investigate startup potential (novel, scalable, existing moat)

- [ ] **Novelty:** compare with data-lineage tools from data engineering (e.g., Atlan, Collibra, Alation, Monte Carlo, dbt lineage). They map warehouse tables, not documents. Does anyone map numbers in *documents* back to sources? Check Workiva, UpSlide, Macabacus, Datarails, Cube, Pigment, Microsoft Copilot (Excel/PowerPoint), Google NotebookLM, and AI audit tools (DataSnipper, Fieldguide).
- [ ] **Pain and frequency:** interview FP&A, controllers, investor relations, bank analysts. How often do stale or wrong numbers ship? What did it cost? Who owns the problem and who would pay?
- [ ] **Wedge vs platform:** is the best entry point quarterly decks, board packs, lender reporting (covenants), or audit tie-out? Which buyer has budget and urgency?
- [ ] **Scalability:** can recipe proposals work on real, messy customer files without heavy services work? Measure mapping accuracy on real decks.
- [ ] **Moat test:** for each hypothesis above, what would stop Workiva, UpSlide or Microsoft from shipping this as a feature? Is the map defensible, or is it a feature?
- [ ] **Data trust:** can the AI propose recipes from labels and headers alone, without seeing confidential values? (Key for enterprise security reviews.)
- [ ] **Market size:** number of FP&A/reporting teams, spend on reporting tools (Workiva revenue as a reference point), pricing model (per seat, per document, per entity).
- [ ] **Decision:** write a go / no-go memo with the evidence.
