# Slide numbers

Every number we may put on a slide, with the caveat that must go with it. The source reports are in `eval/reports/`. Receipts for each tester quote are in `what_we_changed.md`. Written by p4-eval from the live run at 16:03–16:05 on 10-10 (commit `cabebb3`).

**Rules for using these**
- Say "potential issue", never "violation".
- Never say "tester-validated". No tester labeled any case, and every eval case has `reviewed: false`.
- Name the model: **Base44 InvokeLLM**. Every one of the 69 live calls was answered by `base44:base44-invokellm`, with no Groq fallback. Base44 doesn't tell us which underlying model InvokeLLM uses, so we don't name one.
- Each live number comes from **one run**. The LLM isn't fully deterministic (see section 5).

## What the final deck says

The pitch deck ("Vigil Pitch", 3 slides) is the ground truth for what we present. Every number on it, and where it comes from:

| Deck number | Section here | Source |
|---|---|---|
| $75,000 fine for "no conflicts of interest" (Sept 2025); 9 advisers, $1.24M (Sept 2024); 8 employees at the median adviser | — | `evidence_bank.md` |
| 15 potential issues on 9 of 11 pages, 4 of them on the review site | 4, 8 | live app, demo firm |
| Demo firm: 11 of 11 planted issues, 0 false alarms (9 of 11 at first) | 3, 4 | live app |
| AdvisorQuill: 4 of 4 planted issues, 0 clean passages flagged | 8 | live app |
| Third-party pages found 7 of 7, 0 personal (simulated web) | 6 | `discovery_v2.json` |
| 24 eval cases from 12 SEC orders; 13% of 180 distinct cases | 11 | private set + `eval/cases*.jsonl` |
| Clean docs wrongly flagged 28% → 0% (5 of 18 → 0 of 18) | 1 | keyword rules vs live v3 |
| Examples wrongly flagged 6/6 → 0/6 (card); 2/2 → 0/2 (speaker notes) | 2, 12 | see 12 |
| Wrong flags 4 vs 111; 76 vs 75 of 77; clean 3/56 vs 19/56; F1 0.97 vs 0.57 | 10 | `versus_haiku55_allsets.json` |
| Panel: 21/21 both; wrong flags 1 vs 28; clean 0/15 vs 4/15; right rule 95% vs 52%; tester-feedback cases 0 vs 10 | 10 | `versus_haiku55_panel.json` |
| gpt-oss-120b panel F1 0.98 vs 0.65 | 9 | `versus_groq120b_panel_full2.json` |

Deck footer: "13% of our 180 eval cases come from 12 real SEC orders that fined advisers; we wrote the rest. One run each. Not legal advice." The cards are keyword rules vs the live app; the dark band is offline on Claude Haiku with the next detector version, not yet live.

## Lead number

**Clean docs wrongly flagged: 28% with keyword rules → 0% with the live LLM detector**, *on our 37-case synthetic, unreviewed test set* (5 of 18 → 0 of 18). This answers Tester B: "I would be doubting the flag if I found that the tool was repeatedly identifying false... having... repeatedly having false positives." Same direction on the other two sets: 2 of 5 → 0 of 5 (tester-style) and 5 of 8 → 0 of 8 (demo site, a dev set). Each of these is one run.

## 1. Main eval: keyword baseline vs live LLM detector

*On our 37-case synthetic, unreviewed test set: 19 cases with planted issues (21 issues in all), 18 clean.*

| Metric | Keyword baseline | Live LLM detector (v3) |
|---|---|---|
| F1 | 0.70 | **0.98** |
| Precision | 0.68 (15 of 22 flags correct) | 0.95 (21 of 22) |
| Recall | 0.71 (15 of 21 issues) | 1.00 (21 of 21) |
| Clean docs wrongly flagged | 28% (5 of 18) | **0%** (0 of 18) |
| Grounding (flag quote found word-for-word in the text) | 100% | 100% |
| Minimal pairs passed (flags the bad version, quiet on the fixed one) | 6 of 8 | 8 of 8 |

Reports: `baseline_regex_120954.json` (12:09) vs `llm_invokellm_160353.json` (16:03).

Caveats:
- We wrote these cases ourselves from SEC deficiency categories. No compliance professional has reviewed them.
- The detection prompt was developed with these cases visible, so this is not a blind test.
- The one false positive is `email_riskfree`. Besides the labeled "Risk-free income for life", the detector also flagged "Our annuity-like portfolio pays 7% every year." That is arguably a real issue our label left out. We scored it as a false positive anyway and did not change the label after seeing the result.

## 2. Tester-style cases: keyword vs live

*10 cases written by us based on Sense Check 1 testers' comments (not tester-labeled).* 5 contain an issue and 5 are clean.

| | Keyword baseline | Live LLM detector |
|---|---|---|
| Issues caught | 0 of 5 | **5 of 5** |
| Clean cases wrongly flagged | 2 of 5 | **0 of 5** |

Reports: `baseline_regex_tester.json` vs `llm_invokellm_tester_160414.json`.

Caveats:
- The case text was written by us, not by the testers.
- 3 of the 10 cases were written together with the fix they test (B4: examples and rule text are not ads), so this is not an independent test.
- On the first 7 cases alone, written before any fix, the keyword baseline caught 0 of 4 issues and the live detector caught 4 of 4, with 0 of 3 clean cases flagged by either.

## 3. Demo-site cases: keyword vs live

*16 cases taken from our own fictional site, Quarrywick Wealth: 11 planted issues and 8 clean cases.*

| | Keyword baseline | Live LLM detector |
|---|---|---|
| F1 | 0.36 | **1.00** |
| Planted issues caught | 6 of 11 | 11 of 11 |
| Clean cases wrongly flagged | 5 of 8 | 0 of 8 |

Reports: `baseline_regex_demo_site.json` vs `llm_invokellm_demo_site_160443.json`.

Caveat: this is a **development set**, not a test. We first ran the detector on this site and it missed 2 planted issues. We fixed both (`2948ba6`, `ac7c18d`) before this run. Do not present 11 of 11 as accuracy. Present it as "found 9 of 11, fixed the 2 misses, now 11 of 11".

## 4. Real crawl of our own fictional site (in the app)

*Our own fictional site, Quarrywick Wealth, crawled with Bright Data and scanned in the app. Numbers reported by p2-backend.*

- **Before the fixes:** 9 of 11 planted issues flagged, 0 false positives.
- **After the fixes:** detector v3 was deployed at 16:00. Re-running it through the live detect-text on the stored page text (10 calls, `base44-invokellm`) gave 11 of 11 planted issues, 0 extra flags and 0 flags on clean items.
- Caveat: this is one run on a fictional site we built with planted issues, and the 2 misses were fixed on this same site. It is not real-world accuracy.

**Home page proof line**, final wording from the orchestrator: "Our own test on our fictional demo firm: all 11 planted issues found, 0 false alarms." Label: "One run on a site we built with planted issues; the detector was tuned on this site. Not real-world accuracy." Synthetic-case F1 stays off the home page.

## 5. Consistency (Tester A: "differing responses")

*n = 3 pages, 2 runs each, our own fictional site* (home, performance, testimonials; `consistency_160459.json`).

- **2 of 3 pages** gave identical flag sets (same category and same quote) in both runs.
- **3 of 3** flagged the same categories in both runs. Mean overlap (Jaccard) was 0.78.
- The one difference was on the home page. Both runs flagged the same claim, but one quoted the whole sentence ("Quarrywick Wealth is the most trusted retirement firm in the Pacific Northwest.") and the other a phrase ("the most trusted retirement firm in the Pacific Northwest"). Same issue, different quote length.
- Caveat: 6 calls is far too few for a consistency rate. It shows the kind of variation we saw, not how often it happens.

## 6. Discovery (offline, simulated web)

From `eval/reports/discovery_v2.json`: the app's discovery queries found 10 of 10 of the firm's own pages and 7 of 7 third-party pages about it, with 0 personal pages leaked.

Caveat: this is a simulated web (our demo site plus a fake search engine answering from 13 documents we labeled). It tests our query design and filters, not real Google indexing.

## 7. Held-out cases and the next detector version (v4, NOT live)

*14 held-out cases a teammate (Ethan) wrote from public SEC 2024–2025 risk alerts and sweeps* (`eval/cases_generalize.jsonl`, `a6c2d65`, 17:30): 12 issues and 3 clean. They were written **before detect.md v4** (`851f64e`, 18:29) and after v3, so the live v3 prompt never saw them. Caveat: the same person who wrote the cases then wrote v4. The cases are unreviewed.

**Model caveat, critical:** these runs used **gpt-oss-20b via Groq on a laptop**, not the live app's Base44 InvokeLLM. Don't compare them with sections 1–3, and never put them under "Model: Base44 InvokeLLM". **v4 is not deployed**: the live app still runs v3. Call v4 "next detector version, not yet live".

| Run (one each) | Cases | Issues caught | Precision | F1 | Clean flagged |
|---|---|---|---|---|---|
| Keyword rules (`baseline_regex_generalize.json`) | 14 | 0 of 12 | 0.00 | 0.00 | 1 of 3 |
| Detector v3, the prompt live now (`llm_groq20b_v3_generalize.json`) | 14 | 8 of 12 | 0.89 | 0.76 | 0 of 3 |
| Detector v4, not yet live (`llm_groq20b_v4_generalize.json`) | 14 | 7 of 12 | 0.88 | 0.70 | 0 of 3 |
| v3, the 11 cases both versions answered | 11 | 5 of 9 | 0.83 | 0.67 | 0 of 3 |
| v4 (not yet live), same 11 cases | 11 | **7 of 9** | 0.88 | **0.82** | 0 of 3 |

- **Use the 11-case comparison.** 3 v4 cases errored on the model's daily cap (`gen_benchmark_unnamed`, `gen_credentials_claim`, `gen_testimonial_link_only`), and v3 got all 3 right. The 14-case v4 row counts those errors as misses, so it understates v4.
- v4 newly caught the two "free of conflicts" claims (`gen_conflict_free_about`, `gen_conflict_none_faq`). Nothing v3 caught on the 11 was lost.
- p4-eval re-derived every number in this table from the report JSONs (18:4x). Ethan's commit message ("F1 0.67 -> 0.82, clean flagged 0/3 both") matches.
- Slide line, if used: "On 11 held-out cases written before the change, the next detector version (not yet live) found 7 of 9 issues vs 5 of 9 for the current prompt, with no clean case flagged by either. That's one run on a smaller model than the live app's."

## 8. Third-party review page (live v3, a page the detector was never tuned on)

*One page on a fictional review site Devin built (AdvisorQuill profile of Quarrywick Wealth, channel `review_site`), one run of the live v3 detector on Base44 InvokeLLM, ~18:42 on 10-10.*

- **4 of 4 planted issues flagged:**
  - RATING_NO_DISCLOSURE: "Rated #1 Advisor in the Region by AdvisorQuill.", 0.9
  - UNSUBSTANTIATED_CLAIM: "The firm consistently outperforms the market.", 0.9
  - BENEFITS_WITHOUT_RISK: "Quarrywick Wealth provides guaranteed income with no investment risk.", 1.0
  - TESTIMONIAL_NO_DISCLOSURE: the "Quarrywick doubled our retirement savings in five years." review, 1.0
- **0 clean passages flagged.** The disclosed Sandra M. review (current client, not paid), the About text and the facts table stayed quiet.
- **How it was checked:** p4-eval read the 4 stored Flag rows (Page `6acae98a770ded722c7108da`) read-only and confirmed they are the only flags on that page. All 4 quotes appear on the live page, and the Sandra M. disclosure is present. All 4 spans and categories match `demo-site/ANSWER_KEY.md` → "Third-party site" → "Planted issues (4)" exactly (Devin, PR #4). The clean content listed there (the Sandra M. review, About the firm, the facts table) was not flagged.
- **Not tuned on it:** no eval case or prompt file contains this page's text, and v3 (15:22) predates the page.
- **Caveats:** one page, 4 issues, one run. Devin wrote the page from our own taxonomy brief, so the issues follow our categories. It is a fictional site, not real-world accuracy.

Home card (5th entry in `EVAL_RESULTS`): "Third-party review page: 4 of 4", "0 clean passages flagged; a page the detector was never tuned on", "Fictional review site Devin built; one page, one run".

## 9. Pipeline vs a single-prompt LLM on gpt-oss-120b (second model)

From Ethan's two complete runs: `eval/reports/versus_groq120b_panel_full.json` (run 1, 19:06) and `versus_groq120b_panel_full2.json` (run 2, 19:16). git-manager re-checked the numbers from the JSON. They replace the earlier partial run (12 of 36 cases, `versus_groq120b_panel.json`).

- **Setup:** our pipeline (hints + prompt v4 + filters; v4 is **not live**) vs a single prompt with no hints or filters. Both ran on gpt-oss-120b via Groq on a laptop, not on the live app's model.
- **Coverage:** all **35** panel cases (20 with an issue, 21 issues in all, and 15 clean). Both reports say the run completed.
- **Scoring:** run 2 uses the new rule from `c718555`, which counts a flag quoted inside the labelled span as a hit.

| | Precision | Recall | F1 | Clean flagged |
|---|---|---|---|---|
| Our pipeline, run 2 (new scoring) | 1.00 (20 of 20) | 0.95 (20 of 21) | **0.98** | 0 of 15 |
| Our pipeline, run 1 | 0.95 (19 of 20) | 0.90 (19 of 21) | 0.93 | 0 of 15 |
| Single prompt (identical in both runs) | 0.53 (18 of 34) | 0.86 (18 of 21) | 0.65 | 3 of 15 |

**Caveats:**
- Two runs on a laptop model, not the live detector.
- The pipeline uses v4, which is not live.
- The labels are written by us and unreviewed.
- The best pipeline number is from the run with the new scoring rule.
- The direction matches sections 1–3 and 10: far fewer false alarms at about the same recall. The deck leads with the Claude Haiku run (section 10); this one appears only in its speaker notes, as "gpt-oss-120b panel: F1 0.98 vs 0.65". Keep it off the home page.

## 10. Pipeline vs a single-prompt LLM on Claude Haiku (the deck's dark band)

From `eval/reports/versus_haiku55_allsets.json` (19:36) and `versus_haiku55_panel.json` (19:24), both complete. Model `claude_cli:claude-haiku-5-5` via local `claude -p`, the same model for both sides. The pipeline is hints + prompt v4 + filters (**v4 is not live**); the single prompt is `engine/naive.py`: one call per page, a bare category list, no examples, grounding or suppression.

**Every set:** 125 cases in 8 sets (77 issues, 56 clean), none dropped. The SEC-order set is not in it.

| | Issues caught | Wrong flags | Clean cases flagged | Precision | F1 |
|---|---|---|---|---|---|
| Vigil pipeline | 76 of 77 | **4** | 3 of 56 | 0.95 | **0.97** |
| Single prompt | 75 of 77 | 111 | 19 of 56 | 0.40 | 0.57 |

Wrong flags by set (Vigil vs single prompt): main 1 vs 29, held-out 1 vs 14, whole pages 0 vs 14, tester-style 0 vs 8, demo site 1 vs 19, hard 1 vs 17, scope 0 vs 5, injection 0 vs 5. Hard, scope and injection are test sets we never tuned on; Vigil's one miss is in hard.

**Panel** (`cases_versus.jsonl`): 36 cases; the single prompt returned prose instead of JSON on `scope_educational_backtest`, so 35 are scored (21 issues, 15 clean).

| | Issues caught | Wrong flags | Clean cases flagged | Right rule cited | F1 |
|---|---|---|---|---|---|
| Vigil pipeline | 21 of 21 | **1** | 0 of 15 | 95% | **0.98** |
| Single prompt | 21 of 21 | 28 | 4 of 15 | 52% | 0.60 |

On the panel's 16 tester-feedback cases (`panel_group: feedback`): 0 vs 10 wrong flags.

**Caveats:** one run each; Claude Haiku on a laptop, not the live app's InvokeLLM; the pipeline uses v4, not yet live; our own unreviewed cases. "Wrong flags" counts every flag that matched no labelled issue, including extra flags on cases that also had a real one.

## 11. Where the eval cases come from

- **180 distinct eval cases.** 156 are in `eval/cases*.jsonl` (distinct ids across all files; the panel and some sets reuse cases). 24 are in the private SEC-order set (`private-eval-data/cases_sec_orders.jsonl`, outside this repo; `eval/run_all.py` reads it).
- **The 24 SEC-order cases (13%)** come from 12 SEC settled orders that each imposed a civil penalty: 13 use the ad wording the SEC quoted, 6 use the firm's own page as archived by the Internet Archive's Wayback Machine (not Bright Data), and 5 are our corrected rewrites as clean controls.
- **On Claude Haiku:** Vigil caught 22 of 30 issues vs the single prompt's 25, with 19 wrong flags vs 59, and flagged 1 of 5 clean cases vs 3 of 5. Harder than our own cases. The report stays with the private set.
- The other 156 we wrote from SEC deficiency categories, tester comments and our demo site. None were reviewed by a compliance professional.

## 12. Example text (Tester B: "not a sample … to illustrate a misleading advertisement")

The deck's card reads **6/6 → 0/6** examples wrongly flagged, with the firm's own claim still caught. Its speaker notes give the narrower measured number: keyword rules flagged example and rule-education text **2 of 2**, Vigil **0 of 2** offline and live; the firm's own claim on the same kind of page still caught **1 of 1** (`what_we_changed.md` row 8). No report in `eval/reports/` breaks out a 6-case example count, so if asked, quote the 2 of 2 → 0 of 2.
