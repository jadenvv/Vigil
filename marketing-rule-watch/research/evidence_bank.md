# Evidence bank: why this problem matters

Public evidence that the problem is real, for the pitch and for mentor conversations. Sources were checked Oct 10 2026. **Keep firm names out of the product and the slides.** In the pitch, name the dollar amounts and the patterns, not the firms.

Tester quotes go in section 6 once Sense Check results arrive. Copy them verbatim from `sense_checks.md`.

## 1. Pitch-ready lines (each one is backed by a row below)

- "The SEC has fined advisers over **one line of website copy**: $75,000 in September 2025 for claiming the firm had no conflicts of interest." (§2)
- "In one day in 2024 the SEC settled with **nine advisers for $1.24M**. The claims were on websites, third-party sites, social media and even a stadium jumbotron." (§2)
- "In December 2025 SEC examiners reported firms whose **marketing went stale**, and whose written policies **didn't cover websites or social media**." (§3)
- "Advisers must keep **a copy of every ad for five years**. That includes every version of the website." (§4)
- "The buyer is tiny: the **median SEC-registered adviser has 8 employees**. The compliance officer usually has other jobs too." (§5)

## 2. The SEC fines firms for the exact language we flag

| Date | What happened | Our category | Source |
|---|---|---|---|
| Sept 4 2025 | One adviser was censured and fined **$75,000** because its website said it refused all conflicts of interest, while its own Form ADV disclosed conflicts. The SEC also cited weak annual compliance reviews that relied on an outdated manual. It was the first Marketing Rule case under the current SEC chair. | `UNSUBSTANTIATED_CLAIM` | [SEC AP summary IA-6916](https://www.sec.gov/enforcement-litigation/administrative-proceedings/ia-6916-s), [Akin Gump](https://www.akingump.com/en/insights/alerts/atkins-led-sec-brings-first-enforcement-action-for-compliance-failures-under-the-marketing-rule) |
| Sept 9 2024 | **Nine advisers, $1.24M total** ($60k–$325k each). The violations sat on public websites, third-party sites, social media, online videos, merchandise and a stadium jumbotron. | several | [Goodwin](https://www.goodwinlaw.com/en/insights/publications/2024/09/alerts-otherindustries-sec-sends-additional-message), [Lowenstein](https://www.lowenstein.com/news-insights/publications/client-alerts/sec-settles-against-nine-investment-advisers-for-marketing-rule-violations-underscoring-the-continued-priority-of-marketing-rule-compliance-im) |
| (same orders) | Claimed "Top 12" in *Barron's* when the ranking was "Top 1200". | `UNSUBSTANTIATED_CLAIM`, `RATING_NO_DISCLOSURE` | Goodwin |
| (same orders) | Claimed membership in a "Fiduciary Firm" organization that doesn't exist. | `UNSUBSTANTIATED_CLAIM` | Goodwin |
| (same orders) | Called the advice "conflict-free" when Form ADV disclosed conflicts. | `UNSUBSTANTIATED_CLAIM` | Goodwin |
| (same orders) | Showed ratings from 2001–2007 with no dates. | `RATING_NO_DISCLOSURE` | Goodwin |
| (same orders) | A "Testimonials" page quoted a *former* client. The SEC treated it as an endorsement that needed different disclosures. | `TESTIMONIAL_NO_DISCLOSURE` | [Lowenstein](https://www.lowenstein.com/news-insights/publications/client-alerts/sec-settles-against-nine-investment-advisers-for-marketing-rule-violations-underscoring-the-continued-priority-of-marketing-rule-compliance-im) |
| Sept 11 2023 | **Nine advisers, $850k total** for hypothetical or backtested performance on their websites. The Enforcement Director said hypothetical ads have "attention-grabbing power" and "may present an elevated risk for prospective investors". Two of the firms were also cited for not keeping copies of their ads. | `HYPOTHETICAL_PERFORMANCE` | [SEC press release 2023-173](https://www.sec.gov/news/press-release/2023-173) |

**Takeaway:** these are not edge cases. They are ordinary sentences on ordinary web pages: "conflict-free", "Top 12", an undated award, a testimonial with no disclosure. Each of them is a category in our taxonomy.

## 3. Examiners are still looking, and the gaps are where we work

| Date | Finding | Source |
|---|---|---|
| Dec 16 2025 | SEC exam Risk Alert on testimonials, endorsements and third-party ratings. It found missing or non-prominent disclosures, including on influencer endorsements, and **unsubstantiated claims caused by failing to update marketing materials**. It also found written policies that **don't cover websites and social media**. | [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/12/sec-exam-staffs-latest-risk-alert-regarding-compliance-with-the-advisers-act-marketing-rule), [Waystone](https://compliance.waystone.com/sec-issues-new-risk-alert-on-marketing-rule-compliance-key-findings-for-investment-advisers/), [Seward & Kissel](https://www.sewkis.com/insights/sec-division-of-examinations-issues-risk-alert-on-investment-adviser-marketing-rule-compliance/) |
| Nov 17 2025 | FY2026 exam priorities. **Honest caveat:** law firms disagree on whether the Marketing Rule is named. Dorsey and WilmerHale say it was dropped from the list. Snell & Wilmer says examiners will still check substantiation and hypothetical performance. The Risk Alert above came out a month later. | [Dorsey](https://www.dorsey.com/newsresources/publications/client-alerts/2025/12/sec-2026-examination-priorities), [WilmerHale](https://www.wilmerhale.com/en/sitecore/content/whlaunch/home/research/news-publications/20251125-sec-division-of-examinations-fiscal-year-2026-priorities-focusing-on-speeding-tickets-not-parking-tickets), [Snell & Wilmer](https://www.swlaw.com/publication/sec-exams-division-announces-2026-exam-priorities/), [White & Case](https://whitecase.com/insight-alert/new-priorities-2026-what-investment-advisers-and-broker-dealers-can-expect) |
| 2021–2023 | Compliance officers named advertising and marketing the **"hottest" compliance topic**: 58% in 2021, 78% in 2022 and 70% in 2023. | [IAA/ACA survey via NAPA](https://www.napa-net.org/news-info/daily-news/sec-marketing-rule-emerges-top-compliance-concern), [ACA](https://www.acaglobal.com/insights/sec-marketing-rule?page=0) |

Don't say "the SEC's #1 priority" in the pitch. Say "examiners issued a Risk Alert on it in December 2025" and "compliance officers rank it their hottest topic."

## 4. Firms have to prove what their ads said, for five years

| Rule | What it says | Source |
|---|---|---|
| Rule 204-2(a)(11) | An adviser must keep a copy of each advertisement it disseminates, directly or indirectly. Since the 2021 amendments this covers **all** advertisements, not just those sent to 10 or more people. | [17 CFR 275.204-2](https://www.law.cornell.edu/cfr/text/17/275.204-2), [Winston](https://winston.com/en/insights-news/sec-unanimously-approves-new-investment-adviser-marketing-rule) |
| Rule 204-2(e)(3)(i) | Advertising records must be kept for **at least five years** from the end of the fiscal year in which the ad was last disseminated, with the first two years in an appropriate office. | [17 CFR 275.204-2](https://www.law.cornell.edu/cfr/text/17/275.204-2) |

**Why this matters for us:** a website is an advertisement that changes without anyone filing a copy. Dated snapshots with a hash are the feature this rule asks for. The rule itself is not legal advice from us; in the pitch, say "advisers are required to keep copies of their ads" and cite the rule.

## 5. The buyer is small and stretched

| Fact | Source |
|---|---|
| The **median SEC-registered adviser has 8 employees** (2025). | [InvestmentNews](https://www.investmentnews.com/goria/practice-management/ria-industry-hits-record-highs-across-the-board-in-2025-as-assets-surge-22/266865) |
| More than half of SEC-registered advisers have fewer than 10 employees. | [IAA statement to the SEC Investor Advisory Committee](https://www.sec.gov/files/barr-iac-statement-030223.pdf) |
| One 2025 order cites annual reviews that were cursory and relied on an outdated manual. That is what a stretched one-person compliance function looks like. | [SEC AP summary IA-6916](https://www.sec.gov/enforcement-litigation/administrative-proceedings/ia-6916-s) |

## 6. Tester evidence (Sense Checks)

_Pending. Check 1 launched today and has no completed calls yet. Paste quotes verbatim from `sense_checks.md` here, each tagged with the hypothesis it supports or kills._

| Check | Tester (role) | Verbatim quote | Hypothesis |
|---|---|---|---|
| 1 | | | |

## 7. How strong is the case for each hypothesis?

| Hypothesis | Public evidence | Strength | What would settle it |
|---|---|---|---|
| **H1.** Risk lives in content published outside the review workflow | 2024 orders cover websites, third-party sites, social media, video and a jumbotron. The 2025 Risk Alert flags stale materials and policies that skip websites and social media. | **Strong** | A tester describing a real unreviewed post (Check 1, Q2) |
| **H2.** Firms can't prove what a page said on a past date | Rule 204-2 requires copies of every ad for five years. Two 2023 firms were cited for not keeping copies, and the 2025 order cites books-and-records failures. No public data says how many firms *can't* produce old page versions. | **Medium**: the duty is proven, the gap is inferred | A tester's answer to "how would you show an examiner what your site said on a past date?" |
| **H3.** Officers won't trust a flag without the exact quote plus a rule reference | None found. | **None yet** | Check 3 ("Would you trust these flags without checking each one?") |

## What we don't claim

- We don't claim our tool would have caught any specific SEC case. We haven't run it on those firms' pages, and we won't scan real firms.
- We don't claim exact rule paragraph references in the UI until a mentor confirms them.
- Penalty totals are the SEC's settled amounts as reported. They are not findings of fact against any firm we name.
