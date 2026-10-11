# Demo documents: Quarrywick Wealth cross-document fixtures

Everything in this folder is **fictional**, made for the hackathon demo. Quarrywick Wealth, Quarrywick Insurance Services, Fernhollow Custody Services, Odile Ketteridge and Tomas Wrenfield do not exist. None of these files is a real SEC filing or a real blog post, and none is published on the live demo site.

They exist so the cross-reference detector can check the site's absolute claims against the firm's other documents.

| File | What it pretends to be | URL used by `load.py` |
|---|---|---|
| `form_adv_part2a.md` | The firm's Form ADV Part 2A brochure, dated March 27, 2026 (Items 1–18) | `quarrywick-form-adv-part2a.pdf` |
| `blog_2021_archive.md` | An old blog post by Tomas Wrenfield, March 15, 2021, no longer linked from the site | `https://quarrywick.example/blog/2021/staying-the-course.html` |
| `load.py` | `load_demo_docs() -> list[dict]`: the 10 site pages (from `../site/`, HTML converted to text) plus the two documents above, each `{"url", "channel", "markdown"}` | — |

Site pages load as `https://nathanqiu07.github.io/quarrywick-wealth-demo/<path>` (the live deploy, see `../ANSWER_KEY.md`).

## Planted cross-document contradictions (8)

Every quote is an exact substring of the loaded text (`load_demo_docs()` output) for that page or document. Site pages are under `demo-site/site/`; documents are in this folder.

| # | Site page | Site claim (exact) | Document | Evidence (exact) | Topic |
|---|---|---|---|---|---|
| 1 | `about.html` | `Our clients have never lost money in a down year.` | `form_adv_part2a.md` | `In calendar year 2022, the Core Growth composite returned -12.4% net of fees (-11.5% gross of fees), and most client accounts declined in value during that year.` | Losses / performance |
| 2 | `about.html` | `Our clients have never lost money in a down year.` | `blog_2021_archive.md` | `Nearly every client account we managed ended 2018 with a loss, and our largest decline that year was about 7%.` | Losses / performance |
| 3 | `services.html` | `Our proprietary process consistently beats the market.` | `form_adv_part2a.md` | `The Core Growth composite has underperformed its benchmark, net of fees, in some periods, including calendar years 2019, 2021 and 2025.` | Performance vs benchmark |
| 4 | `services.html` | `Our Income Shield program provides guaranteed income for life, so market swings never touch your retirement.` | `form_adv_part2a.md` | `Income Shield is not an insurance product and does not guarantee income for any period of time, including for life.` | Guarantees |
| 5 | `services.html` | `Our Income Shield program provides guaranteed income for life, so market swings never touch your retirement.` | `form_adv_part2a.md` | `The value of an Income Shield account can decline, and clients participating in Income Shield can lose money.` | Guarantees / risk of loss |
| 6 | `about.html` | `We do not sell insurance products or earn commissions.` | `form_adv_part2a.md` | `Quarrywick Insurance Services, LLC receives commissions on fixed and fixed indexed annuities and life insurance policies that our advisory clients purchase through it, including clients participating in the Income Shield program.` | Conflicts / compensation |
| 7 | `fees.html` | `We are fee-only. We do not earn commissions on any product we recommend.` | `form_adv_part2a.md` | `However, our supervised persons, acting in their separate capacity as licensed insurance agents of our affiliate, may receive commissions for the sale of insurance and annuity products.` | Conflicts / fee-only |
| 8 | `fees.html` | `We do not share in any of these fees.` | `form_adv_part2a.md` | `Under a revenue-sharing agreement, Quarrywick Wealth receives a portion of the shareholder servicing fees that Fernhollow collects from certain no-transaction-fee mutual funds held in client accounts.` | Conflicts / revenue sharing |

Notes:
- Row 3 is also visible on the site itself: the performance table shows a 1-year net return of 11.2% against a 12.0% benchmark.
- `index.html` also calls the firm "a small, fee-only advisory practice"; it is a softer version of row 7 and a detector that flags it with the same evidence is correct.
- `index.html`'s `Quarrywick Wealth is the most trusted retirement firm in the Pacific Northwest.` is an absolute with **no** contradicting evidence in any document. The cross-reference detector should not invent one (it remains a planted UNSUBSTANTIATED_CLAIM for the main detector).

## Deliberate near-misses (consistent; must NOT be flagged as contradictions)

| # | Site page | Site text (exact) | Document | Document text (exact) | Fact |
|---|---|---|---|---|---|
| N1 | `fees.html` | `Next $2,000,000 ($3,000,001 to $5,000,000)` | `form_adv_part2a.md` | `Next $2,000,000 ($3,000,001 to $5,000,000)` | Fee tiers (all four boundaries and rates 1.00% / 0.75% / 0.60% / 0.45% match) |
| N2 | `fees.html` | `A client with $1,500,000 under management would pay $13,750 per year ($10,000 on the first $1,000,000 plus $3,750 on the next $500,000).` | `form_adv_part2a.md` | `a client with $1,500,000 under management would pay $13,750 per year ($10,000 on the first $1,000,000 plus $3,750 on the next $500,000).` | Worked fee example |
| N3 | `fees.html` | `Stand-alone financial plans are $3,500 for an initial plan and $1,500 per year for annual updates.` | `form_adv_part2a.md` | `Stand-alone financial plans are $3,500 for an initial plan and $1,500 per year for annual updates.` | Planning fees |
| N4 | `fees.html` | `(typically 0.05% to 0.30% per year)` | `form_adv_part2a.md` | `(typically 0.05% to 0.30% per year)` | Fund expenses |
| N5 | `fees.html` | `Fees may be negotiable in some circumstances.` | `form_adv_part2a.md` | `Fees may be negotiable in some circumstances, including for related accounts, legacy clients and employees.` | Negotiable fees |
| N6 | `about.html` | `Founded in 2011, Quarrywick Wealth serves about 180 households from a single office.` | `form_adv_part2a.md` | `As of December 31, 2025, we served approximately 180 households.` | Founding year and client count |
| N7 | `about.html` | `Founder and lead advisor.` | `form_adv_part2a.md` | `who serves as the Firm's founder, lead advisor and Chief Compliance Officer.` | Odile Ketteridge, CFP®, role and credential |
| N8 | `about.html` | `Associate advisor.` | `form_adv_part2a.md` | `Tomas Wrenfield serves as an associate advisor.` | Tomas Wrenfield's role |
| N9 | `services.html` | `Our typical client has between $500,000 and $5 million in investable assets.` | `form_adv_part2a.md` | `Our typical client has between $500,000 and $5 million in investable assets.` | Client profile |
| N10 | `services.html` | `For clients within five years of retirement, Income Shield sets aside a reserve of conservative holdings to fund near-term spending.` | `form_adv_part2a.md` | `For clients within five years of retirement, we offer the Income Shield retirement program, which sets aside a reserve of conservative holdings` | Neutral Income Shield description |
| N11 | `about.html` | `Founded in 2011, Quarrywick Wealth serves about 180 households from a single office.` | `blog_2021_archive.md` | `Today we work with about 140 households and manage roughly $150 million.` | Dated figure (2021), not a contradiction of the 2025 count or the ADV's $223,500,000 AUM |
| N12 | `about.html` | `We charge an annual advisory fee based on assets under management, billed quarterly.` | `blog_2021_archive.md` | `1.00% on the first $1,000,000 under management` | Fee tier 1 in 2021 |

Other near-misses worth knowing about, not quoted above: the ADV's `$250,000` minimum is for investment management, while the site's "no formal account minimum" is for financial planning only; the ADV's Item 9 reports no disciplinary history; the ADV's 2022 composite loss (-12.4%) is consistent with the site's 5-year net return of 8.4% (2021–2025).

## Known pre-existing site inconsistency (not planted here)

`blog/2025-market-recap.html` says the Core Growth strategy returned 17.9% gross in 2025, while `performance.html` shows a 1-year gross return of 12.3% for the period ending December 31, 2025. The documents in this folder do not address it.
