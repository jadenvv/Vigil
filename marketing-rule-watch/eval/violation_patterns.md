# What the SEC actually finds in adviser marketing (public sources)

This is why detect.md v4 weights some patterns over others. It is aggregate public information only. The private SEC-order cases live outside this repo.

**There is no official percentage breakdown.** The SEC publishes risk alerts that list the "most common" observations, and press releases for enforcement sweeps, but no counts by category. Below, "most common" means the SEC's own ordering or wording, not a statistic we computed.

## Exam findings (Division of Examinations risk alerts)
- **Apr 2024 (Additional Observations).** Untrue or unsubstantiated statements of fact are the leading finding:
  - claims to be "free of conflicts"
  - claims about personnel qualifications and about mandates
  - advertising awards or accolades that were never received
  - ratings shown without the firm being the sole or top recipient, or without methodology
  - gross-only performance despite net-of-fee policies
  - undefined benchmark indexes, outdated data and misleading track records
  - Form ADV misreporting
- **Dec 16 2025 (Testimonials, Endorsements, Third-Party Ratings).**
  - Most common: disclosures not given when the testimonial was disseminated.
  - Disclosures that are not clear and prominent: behind hyperlinks, or in small or low-contrast type.
  - Ratings missing the date or period, the rater, or the compensation (logo licensing, reprints, placement fees).
  - No reasonable basis for believing the rating's methodology is fair.
- Earlier alerts: Sept 2022 and June 2023, both on the same themes.

## Enforcement sweeps (settled, neither admitted nor denied)
| Date | Firms | Patterns | Total |
|---|---|---|---|
| Sept 2023 | 9 | hypothetical performance to mass audiences | $850k |
| Mar 18 2024 | 2 | "AI washing": a "first regulated AI financial advisor" claim, AI capabilities and services the firms did not have (SEC 2024-36) | $400k |
| Apr 2024 | 5 | hypothetical performance | $200k |
| Aug 2024 | 1 | hypothetical performance across 23 portfolios | $430k |
| Sept 9 2024 | 9 | untrue or unsubstantiated statements incl. "no conflicts", untrue rating claims, membership in a non-existent organization, testimonials not from clients, undisclosed endorser compensation (SEC 2024-121) | $1.24M ($60k–$325k each) |

Industry survey: in the IMCT/ACA 2023 compliance survey, 70% of respondents named advertising and marketing their hottest compliance topic (78% in 2022). This measures concern, not deficiency rates.

## Our private SEC-order set agrees (counts only)
Gold labels across 24 cases built from public SEC orders, kept in `private-eval-data/`:

| Category | Labels |
|---|---|
| RATING_NO_DISCLOSURE | 16 |
| UNSUBSTANTIATED_CLAIM | 12 |
| TESTIMONIAL_NO_DISCLOSURE | 1 |
| HYPOTHETICAL_PERFORMANCE | 1 |

## What changed in detect.md v4
New definitions and examples were added for:
- no-conflicts claims
- "first" and "only" claims
- AI and tool capability claims
- superlatives about the team
- a rating named in passing (bios, lists, headlines)
- link-only disclosures
- unnamed benchmarks

We did not add examples for awards that were never received, or for memberships in fake organizations: the text alone can't show those, and spotting them needs an outside check.

`cases_generalize.jsonl` (14 cases, 3 clean) was written before v4, from these patterns, in our own words. It is the held-out check that v4 generalizes rather than memorizing the prompt examples. Its labels are `pattern_synthetic` and `reviewed: false`, and `gen_partner_designation` is a label a mentor should check.

## Measured: v3 vs v4 on the generalize set (10-10, ~18:25)
Model: **Groq `openai/gpt-oss-20b`, not 120b.** 120b had hit its 200k tokens/day cap. v3 ran through a wrapper that pins the old prompt; both runs used the same pipeline.

Partway through the v4 run, 20b hit its own daily cap too. Three cases came back as errors and are scored as misses: `gen_testimonial_link_only`, `gen_credentials_claim` and `gen_benchmark_unnamed`. A retry at 18:28 was still capped. The fair comparison is therefore the 11 cases both prompts answered.

| Prompt | Cases | P | R | F1 | tp / fp / fn | Clean flagged |
|---|---|---|---|---|---|---|
| v3 | all 14 | 0.89 | 0.67 | 0.76 | 8 / 1 / 4 | 0 / 3 |
| v3 | same 11 | 0.83 | 0.56 | 0.67 | 5 / 1 / 4 | 0 / 3 |
| v4 | same 11 | 0.88 | 0.78 | 0.82 | 7 / 1 / 2 | 0 / 3 |

- **The whole difference is the two no-conflicts cases** (`gen_conflict_free_about` and `gen_conflict_none_faq`): v3 missed both and v4 caught both. Every other case scored the same under both prompts.
- **Still missed by both:** the capability half of `gen_ai_first`, and `gen_partner_designation`. Both prompts flagged the sponsorship as UNSUBSTANTIATED_CLAIM, while gold says TESTIMONIAL_NO_DISCLOSURE, and that label is the uncertain one.
- **Caveats:**
  - This is 11 cases from one run each, on the smaller model.
  - It is not a reviewed set.
  - The scope (clean-FP), private SEC, hard and injection sets were **not** run on v4. 20b's daily cap was spent, so whether v4 is noisier on educational text is unmeasured.
- Reports: `reports/llm_groq20b_v3_generalize.json` and `reports/llm_groq20b_v4_generalize.json`. The v4 report still holds the 3 error cases, marked `provider: error`.

## Sources
- SEC press releases 2024-36 (AI washing) and 2024-121 (nine-firm sweep), sec.gov
- SEC Division of Examinations risk alerts: Sept 2022, June 2023, Apr 2024, Dec 16 2025
- Law-firm summaries of the alerts and sweeps: Troutman Pepper, Herbert Smith Freehills Kramer, BCLP, Akin Gump, Seward & Kissel, Groom, O'Melveny, Morgan Lewis; plus Confluence, InvestmentNews, Investment Adviser Association, Rethinking65
