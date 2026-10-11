# How we changed in response to feedback

What each tester said, what we changed or plan to change because of it, who owns it, and where it stands. Quotes are verbatim from the Sense Check 1 transcripts (test 6e6a9082, launched 1:55 PM). The raw log is in `sense_checks.md`.

**Status key.** ✅ shipped: on `main` and in the live app. 🟢 merged: on `main`, goes live in the 4:00 deploy (move to ✅ once it's applied). 🟡 partial: some of it ships, and the rest is listed. ⏳ planned: not built yet. Don't mark anything ✅ or 🟢 without a commit or a file path.

Last updated: **4:55 PM**. The 4:00 deploy is live (detector v3, recheck, page-as-captured, `c426b08`), so its 🟢 items are now ✅. Check 2 rows (C1–C5) come from test bf380ee1, Tester 1.

**Caveat on the testers.** Neither tester is our target user. Tester A works in compliance at a firm that sounds larger than ours (it has a CTO), and their role wasn't stated. Tester B worked on the regulator side and didn't review their own firm's online content. Their feedback shapes trust and evidence. It doesn't confirm H1 or H2 for small firms. Check 2 targets the compliance officer directly.

## Summary

| ID | What we heard | Change | Owner | Status |
|---|---|---|---|---|
| A1 | Their unreviewed content is employees venting, not firm marketing | Scope wording: "content your firm and its advisers publish or adopt" | P1 (copy), P2 | ✅ app copy and pitch; ⏳ LLM not measured on the scope set |
| A4 | Examiners use what's online to question the firm | Printable "Before your exam" summary of open flags | P2 | ✅ |
| A5 | Keyword lists miss new wording | Demo a flag with no trigger keyword; show eval vs keyword baseline | P4, P1 | ✅ eval (live: tester set 0/5 → 5/5), slide, demo pick; ⏳ LLM not run on the hard set |
| A6 | AI must be overseen, audited and carry a disclaimer | Disclaimer on every screen, Decision audit log, consistency check | P2, P4 | ✅ audit + disclaimer; ✅ consistency measured live: 2/3 pages identical, 3/3 same categories (3 pages × 2 runs) |
| B1 | Regulators search public ads and follow up | Pitch line: regulators look at the same public pages we scan | P1 | ✅ in slide script; ⏳ Gamma deck |
| B2 | They want the captured ad and a way to re-find it live | Screenshot, capture time, live link, hash, re-check, page-as-captured, page history | P2, P3 | ✅ hash, re-check, page-as-captured; 🟢 page history on `main` (`7806cb3`), live after next deploy |
| B3 | Repeated false positives would kill trust | Precision first, one-click Dismiss, honest numbers | P4, P2 | ✅ live: clean docs flagged 28% → 0% |
| B4 | Only ads tied to real investment offers, not examples | Skip educational and example text; add an eval case | P4 | ✅ live in detector v3; ⏳ LLM not run on the scope set |
| B5 | Human in the loop at the right points | Nothing auto-publishes; rewrite is a draft until approved | P2 | ✅ |
| B6 | AI is producing more misleading content | Pitch line: AI-written marketing means more to review | P1 | ✅ in slide script |
| C1 | Manual review takes "shortcuts" and loses the "global view"; adviser and off-site pages get skipped | Pitch: Vigil covers the pages a person skips. Product: discovery already finds adviser, press and third-party pages | P1 | ✅ in slide script (`1d99a30`) |
| C2 | The quoted snippet and confidence % make flags quick to triage | Keep quote + confidence on every inbox row. Don't claim the % is calibrated | P2, P4 | ✅ already shipped; ⏳ calibration not measured live |
| C3 | "I can't go beyond this page" (likely missed the flag detail view on `/demo`) | Make inbox rows look clickable (whole row link, "Review →" cue) | P2 | ⏳ not started; P2 not told yet |
| C4 | No answer on demand: Sense skipped the SEC evidence and the "which customer / problem" question | Check 3 asks it directly via `team_question` | P1 | ⏳ Check 3 not drafted |
| C5 | "you have to double check work, but that would typically be done with people anyway" | None needed: confirms B5 (a person approves every flag) | — | ✅ |

## Tester A (compliance, role not stated)

### A1. Their unreviewed content is employees venting, not firm marketing

> "Typically, they are employees about... of the firm venting or complaining."

**What we heard.** When Tester A finds content that skipped review, it's usually staff complaining, not firm marketing. Employee venting is not an advertisement under the Marketing Rule, so we shouldn't flag it.

**Change.** Say exactly what we scan: content the firm and its advisers publish, or third-party content the firm adopts. Use that wording in the app's setup screen, the Check 2 description and the pitch. We don't scan or flag personal complaints.
- 🟢 Setup and Inbox show "We check content your firm and its advisers publish or adopt. We don't flag personal posts or complaints." (`827aaaf`, `COPY.scopeNote` in `base44/app/src/lib/copy.ts`, `pages/Setup.jsx`, `pages/Inbox.jsx`). Live since the 4:00 deploy.
- ✅ Discover drops personal profiles from search results (`84ad488`).
- ✅ The slide script's feedback table carries it: "We narrowed scope to content the firm publishes or adopts." (`research/slides_script.md`).
- Eval: `cases_tester.jsonl` has an employee-venting clean case (`5e6ac69`) and `cases_scope.jsonl` covers scope (`80d9a18`). Offline rules mode still flags 44% of scope clean cases; LLM mode not measured on that set yet (⏳, quota).

**Owner.** P1 (copy), P2 (setup screen). **Status.** ✅ app copy live and pitch; ⏳ LLM run on the scope set.

### A4. Examiners use what's online to question the firm

> "oftentimes, an examiner, um, knows things, and they use that information to get additional information about your company that you may not wanna share. So knowing things that are out there, um, are good to know so that you can prepare for an exam question."

**What we heard.** Knowing what's public before the examiner does is useful exam prep in its own right.

**Change.** A one-page "before your exam" summary: every open flag with its quote, page and capture date, ready to review before an examiner asks.
- 🟢 Built: a printable "Before your exam" view, linked from the Inbox (`73f2363`, `base44/app/src/pages/Exam.jsx`). Live since the 4:00 deploy.
- ✅ In the slide script's feedback table.

**Owner.** P2. **Status.** ✅ live.

### A5. Keyword lists miss new wording

> "I just don't think any... everything can be caught because people continue to use new words that that aren't part of the the typical lexicon"

> "When you find new things, find new words that mean the same thing, you're just adding to that list of words"

**What we heard.** Their mental model is a word list, and they know word lists fall behind.

**Change.**
- The detector reads meaning, not a word list. We measured this: on 37 synthetic cases, the live LLM detector (v3, Base44 InvokeLLM, `cabebb3`) scored **F1 0.98** (recall 21/21, 1 false positive) against **F1 0.70** for a keyword baseline. That is synthetic data, and the slide will say so. (An earlier run gave 0.95.)
- In the demo, show one flag whose sentence contains none of the usual trigger words.
- A custom word list per firm is a stretch idea only.
- ✅ Tester-derived cases (`5e6ac69`, `eval/cases_tester.jsonl`): issues written in non-keyword wording; the keyword baseline catches **0/4** (`reports/baseline_regex_tester.json`). Live LLM on the 10-case tester set: **5/5 caught, 0/5 clean flagged** (keyword: 0/5, 2/5). Text written by us from the quotes, not by testers.
- ✅ Harder set (`80d9a18`, `eval/cases_hard.jsonl`): offline rules mode recall 0.36. ⏳ LLM mode not measured on it yet (quota).
- ✅ The keyword-vs-LLM comparison is on slide 2 of `research/slides_script.md`, labelled synthetic.

- ✅ Demo flag picked: demo-site #3 on `/about.html`, "Our clients have never lost money in a down year." (BENEFITS_WITHOUT_RISK). It has no trigger word. The keyword baseline misses it and flags the footer disclaimer "guarantee future results" instead (`reports/baseline_regex_demo_site.json`, case `demo_about`). The live LLM crawl at 3:18 caught it (its 2 misses were #6 and #8). Backup: #1, "the most trusted retirement firm in the Pacific Northwest", which the keyword list also misses.
- ✅ Slide 2 pairs it with Tester A's word-list quote ("you're just adding to that list of words").

**Owner.** P4 (eval, demo example), P1 (slide). **Status.** ✅ eval, slide and demo pick. Re-check #3 is still caught after the 4:00 deploy.

### A6. AI must be overseen, audited and carry a disclaimer

> "it has to be managed, and there has to be some level of oversight of over AI content."

> "you can ask similar questions using different words, and you can get differing responses even though the response should be the same"

> "if the finance, uh, industry is gonna continue to use AI, it must be overseen. It must be audited, um, and there there must be, um, disclaimer on AI results."

**What we heard.** Three requirements: a human oversees it, there's an audit record, and AI output carries a disclaimer. They also worry about inconsistent answers.

**Change.**
- ✅ Disclaimer on every screen: "Not legal advice. All flags require human review." (`base44/app/src/lib/copy.ts`). Flags say "potential issue", never "violation".
- ✅ Audit log: each approve, edit or dismiss is stored as a Decision with `decided_at` (`base44/app/src/lib/data.js`, `entities/decision.jsonc`).
- ✅ Consistency: `eval/consistency.py` (`f090727`) runs the same pages N times against the live endpoint. Live run (`cabebb3`, 3 pages × 2 runs): **2/3 pages gave identical flags, 3/3 gave the same categories**. Small sample; we say so.

**Owner.** P2 (audit, disclaimer), P4 (consistency check). **Status.** ✅ oversight, audit log, disclaimer and a measured consistency number.

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
- ✅ Evidence view shows the page text formatted with the exact quote highlighted (`fcec734`).
- ✅ Page-as-captured view (the raw HTML the scan stored, quote highlighted), built in `0a6e10c`, `2d046b6`, `94315f1`, now on (`SHOW_PAGE_VIEW = true`, `8978dd3`). Fixes since: bug F, quotes containing `#`, `>` or `|` didn't match (`9e2f6ba`), and the doubled title bar (`031130a`).
- ✅ Page hash shown on flag detail (`0308924`).
- ✅ "Re-check now" fetches the page again and says whether the quote is still there (`0308924`, `d5ae648`; capped at one live fetch per page per 10 min). Page-as-captured view turned on (`8978dd3`).
- 🟢 Page history with diff and as-of date (`7806cb3`), on `main`, live after the next deploy.

**Owner.** P2 (UI), P3 (capture). **Status.** ✅ capture, hash, re-check, as-captured view; 🟢 page history.

### B3. Repeated false positives would kill trust

> "I would be doubting the flag if I found that the tool was repeatedly identifying false... having... repeatedly having false positives."

**What we heard.** False positives are the thing that would make them stop trusting the tool.

**Change.**
- ✅ We measure precision on every detector change. Latest live run (`cabebb3`): 0% of clean documents flagged (keyword baseline: 28%), 1 false positive across 37 synthetic cases, and 0/5 clean flagged on the tester set. Synthetic cases only, and the slide says so.
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
- ✅ Base44 copy of the detector updated (`94315f1`), live since the 4:00 deploy (demo site 11/11, 0 false positives; dev set).
- ✅ Live LLM on the tester set, which includes the example cases: clean flagged 2/5 → 0/5 (`cabebb3`).
- ⏳ LLM run on the larger scope set not done (quota).

**Owner.** P4. **Status.** ✅ live; ⏳ scope-set LLM run.

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

- ✅ Slide 1 of `research/slides_script.md`: "And the volume is growing", with the quote verbatim and attributed to the former regulator tester. It argues why now: AI-written marketing outpaces a weekly search, so we use AI to review it and a person decides.

**Owner.** P1. **Status.** ✅ in the slide script.

## Check 2 Tester 1 (role not stated)

From test bf380ee1. Quotes verbatim from `sense_checks.md`.

### C1. Manual review takes shortcuts and loses the global view

> "it's easy to do shortcuts. And so when that happens, you're probably missing such a a global view like this is this is doing through the the looking that it does."

> "it's also checking other sites, not just the main site. It looks like it's doing advisers as well."

**What we heard.** People skip pages; adviser and off-site pages are what get missed. An opinion, not a real example of a miss, so it supports H1 only weakly.

**Change.** ✅ Slide 1 carries the global-view quote with context (`1d99a30`). Discovery already finds adviser, press and third-party pages; no product change.

**Owner.** P1. **Status.** ✅

### C2. Quote snippet and confidence make triage fast

> "It's just super easy to to to kinda fly through these."

> "It also looks like it's ranking them or putting some sort of confidence percentage to them. So that would give you good insight into understanding, you know, how well... how confident you could be about this tool working."

**Change.** Keep quote + confidence on every inbox row. Don't claim the % is calibrated: we haven't measured that.

**Owner.** P2, P4. **Status.** ✅ already shipped; ⏳ calibration not measured.

### C3. "I can't go beyond this page"

> "I really can't find anything I don't like. Uh, obviously, I can't go beyond this page"

**What we heard.** Likely they didn't find the flag detail view from the `/demo` inbox.

**Change.** Make inbox rows look clickable (whole row is the link, a "Review →" cue).

**Owner.** P2. **Status.** ⏳ not started; P2 not told yet.

### C4. No demand data

**What we heard.** Nothing: Sense's interview skipped the SEC evidence and the "which customer, which problem would you pay for" question.

**Change.** Ask it directly in Check 3 with a `team_question`.

**Owner.** P1. **Status.** ⏳ Check 3 not drafted.

### C5. A person still checks the work

> "It's something that you you have to keep an eye on and certainly have to double check work, but that would typically be done with people anyway."

**Change.** None: confirms B5 (every flag waits for a person).

**Status.** ✅

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
| 15:50 | A5, B6 | slide script: no-keyword demo flag, word-list quote, AI-volume quote | Keyword baseline misses demo #3 and flags the disclaimer |
| 15:48 | B2 | `0308924` page fingerprint (hash) on flag detail + recheck function | n/a |
| 15:56 | B2 | `d5ae648` recheck open on the demo firm, capped at 1 live fetch per page per 10 min | n/a |
| 16:04 | B2 | `8978dd3` recheck and page-as-captured turned on | n/a |
| 16:05 | A5, A6, B3, B4 | `cabebb3` live eval, detector v3 on Base44 InvokeLLM, 69 calls | 37 seeded: F1 0.70 → 0.98, clean flagged 28% → 0%. Tester set: 0/5 → 5/5 caught, 2/5 → 0/5 clean flagged. Consistency: 2/3 pages identical, 3/3 same categories. Demo site F1 1.00 is a dev set (tuned on it) |
| 16:28 | C1 | `1d99a30` slide 1: global-view quote with context | n/a |
| 16:33 | B2 | `3656b34` slides present dated snapshots (`crawl/snapshot.py`, tests pass) | n/a |
| 16:41 | B2 | `7806cb3` page history screen with diff and as-of date | n/a |
| ⏳ | C3 | clickable inbox rows | — |
| ⏳ | C4 | Check 3 with a `team_question` on demand | — |
| ⏳ | A1, A5, B4 | live LLM run on the hard / scope / injection sets (quota) | — |
