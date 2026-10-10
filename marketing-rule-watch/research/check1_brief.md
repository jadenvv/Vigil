# Sense Check 1 brief

Draft to paste into the Sense Check tool. **Testers hear the description word for word.** Edits are free; launching spends 1 of 3. Confirm with the team before launching.

## TL;DR (for us, not testers)
Small advisory firms publish marketing in places their review process never sees: old blog posts, personal LinkedIn, award pages, third-party profiles. The SEC fines firms for exactly that language. We scan those places, flag possible Marketing Rule problems with the exact quote, keep a dated copy of each page, and draft a rewrite for the compliance officer to approve.

## Description to send (recommended, about 75 words)
> An AI tool for compliance officers at small investment advisory firms. It scans everything a firm has published online, including its website, blog, social posts and third-party pages. It flags language that may conflict with the SEC Marketing Rule, such as guarantees, testimonials without disclosures, outdated awards, or performance numbers without the required context. Each flag shows the exact quote and where it appeared. It keeps dated snapshots of what each page said, and drafts a compliant rewrite for the compliance officer to approve.

Optional context line, appended at the end (it is a fact, not an instruction):
> In September 2024 the SEC fined nine advisers a combined $1.24 million, mostly over claims on their public websites.

## Questions (Hypotheses 1 and 2, open-ended)
1. Walk me through the last time you found something published about your firm that hadn't gone through review. Where was it, and how did you find it?
2. If an examiner asked what your website said on a specific date last year, how would you show them today?
3. What do you do today to check the firm's website, blog and social posts? How long does it take?
4. What would make you trust, or ignore, an automated flag?

## Greenlight version (what we actually send for Check 1)
This frames the call as "should we build this?" Testers hear the description word for word, and instructions get refused, so the framing is stated as a fact about the project, not as a command to the tester.

**Description:**
> This is an early-stage idea that hasn't been built yet. Our team is deciding whether it's worth building. An AI tool for compliance officers at small investment advisory firms. It scans everything a firm has published online, including its website, blog, social posts and third-party pages. It flags language that may conflict with the SEC Marketing Rule, such as guarantees, testimonials without disclosures, outdated awards, or performance numbers without the required context. Each flag shows the exact quote and where it appeared. It keeps dated snapshots of what each page said, and drafts a compliant rewrite for the compliance officer to approve.

**Questions (greenlight first, then H1 and H2):**
1. If this existed today, would you use it? What would make it a must-have rather than a nice-to-have?
2. What would stop you from using it?
3. Walk me through the last time you found something published about your firm that hadn't gone through review. Where was it, and how did you find it?
4. If an examiner asked what your website said on a specific date last year, how would you show them today?
5. What's the one thing it would have to do well for you to tell us "build this"?

**Paste-ready request for Claude Code (once the Sense Check MCP is connected):**
```
Run a sense check on our idea. We want a greenlight on whether to build it.
Description: <the greenlight description above, verbatim>
Who it's for: compliance officers at small SEC-registered investment advisory firms.
Theme: catch what humans miss.
No link or screenshots yet; this is the idea stage.
Questions: <the 5 questions above>
Show me the preview. Do not launch until I say "launch".
```

**How we read the result.** A greenlight means at least 2 of 3 testers describe a real past incident (Q3) or a real gap in proof (Q4), and nobody names a blocker in Q2 that we can't design around. Log the quotes in `sense_checks.md` verbatim.

## Evidence (public sources, checked Oct 10 2026)
Use these for the pitch and the mentor conversation. Keep firm names out of the product and slides.

| Claim | Source |
|---|---|
| Sept 9 2024: SEC settled with **9 advisers, $1.24M total** ($60k–$325k each). The violations sat on public websites, third-party sites, social media, online videos, merchandise and a stadium jumbotron. | [Goodwin summary](https://www.goodwinlaw.com/en/insights/publications/2024/09/alerts-otherindustries-sec-sends-additional-message) |
| Examples from those orders: claiming "Top 12" in *Barron's* when the ranking was "Top 1200"; a claimed membership in a "Fiduciary Firm" organization that doesn't exist; calling the advice "conflict-free" when the firm's Form ADV disclosed conflicts; 2001–2007 ratings shown with no dates. | same |
| Sept 11 2023: **9 advisers, $850k total** for showing hypothetical or backtested performance on their websites. Enforcement Director: hypothetical ads have "attention-grabbing power" and "may present an elevated risk for prospective investors". | [SEC press release 2023-173](https://www.sec.gov/news/press-release/2023-173) |
| Dec 16 2025 SEC exam Risk Alert: missing or non-prominent disclosures on testimonials, endorsements (including influencers) and third-party ratings. Also: unsubstantiated claims caused by **failing to update marketing materials**, and written policies that **don't cover websites and social media**. | [Waystone](https://compliance.waystone.com/sec-issues-new-risk-alert-on-marketing-rule-compliance-key-findings-for-investment-advisers/), [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/12/sec-exam-staffs-latest-risk-alert-regarding-compliance-with-the-advisers-act-marketing-rule), [Smarsh](https://www.smarsh.com/?p=649540) |
| Compliance officers named advertising/marketing the **"hottest" compliance topic**: 58% (2021), 78% (2022), 70% (2023). | [IAA/ACA survey via NAPA](https://www.napa-net.org/news-info/daily-news/sec-marketing-rule-emerges-top-compliance-concern), [ACA](https://www.acaglobal.com/insights/sec-marketing-rule?page=0) |
| The buyer is small: the **median SEC-registered adviser has 8 employees** (2025), and more than half have fewer than 10. | [InvestmentNews](https://www.investmentnews.com/goria/practice-management/ria-industry-hits-record-highs-across-the-board-in-2025-as-assets-surge-22/266865), [IAA statement](https://www.sec.gov/files/barr-iac-statement-030223.pdf) |

**How this maps to our hypotheses**
- H1 (risk lives outside review): the 2024 actions came from websites, third-party pages and social media, and the 2025 alert flags policies that don't cover those channels. **Supported.**
- H2 (can't prove past page content): there is only indirect support. Two of the 2023 firms were also cited for failing to keep copies of their ads. The testers have to confirm this one.
- H3 (needs quote plus rule ref): no public evidence. Check 3 tests it.
