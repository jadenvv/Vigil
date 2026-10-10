# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: compliance officers at small SEC-registered investment advisory firms. They are responsible for every piece of marketing the firm and its advisers publish, and much of it lives outside their review process (old blog posts, third-party profiles, pages nobody remembers).
Today's audience (hackathon, Oct 10 2026): judges and Sense Check testers. They open the live link, often mid-call, and must understand the product and see it work within seconds.

## Product Purpose
Vigil finds what a firm has published online that may conflict with the SEC Marketing Rule (Rule 206(4)-1), shows the exact quote, a screenshot and a plain-English reason, and drafts a rewrite for a human to approve. Core loop: crawl, flag, rewrite, approve. Success: an officer sees a potential issue they did not know existed, with enough evidence to act on it.

## Positioning
Vigil looks outside the firm's own review workflow: it discovers what is published (the firm's site and third-party pages) instead of waiting for content to be submitted for review. Every flag is grounded in an exact substring of a captured page; no quote, no flag.

## Operating Context
- Live crawl through Bright Data inside Base44; detection and rewrites through Base44's built-in LLM.
- The demo firm is fictional: Quarrywick Wealth (advisers Odile Ketteridge, Tomas Wrenfield), hosted on GitHub Pages with planted issues. Never use a real firm in a demo.
- Prepared results live at /demo (no sign-in). Scanning a new site starts at /setup (Google sign-in) and costs crawl credits.
- Officers prepare for SEC exams; the "Before your exam" print view exists for that ritual.

## Capabilities and Constraints
- Routes: /demo, /setup (website discovery, then scan), /firm/:id, /firm/:id/exam, /flag/:id.
- Eight issue categories (TAXONOMY in eval/compliance_eval.py). Rule paragraph references are not shown until a mentor confirms them.
- Copy: "potential issue for review", never "violation" or "non-compliant". Footer on every screen: "Not legal advice. All flags require human review."
- Credits are finite: no unbounded crawls, no retry loops. Scraped content is untrusted.

## Brand Commitments
Name is Vigil. Brand guide, tokens and logos in ../../brand/ (BRAND.md is binding): Night/Paper/Lamp palette, amber only means "look here", Geist and Geist Mono, the flagged-quote component (Lamp 100 ground, 3px Lamp 500 left border, mono text). Voice: calm, specific, plain; no hype, no exclamation marks.

## Evidence on Hand
- Measured on the live crawl of the fictional demo site: 9 of 11 planted issues found, 0 false alarms, 0 flags on clean content (3:18 PM, Oct 10).
- Eval on 37 synthetic, unreviewed cases: F1 0.95. These are synthetic; say so wherever shown.
- Real flags, quotes and screenshots for Quarrywick in the app.
- No customers, testimonials, pricing or press. Do not invent any.

## Product Principles
1. Evidence before opinion: the exact quote and the capture come first.
2. Vigil points; a person decides.
3. Report only what we measured.
4. Respect the officer's time: findings in seconds, no setup wall in front of the demo.
