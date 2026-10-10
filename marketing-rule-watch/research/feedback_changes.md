# How we changed in response to feedback

What each tester said, what we changed or plan to change because of it, who owns it, and where it stands. Quotes are verbatim from the Sense Check 1 transcripts (test 6e6a9082, launched 1:55 PM). The raw log is in `sense_checks.md`.

**Status key.** ✅ shipped: on `main` and in the live app. 🟢 merged: on `main`, goes live in the 4:00 deploy (move to ✅ once it's applied). 🟡 partial: some of it ships, and the rest is listed. ⏳ planned: not built yet. Don't mark anything ✅ or 🟢 without a commit or a file path.

Last updated: **3:45 PM**.

**Caveat on the testers.** Neither tester is our target user. Tester A works in compliance at a firm that sounds larger than ours (it has a CTO), and their role wasn't stated. Tester B worked on the regulator side and didn't review their own firm's online content. Their feedback shapes trust and evidence. It doesn't confirm H1 or H2 for small firms. Check 2 targets the compliance officer directly.

## Summary

| ID | What we heard | Change | Owner | Status |
|---|---|---|---|---|
| A1 | Their unreviewed content is employees venting, not firm marketing | Scope wording: "content your firm and its advisers publish or adopt" | P1 (copy), P2 | 🟢 app copy; pitch ✅ |
| A4 | Examiners use what's online to question the firm | Printable "Before your exam" summary of open flags | P2 | 🟢 |
| A5 | Keyword lists miss new wording | Demo a flag with no trigger keyword; show eval vs keyword baseline | P4, P1 | 🟡 eval + slide done; demo pick ⏳ |
| A6 | AI must be overseen, audited and carry a disclaimer | Disclaimer on every screen, Decision audit log, consistency check | P2, P4 | ✅ audit + disclaimer; 🟡 consistency tool built, LLM not measured |
| B1 | Regulators search public ads and follow up | Pitch line: regulators look at the same public pages we scan | P1 | ✅ in slide script |
| B2 | They want the captured ad and a way to re-find it live | Screenshot, capture time, live link on every flag | P2, P3 | 🟡 hash + re-check ⏳ |
| B3 | Repeated false positives would kill trust | Precision first, one-click Dismiss, honest numbers | P4, P2 | ✅ |
| B4 | Only ads tied to real investment offers, not examples | Skip educational and example text; add an eval case | P4 | 🟢 |
| B5 | Human in the loop at the right points | Nothing auto-publishes; rewrite is a draft until approved | P2 | ✅ |
| B6 | AI is producing more misleading content | Pitch line: AI-written marketing means more to review | P1 | ⏳ not in slide script yet |

## Tester A (compliance, role not stated)

### A1. Their unreviewed content is employees venting, not firm marketing

> "Typically, they are employees about... of the firm venting or complaining."

**What we heard.** When Tester A finds content that skipped review, it's usually staff complaining, not firm marketing. Employee venting is not an advertisement under the Marketing Rule, so we shouldn't flag it.

**Change.** Say exactly what we scan: content the firm and its advisers publish, or third-party content the firm adopts. Use that wording in the app's setup screen, the Check 2 description and the pitch. We don't scan or flag personal complaints.
- 🟢 Setup and Inbox show "We check content your firm and its advisers publish or adopt. We don't flag personal posts or complaints." (`827aaaf`, `COPY.scopeNote` in `base44/app/src/lib/copy.ts`, `pages/Setup.jsx`, `pages/Inbox.jsx`). Goes live in the 4:00 deploy.
- ✅ Discover drops personal profiles from search results (`84ad488`).
- ✅ The slide script's feedback table carries it: "We narrowed scope to content the firm publishes or adopts." (`research/slides_script.md`).
- Eval: `cases_tester.jsonl` has an employee-venting clean case (`5e6ac69`) and `cases_scope.jsonl` covers scope (`80d9a18`). Offline rules mode still flags 44% of scope clean cases; LLM mode not measured on that set yet.

**Owner.** P1 (copy), P2 (setup screen). **Status.** 🟢 app copy merged; pitch ✅.

### A4. Examiners use what's online to question the firm

> "oftentimes, an examiner, um, knows things, and they use that information to get additional information about your company that you may not wanna share. So knowing things that are out there, um, are good to know so that you can prepare for an exam question."

**What we heard.** Knowing what's public before the examiner does is useful exam prep in its own right.

**Change.** A one-page "before your exam" summary: every open flag with its quote, page and capture date, ready to review before an examiner asks.
- 🟢 Built: a printable "Before your exam" view, linked from the Inbox (`73f2363`, `base44/app/src/pages/Exam.jsx`). Goes live in the 4:00 deploy.
- ✅ In the slide script's feedback table.

**Owner.** P2. **Status.** 🟢 merged, live at the 4:00 deploy.

### A5. Keyword lists miss new wording

> "I just don't think any... everything can be caught because people continue to use new words that that aren't part of the the typical lexicon"

> "When you find new things, find new words that mean the same thing, you're just adding to that list of words"

**What we heard.** Their mental model is a word list, and they know word lists fall behind.

**Change.**
- The detector reads meaning, not a word list. We measured this: on 37 synthetic cases, the LLM detector scored **F1 0.95** (precision 0.91, recall 1.00) against **F1 0.70** for a keyword baseline. That is synthetic data, and the slide will say so.
- In the demo, show one flag whose sentence contains none of the usual trigger words.
- A custom word list per firm is a stretch idea only.
- ✅ Tester-derived cases (`5e6ac69`, `eval/cases_tester.jsonl`): 4 issues written in non-keyword wording; the keyword baseline catches **0/4** (`reports/baseline_regex_tester.json`). Text written by us from the quotes, not by testers.
- ✅ Harder set (`80d9a18`, `eval/cases_hard.jsonl`): offline rules mode recall 0.36. LLM mode not measured on it yet.
- ✅ The F1 0.70 → 0.95 comparison is on slide 2 of `research/slides_script.md`, labelled synthetic.

**Owner.** P4 (eval, demo example), P1 (slide). **Status.** 🟡 eval comparison and slide done; picking the no-keyword demo flag is ⏳.

### A6. AI must be overseen, audited and carry a disclaimer

> "it has to be managed, and there has to be some level of oversight of over AI content."

> "you can ask similar questions using different words, and you can get differing responses even though the response should be the same"

> "if the finance, uh, industry is gonna continue to use AI, it must be overseen. It must be audited, um, and there there must be, um, disclaimer on AI results."

**What we heard.** Three requirements: a human oversees it, there's an audit record, and AI output carries a disclaimer. They also worry about inconsistent answers.

**Change.**
- ✅ Disclaimer on every screen: "Not legal advice. All flags require human review." (`base44/app/src/lib/copy.ts`). Flags say "potential issue", never "violation".
- ✅ Audit log: each approve, edit or dismiss is stored as a Decision with `decided_at` (`base44/app/src/lib/data.js`, `entities/decision.jsonc`).
- 🟡 Consistency: the tool is built. `eval/consistency.py` (`f090727`) runs the same pages N times against the live endpoint and reports flag agreement, and `eval/suite.py consistency` (`80d9a18`) does the same offline. Rules mode is deterministic (16/16), which says nothing about the LLM. **The LLM run hasn't happened**, so we don't claim a number.

**Owner.** P2 (audit, disclaimer), P4 (consistency check). **Status.** ✅ oversight, audit log and disclaimer; 🟡 consistency tool built, LLM run pending.

## Tester B (regulator side)

### B1. Regulators search public ads and follow up

> "when the advertising department would identify misleading ads, they would request follow-up information. And then if warranted, would subject the firm to an... a regulatory examination, potentially sending examiners on-site."

> "instruct the firm to withdraw the misleading ad... advertising and correct it and or potentially levy a find."

**What we heard.** From the regulator's side: the advertising department finds misleading public ads, requests information, may send examiners, and can order a correction or a fine.

**Change.** Pitch line: "Regulators look at the same public pages we scan. We help the firm see them first." It pairs with the SEC cases in `evidence_bank.md` §2. We don't claim any regulator uses our tool.
- ✅ Slide 1 of `research/slides_script.md` (`21b36e2`): "Meanwhile, regulators search the same public pages."

**Owner.** P1. **Status.** ✅ in the slide script; Gamma deck not built yet.

### B2. They want the captured ad and a way to re-find it live

> "I would never act on a tool like that without doing additional research, without obtaining the advertisement of the tool, actually captured the ad and surfaced it so I could review the ad, but I would still want to independently verify that I could locate the ad, verify that it was, in fact, legitimately an advertisement that had been posted."

**What we heard.** Two needs: the tool keeps a capture of the ad, and the reviewer can find the ad live themselves.

**Change.**
- ✅ Each flag shows the exact quote, a screenshot captured through Bright Data (opens full size), the capture time, and the source URL as a link that opens the live page (`base44/app/src/pages/FlagDetail.jsx`, `base44/shared/brightdata.ts`).
- 🟢 Evidence view shows the page text formatted with the exact quote highlighted (`fcec734`). Goes live in the 4:00 deploy.
- 🟡 Page-as-captured view (the raw HTML the scan stored, quote highlighted) is built but hidden behind `SHOW_PAGE_VIEW=false` (`0a6e10c`, `2d046b6`, `94315f1`). Fixes since: bug F, quotes containing `#`, `>` or `|` didn't match (`9e2f6ba`), and the doubled title bar (`031130a`).
- ⏳ Show the page hash (`sha256` in the Page contract) so the capture can be shown unchanged.
- ⏳ A "re-check now" button that fetches the page again and says whether the quote is still there.

**Owner.** P2 (UI), P3 (capture). **Status.** 🟡 capture, time and live link shipped; as-captured view built but off; hash and re-check planned.

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
- 🟢 `af93aa0`: `engine/postprocess.py` drops a flag whose sentence is framed as an example or as rule education ("a firm might say", "phrases like", "watch out for", "the Marketing Rule prohibits") when the span is quoted or the firm isn't the one speaking. `prompts/detect.md` v3 tells the model the same. JS port mirrored (parity 93 texts, 0 mismatches).
- ✅ Eval: 3 new cases in `cases_tester.jsonl` (written by us, not tester-labelled). Offline rules mode: example/rule-text clean cases flagged **2/2 → 0/2**; the firm's own claim on the same page still caught 1/1; other case sets unchanged.
- 🟢 Base44 copy of the detector updated (`94315f1`). Goes live in the 4:00 deploy, after a preview shows ≥9/11 and 0 false positives on the demo site.
- ⏳ LLM-mode before/after not measured yet.

**Owner.** P4. **Status.** 🟢 merged; live at the 4:00 deploy; LLM eval pending.

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

**Owner.** P1. **Status.** ⏳ not in `research/slides_script.md` yet; add it to slide 1 or cut it.

## Change log

Fill in as changes land: date and time, ID, commit, and the eval before/after if the detector changed. Only list changes that are pushed.

| Time | ID | Commit | Eval before → after |
|---|---|---|---|
| 14:55 | A5, A1 | `5e6ac69` tester-derived eval cases | Keyword baseline: 0/4 non-keyword issues caught, 0/3 clean flagged |
| 14:55 | A1 | `84ad488` discover drops personal profiles | n/a |
| 15:20 | B2 | `fcec734` formatted evidence view with exact highlight | n/a |
| 15:21 | A1 | `827aaaf` scope copy on Setup and Inbox | n/a |
| 15:22 | A4 | `73f2363` printable "Before your exam" view | n/a |
| 15:22 | B4 | `af93aa0` skip examples and rule text (detect.md v3) | Rules mode: example clean cases flagged 2/2 → 0/2; own claim still 1/1; other sets unchanged. LLM not measured |
| 15:23 | A6 | `f090727` consistency.py | Not run against the LLM yet |
| 15:25 | A5, A1, A6 | `80d9a18` suite.py + hard/scope/injection sets | Rules mode: hard recall 0.36, scope clean-FP 44%, deterministic 16/16. LLM not measured |
| 15:27 | B4, B2 | `94315f1` detector v3 into Base44 + raw-HTML capture | Deploy at 4:00 gated on preview ≥9/11, 0 FP |
| 15:27 | B2 | `0a6e10c` page-as-captured view (off) | n/a |
| 15:34 | B2 | `9e2f6ba` bug F: quotes with `#`, `>`, `\|` now match | n/a |
| 15:41 | B1, A1, A4, A6, B2, B3, B4 | `21b36e2` slide script with feedback table | n/a |
