# Slide numbers

Every number we may put on a slide, with the caveat that must go with it. The source reports are in `eval/reports/`. Receipts for each tester quote are in `what_we_changed.md`. Written by p4-eval from the live run at 16:03–16:05 on 10-10 (commit `cabebb3`).

**Rules for using these**
- Say "potential issue", never "violation".
- Never say "tester-validated". No tester labeled any case, and every eval case has `reviewed: false`.
- Name the model: **Base44 InvokeLLM**. Every one of the 69 live calls was answered by `base44:base44-invokellm`, with no Groq fallback. Base44 doesn't tell us which underlying model InvokeLLM uses, so we don't name one.
- Each live number comes from **one run**. The LLM isn't fully deterministic (see section 5).

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

## 9. Pipeline vs a single-prompt LLM (INCOMPLETE, not for slides)

From Ethan's `eval/reports/versus_groq120b_panel.json` (`bd16a8f`, 18:53). p4-eval re-checked the numbers from the JSON.

- **Setup:** our pipeline (hints + prompt v4 + filters; v4 is **not live**) vs a single prompt with no hints or filters. Both ran on gpt-oss-120b via Groq on a laptop, not the live app's model.
- **Coverage:** **12 of 36** panel cases, all in the "tester feedback" group. The run stopped when the pipeline got prose instead of JSON.

| | Precision | Recall | F1 | Clean flagged |
|---|---|---|---|---|
| Our pipeline | 0.80 (4 of 5) | 0.80 | 0.80 | 0 of 7 |
| Single prompt | 0.45 (5 of 11) | 1.00 | 0.62 | 1 of 7 |

**Caveats:** incomplete, 12 cases, one run, labels written by us and unreviewed. The direction (fewer false alarms, one more miss) matches sections 1–3, but don't put these numbers on a slide or the home page.
