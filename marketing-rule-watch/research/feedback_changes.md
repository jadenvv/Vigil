# How we changed in response to feedback

What each tester said, what we changed or plan to change because of it, who owns it, and where it stands. Quotes are verbatim from the Sense Check 1 transcripts (test 6e6a9082, launched 1:55 PM). The raw log is in `sense_checks.md`.

**Status key.** ✅ shipped: on `main` and in the live app. 🟡 partial: some of it ships, and the rest is listed. ⏳ planned: not built yet. Don't mark anything ✅ without a commit or a file path.

**Caveat on the testers.** Neither tester is our target user. Tester A works in compliance at a firm that sounds larger than ours (it has a CTO), and their role wasn't stated. Tester B worked on the regulator side and didn't review their own firm's online content. Their feedback shapes trust and evidence. It doesn't confirm H1 or H2 for small firms. Check 2 targets the compliance officer directly.

## Summary

| ID | What we heard | Change | Owner | Status |
|---|---|---|---|---|
| A1 | Their unreviewed content is employees venting, not firm marketing | Scope wording: "content your firm and its advisers publish or adopt" | P1 (copy) | ⏳ |
| A4 | Examiners use what's online to question the firm | Exam-prep summary of open flags | P2 | ⏳ stretch |
| A5 | Keyword lists miss new wording | Demo a flag with no trigger keyword; show eval vs keyword baseline | P4, P1 | 🟡 |
| A6 | AI must be overseen, audited and carry a disclaimer | Disclaimer on every screen, Decision audit log | P2 | ✅ |
| B1 | Regulators search public ads and follow up | Pitch line: regulators look at the same public pages we scan | P1 | ⏳ |
| B2 | They want the captured ad and a way to re-find it live | Screenshot, capture time, live link on every flag | P2, P3 | 🟡 |
| B3 | Repeated false positives would kill trust | Precision first, one-click Dismiss, honest numbers | P4, P2 | ✅ |
| B4 | Only ads tied to real investment offers, not examples | Skip educational and example text; add an eval case | P4 | ⏳ |
| B5 | Human in the loop at the right points | Nothing auto-publishes; rewrite is a draft until approved | P2 | ✅ |
| B6 | AI is producing more misleading content | Pitch line: AI-written marketing means more to review | P1 | ⏳ |

## Tester A (compliance, role not stated)

### A1. Their unreviewed content is employees venting, not firm marketing

> "Typically, they are employees about... of the firm venting or complaining."

**What we heard.** When Tester A finds content that skipped review, it's usually staff complaining, not firm marketing. Employee venting is not an advertisement under the Marketing Rule, so we shouldn't flag it.

**Change.** Say exactly what we scan: content the firm and its advisers publish, or third-party content the firm adopts. Use that wording in the app's setup screen, the Check 2 description and the pitch. We don't scan or flag personal complaints.

**Owner.** P1 (copy), P2 (setup screen). **Status.** ⏳ planned.

### A4. Examiners use what's online to question the firm

> "oftentimes, an examiner, um, knows things, and they use that information to get additional information about your company that you may not wanna share. So knowing things that are out there, um, are good to know so that you can prepare for an exam question."

**What we heard.** Knowing what's public before the examiner does is useful exam prep in its own right.

**Change.** A one-page "before your exam" summary: every open flag with its quote, page and capture date, ready to review before an examiner asks. Until it's built, the findings inbox serves this purpose, and the pitch says so.

**Owner.** P2. **Status.** ⏳ stretch, after the core loop and the Check 2 fix.

### A5. Keyword lists miss new wording

> "I just don't think any... everything can be caught because people continue to use new words that that aren't part of the the typical lexicon"

> "When you find new things, find new words that mean the same thing, you're just adding to that list of words"

**What we heard.** Their mental model is a word list, and they know word lists fall behind.

**Change.**
- The detector reads meaning, not a word list. We measured this: on 37 synthetic cases, the LLM detector scored **F1 0.95** (precision 0.91, recall 1.00) against **F1 0.70** for a keyword baseline. That is synthetic data, and the slide will say so.
- In the demo, show one flag whose sentence contains none of the usual trigger words.
- A custom word list per firm is a stretch idea only.

**Owner.** P4 (eval, demo example), P1 (slide). **Status.** 🟡 the eval comparison is done (`eval/reports/`); the no-keyword demo example is ⏳.

### A6. AI must be overseen, audited and carry a disclaimer

> "it has to be managed, and there has to be some level of oversight of over AI content."

> "you can ask similar questions using different words, and you can get differing responses even though the response should be the same"

> "if the finance, uh, industry is gonna continue to use AI, it must be overseen. It must be audited, um, and there there must be, um, disclaimer on AI results."

**What we heard.** Three requirements: a human oversees it, there's an audit record, and AI output carries a disclaimer. They also worry about inconsistent answers.

**Change.**
- ✅ Disclaimer on every screen: "Not legal advice. All flags require human review." (`base44/app/src/lib/copy.ts`). Flags say "potential issue", never "violation".
- ✅ Audit log: each approve, edit or dismiss is stored as a Decision with `decided_at` (`base44/app/src/lib/data.js`, `entities/decision.jsonc`).
- ⏳ Consistency: run the same page twice and report how often the flags match. We haven't measured this yet, so we don't claim it.

**Owner.** P2 (audit, disclaimer), P4 (consistency check). **Status.** ✅ oversight, audit log and disclaimer; ⏳ consistency measurement.

## Tester B (regulator side)

### B1. Regulators search public ads and follow up

> "when the advertising department would identify misleading ads, they would request follow-up information. And then if warranted, would subject the firm to an... a regulatory examination, potentially sending examiners on-site."

> "instruct the firm to withdraw the misleading ad... advertising and correct it and or potentially levy a find."

**What we heard.** From the regulator's side: the advertising department finds misleading public ads, requests information, may send examiners, and can order a correction or a fine.

**Change.** Pitch line: "Regulators look at the same public pages we scan. We help the firm see them first." It pairs with the SEC cases in `evidence_bank.md` §2. We don't claim any regulator uses our tool.

**Owner.** P1. **Status.** ⏳ goes into the slides.

### B2. They want the captured ad and a way to re-find it live

> "I would never act on a tool like that without doing additional research, without obtaining the advertisement of the tool, actually captured the ad and surfaced it so I could review the ad, but I would still want to independently verify that I could locate the ad, verify that it was, in fact, legitimately an advertisement that had been posted."

**What we heard.** Two needs: the tool keeps a capture of the ad, and the reviewer can find the ad live themselves.

**Change.**
- ✅ Each flag shows the exact quote, a screenshot captured through Bright Data (opens full size), the capture time, and the source URL as a link that opens the live page (`base44/app/src/pages/FlagDetail.jsx`, `base44/shared/brightdata.ts`).
- ⏳ Show the page hash (`sha256` in the Page contract) so the capture can be shown unchanged.
- ⏳ A "re-check now" button that fetches the page again and says whether the quote is still there.

**Owner.** P2 (UI), P3 (capture). **Status.** 🟡 capture, time and live link shipped; hash and re-check planned.

### B3. Repeated false positives would kill trust

> "I would be doubting the flag if I found that the tool was repeatedly identifying false... having... repeatedly having false positives."

**What we heard.** False positives are the thing that would make them stop trusting the tool.

**Change.**
- ✅ We measure precision on every detector change. Latest run: precision 0.91, and 0% of clean documents flagged (keyword baseline: 28%). Synthetic cases only, and the slide says so.
- ✅ A wrong flag takes one click to dismiss ("Dismiss" in the rewrite drawer), and the dismissal is logged.
- ✅ Grounding filter: a flag is dropped unless its quote appears exactly on the page.

**Owner.** P4 (eval, detector), P2 (Dismiss). **Status.** ✅ shipped.

### B4. Only ads tied to real investment offers, not examples

> "It would need to correlate those to actual investment opportunities so that we were only looking at misleading ads that were pertinent to the field"

> "verify that it was, in fact, legitimately an advertisement that had been posted. It was not a sample of something that somebody was using to illustrate a misleading advertisement"

**What we heard.** Don't flag text that isn't really an ad, like an article that quotes a bad ad as an example.

**Change.** Tell the detector to skip text that is clearly educational or quoted as an example, and add an eval case (an article quoting "guaranteed returns" as a warning) that must produce no flag. Report the eval before and after.

**Owner.** P4. **Status.** ⏳ planned.

### B5. Human in the loop at the right points

> "I think AI is a very valuable tool as long as we have appropriate checks and balances and human in the loop"

> "human in the loop and can ensure that the human validation is occurring at appropriate time periods or spaces within the process so that errors that are entering the AI chain do not compound and build on each other"

**What we heard.** A human checks each step, so one AI mistake doesn't feed the next.

**Change.** ✅ Nothing publishes on its own. Every flag waits for a person, and a suggested rewrite stays a draft until someone approves, edits or dismisses it (`base44/app/src/components/RewriteDrawer.jsx`). A rewrite is only generated when the reviewer asks for one. In the pitch: "the AI suggests, the compliance officer decides."

**Owner.** P2. **Status.** ✅ shipped.

### B6. AI is producing more misleading content

> "Unfortunately, AI in this environment is contributing to the production of misleading information and can be, in fact, making it harder to identify truth from fiction."

**What we heard.** AI is increasing the amount of misleading content.

**Change.** Pitch line: "Advisers now write marketing with AI, so there's more of it to review, and it goes out faster." This is the tester's view, not a statistic, and we'll present it that way.

**Owner.** P1. **Status.** ⏳ goes into the slides.

## Change log

Fill in as changes land: date and time, ID, commit, and the eval before/after if the detector changed. Only list changes that are pushed.

| Time | ID | Commit | Eval before → after |
|---|---|---|---|
| | | | |
