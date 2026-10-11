# Demo script (~2 min, live)

Talk track for the presenter, matched to the live app at https://marketing-rule-watch-a0747dd2.base44.app/. Run it signed out. The firm is **Quarrywick Wealth, our own fictional demo firm** with planted issues; say so out loud.

Wording rules: say "potential issue for review", never "violation". Use only the numbers below, with their caveats (source: `slide_numbers.md`). There are exactly two tester quotes, both verbatim; don't paraphrase them into something stronger.

**Bold** = what to click. Plain text = what to say.

---

**0:00–0:15 · Home ("/")**
Vigil finds what slipped past review. It's for compliance officers at small investment advisory firms. Today they search the firm's name by hand and use keyword lists. Vigil scans what the firm and its advisers publish and flags potential issues under the SEC Marketing Rule, each with its evidence.

**0:15–0:35 · Scan** the demo firm's URL (signed out) → discovery finds its **10 pages**
This is a fictional firm we built, with issues planted on purpose. Vigil finds the pages and reads each one. *Changed after a tester (A1):* a tester told us the unreviewed content they find is mostly employees venting. So Vigil checks only what the firm and its advisers publish or adopt; it doesn't flag personal posts.

**0:35–0:50 · Open results**
Each potential issue shows a headline, the exact quote and the page. A tester on our second check said: "It's just super easy to to to kinda fly through these."

**0:50–1:10 · Open the flag "Our clients have never lost money in a down year."** (About page, benefits without risk)
No trigger word like "guaranteed". Our keyword baseline missed this sentence; the live detector caught it. *Changed after a tester (B4):* the detector now skips text that only shows an example of what not to say, so a firm's explainer blog isn't flagged. On our 37-case synthetic, unreviewed test set, clean documents wrongly flagged went from **28% with keyword rules to 0% with the live detector**, in one run. That matters because a tester told us repeated false positives would make them doubt every flag.

**1:10–1:30 · Page as captured → Re-check now**
This is the page exactly as we captured it, with the date and its fingerprint. *Changed after a tester (B2):* a regulator-side tester said, "I would still want to independently verify that I could locate the ad". So Re-check now fetches the live page again and says whether the quote is still there.

**1:30–1:45 · Suggest a rewrite** (click once, then wait) **→ Approve**
Vigil drafts new wording only when asked. Nothing is published or changed until a person approves, edits or dismisses it, and every decision is logged with a time.

**1:45–2:00 · Before your exam**
*Changed after a tester (A4):* a tester said examiners use what's online to question the firm. So every open flag goes on one printable page, with its quote, page and capture date, ready before the exam. Every flag is a potential issue for human review, not legal advice.

---

## Facts behind each line (don't read these out)

| Line | Source |
|---|---|
| Keyword missed "never lost money", live caught it | `eval/reports/baseline_regex_demo_site.json` vs `llm_invokellm_demo_site_160443.json`, case `demo_about` (our own fictional site, a dev set) |
| 28% → 0% clean docs wrongly flagged | `slide_numbers.md` section 1: 37 synthetic cases written by us, unreviewed, one run, Base44 InvokeLLM; prompt developed with the cases visible |
| A1 scope copy | `827aaaf` (15:21) |
| A4 "Before your exam" | `73f2363` (15:22) |
| B2 fingerprint + Re-check, Page as captured default | `0308924` (15:48), `d5ae648` (15:56), `d96b386` (17:10) |
| B4 examples not flagged | `af93aa0` (15:22) |
| Quote 1 (Check 1, Tester B) | Substring of the B2 quote in `sense_checks.md` |
| Quote 2 (Check 2, Tester 1) | `check2_summary.md`, point 2 |

All four "changed after a tester" commits were made after the Check 1 quotes were logged (14:21 and 14:42). The screenshot, capture time and live link on each flag were built **before** the call, so don't claim those as changes.

## FALLBACK

- **Sign-in, discovery or the LLM fails** (Scan errors, discovery hangs, "Suggestions unavailable right now"): go to **https://marketing-rule-watch-a0747dd2.base44.app/demo**, which needs no sign-in and already holds the scanned demo firm. Continue from "Open results". If the rewrite suggestion fails, say "the model is unavailable right now", show **Edit**, and type a rewrite by hand.
- **The site is down:** play `research/screenshots/fallback-demo.webm` (to be recorded ~7:00; check the file exists before going on stage).
- **Re-check fails** ("We couldn't reach the live page"): say the captured copy is unchanged and move on. Re-check is cached for 10 minutes per page, so a second press won't fetch again.
