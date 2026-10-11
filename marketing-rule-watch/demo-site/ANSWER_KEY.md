# Answer key: Quarrywick Wealth demo site

Quarrywick Wealth and its staff (Odile Ketteridge, CFP; Tomas Wrenfield) are **fictional**. Every page carries the banner "Fictional firm for a hackathon demo. Not a real investment adviser."

- Live site: https://nathanqiu07.github.io/quarrywick-wealth-demo/
- Sitemap: https://nathanqiu07.github.io/quarrywick-wealth-demo/sitemap.xml
- Source: `demo-site/site/` (published copy: https://github.com/nathanqiu07/quarrywick-wealth-demo)

Name check (2026-10-10): the SEC IAPD firm search (`api.adviserinfo.sec.gov/search/firm`) returned 0 hits for "Quarrywick"; a web search for "Quarrywick" found no firm or person. The advisor name "Odile Ketteridge" returned 0 IAPD individual hits and no web results. ("Hartwell Wealth", used earlier, matches a real registered adviser, so it was dropped.)

## Planted issues (11)

Each span is a character-exact substring of the page's visible text (tags stripped). All are plain ASCII with straight quotes.

| # | Page path | Exact planted sentence | Category |
|---|---|---|---|
| 1 | `/index.html` | `Quarrywick Wealth is the most trusted retirement firm in the Pacific Northwest.` | UNSUBSTANTIATED_CLAIM |
| 2 | `/index.html` | `Ranked #2 Wealth Manager by Pemberline Advisor Review.` | RATING_NO_DISCLOSURE |
| 3 | `/about.html` | `Our clients have never lost money in a down year.` | BENEFITS_WITHOUT_RISK |
| 4 | `/services.html` | `Our proprietary process consistently beats the market.` | UNSUBSTANTIATED_CLAIM |
| 5 | `/services.html` | `Our Income Shield program provides guaranteed income for life, so market swings never touch your retirement.` | BENEFITS_WITHOUT_RISK |
| 6 | `/performance.html` | `Since the March 2020 market low, our Core Growth portfolios have gained 151%.` | UNFAIR_PERFORMANCE_PRESENTATION |
| 7 | `/performance.html` | `Our back-tested Tactical Rotation Model would have returned 19% a year from 2004 to 2019.` | HYPOTHETICAL_PERFORMANCE |
| 8 | `/testimonials.html` | `"Odile completely turned our retirement around and we doubled our savings in five years."` | TESTIMONIAL_NO_DISCLOSURE |
| 9 | `/blog/our-best-pick.html` | `Our 2021 pick, Veltrane Semiconductor, tripled in under two years.` | UNBALANCED_SPECIFIC_ADVICE |
| 10 | `/blog/2025-market-recap.html` | `Our Core Growth strategy returned 17.9% gross of fees in 2025.` | GROSS_WITHOUT_NET |
| 11 | `/blog/firm-recognition.html` | `Quarrywick Wealth was named a Top 40 Advisor by Copperfen Wealth Digest.` | RATING_NO_DISCLOSURE |

Per category: UNSUBSTANTIATED_CLAIM 2, BENEFITS_WITHOUT_RISK 2, RATING_NO_DISCLOSURE 2, UNBALANCED_SPECIFIC_ADVICE 1, UNFAIR_PERFORMANCE_PRESENTATION 1, GROSS_WITHOUT_NET 1, HYPOTHETICAL_PERFORMANCE 1, TESTIMONIAL_NO_DISCLOSURE 1.

Page paths are relative to the site root above. Pages with no planted issue: `/fees.html`, `/blog/index.html`.

## Clean content (must NOT be flagged)

- **Risk disclaimer, every page footer:** "Investing involves risk, including possible loss of principal. Past performance does not guarantee future results."
- **Performance disclosures (`/performance.html`):** the paragraph beginning "Past performance does not guarantee future results. Net returns reflect the deduction of the highest advisory fee..."
- **Net-of-fees performance table (`/performance.html`):** Core Growth composite annualized returns for the period ending December 31, 2025, 1/5/10 years, net (11.2% / 8.4% / 7.9%) shown first, gross (12.3% / 9.5% / 9.0%) shown alongside with equal prominence, plus a benchmark row. The gross row is compliant because net is shown next to it.
- **Disclosed testimonial (`/testimonials.html`):** "Tomas answered every question we had about rolling over my 401(k) and never made us feel rushed." from Margaret L., followed by the disclosure that she is a current client, was not paid or otherwise compensated, has no material conflicts, and her experience may not be representative.
- **Full fee schedule (`/fees.html`):** tiered AUM fees (1.00% / 0.75% / 0.60% / 0.45%), a worked example, planning-only fees and other costs.
- **Income Shield description (`/services.html`):** "For clients within five years of retirement, Income Shield sets aside a reserve of conservative holdings to fund near-term spending." (neutral; only the "guaranteed income" sentence is planted).
- **Footer fictional-firm notice and the top banner.**

## Third-party site

**AdvisorQuill** is a fictional advisor-review directory published as a separate GitHub Pages repo on the same account as the firm site (note: `nathanqiu07.github.io/advisorquill/` is the same origin as `nathanqiu07.github.io/quarrywick-wealth-demo/` — a different origin was not achievable with the accounts available). It lists four invented firms — Quarrywick Wealth, Sorrelwood Wealth Management, Tarnworth Advisory Group and Vellbrook Capital — and every page carries the banner "Fictional website for a hackathon demo. Not a real review site."

- Live site: https://nathanqiu07.github.io/advisorquill/
- Quarrywick profile: https://nathanqiu07.github.io/advisorquill/firms/quarrywick-wealth.html
- Sitemap: https://nathanqiu07.github.io/advisorquill/sitemap.xml
- Source: `demo-site/third-party/` (published copy: https://github.com/nathanqiu07/advisorquill)

Name check (2026-10-10): web searches for "AdvisorQuill" returned no real review site or firm with that name; "Sorrelwood", "Tarnworth" and "Vellbrook" matched no advisory firms. Candidate names dropped for colliding with real companies: "Dunamore Capital", "Corvessa", "Marrowgate".

### Planted issues (4)

Each span is a character-exact substring of the page's raw HTML/visible text, plain ASCII with straight quotes. All four are on the Quarrywick Wealth profile.

| # | Page | Exact planted sentence | Category |
|---|---|---|---|
| 1 | `/firms/quarrywick-wealth.html` | `Rated #1 Advisor in the Region by AdvisorQuill.` | RATING_NO_DISCLOSURE |
| 2 | `/firms/quarrywick-wealth.html` | `The firm consistently outperforms the market.` | UNSUBSTANTIATED_CLAIM |
| 3 | `/firms/quarrywick-wealth.html` | `Quarrywick Wealth provides guaranteed income with no investment risk.` | BENEFITS_WITHOUT_RISK |
| 4 | `/firms/quarrywick-wealth.html` | `"Quarrywick doubled our retirement savings in five years."` | TESTIMONIAL_NO_DISCLOSURE |

- #1 sits in an "Awards & recognition" strip with no date, methodology or compensation disclosure anywhere on the page.
- #2 sits in the "Our assessment" editorial paragraph.
- #3 is labeled on the page as "Description provided by the firm".
- #4 is a reviewer quote attributed to "Daniel K." with a star rating and a date only — no client-status or compensation disclosure.

### Clean content (must NOT be flagged)

- Neutral firm description ("About the firm" on the profile): retirement-planning services, fee structure, independent custodian.
- Disclosed testimonial (Sandra M., January 2026): "Odile and her team explain every recommendation in plain language and always get back to us the same day." — immediately followed, inside the same review element, by the disclosure that she is a current client, was not paid or otherwise compensated, has no material conflicts of interest, and her experience may not be representative of other clients. The disclosure is inside that review's `blockquote` only and does not cover the Daniel K. quote.
- Facts table on the profile (founded year, firm-reported AUM, account minimum, fee model, adviser names).
- The three basic listings (`/firms/sorrelwood-wealth.html`, `/firms/tarnworth-advisory.html`, `/firms/vellbrook-capital.html`), the directory home (`/index.html`) and the article (`/articles/quarrywick-retirement-income.html`) contain no planted issues.

These labels are intended test expectations, not a guarantee of what the current detector returns. Note for P4: `eval/cases_demo_site.jsonl` is not extended with these cases — `suite.py site` keys gold by page path, so a third-party `/index.html` case would collide with the firm site's. A separate case file would be needed to eval this origin.
