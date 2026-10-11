# Eval harness (owned by Person 4)

Read the root `CLAUDE.md` first. This folder **measures** the detector; it doesn't build it.

## Files
- `compliance_eval.py`: the harness. Holds `TAXONOMY`, the single source of truth for categories.
- `cases.jsonl`: 37 seeded cases (19 with issues, 18 clean, 8 minimal pairs).
- `cases_holdout.jsonl`: 19 single-sentence cases (12 issues, 7 clean), written by P4 *before* the rules detector, to check generalization. Run with `--cases eval/cases_holdout.jsonl`.
- `cases_pages.jsonl`: 9 multi-paragraph pages (10 issues, 2 clean pages) with nav/footer text, disclosed and undisclosed claims side by side, and near-misses. The rules fallback scored **F1 0.29** on these before tuning (`reports/rules_v1_pages.json`) and 1.00 after (`rules_v2_pages.json`). That makes this a **dev set now**, not a test. The 0.29 is the honest "unseen pages" number for keyword rules.
- `cases_hard.jsonl` (16, 5 clean), `cases_scope.jsonl` (11, 9 clean), `cases_injection.jsonl` (7, 2 clean): **test sets, don't tune on them.** Hard = paraphrase, buried claims, remote/footnote disclosures, star-only ratings. Scope = educational text, quoted bad ads, FAQ denials, other-firm news, job posts (should stay quiet). Injection = page text that tries to steer an LLM detector; only meaningful for LLM mode. All `pattern_synthetic`, `reviewed: false`.
- `suite.py`: the wider eval suite (see below). Reuses the harness's scoring.
- `reports/`: JSON output of each run. Commit these; they're the before/after receipts for the pitch. The harness names files `<detector>_<HHMMSS>.json`, so two runs in the same second overwrite each other: rename after each run (`rules_v2_pages.json` etc.).

## Commands (run from repo root)
```
python3 eval/compliance_eval.py --detector baseline_regex -v                 # baseline
python3 eval/compliance_eval.py --detector engine.detect:detect -v           # local detector
python3 eval/compliance_eval.py --detector https://<base44-endpoint>/detect  # live app, if exposed
EVAL_DETECTOR_TOKEN=<admin token> python3 eval/compliance_eval.py --detector https://marketing-rule-watch-a0747dd2.base44.app/functions/detect-text  # live model; detect-text is admin only (401 without the token)
python3 eval/compliance_eval.py --compare eval/reports/A.json eval/reports/B.json
```

## Eval suite (`suite.py`)
Offline (no API calls): prefix with `DETECT_MODE=rules LLM_PROVIDER=none`. Without them `.env` routes the engine to the LLM, which spends credits.
```
python3 eval/suite.py sets        --detector engine.detect:detect    # one table over every case file
python3 eval/suite.py site        --detector engine.detect:detect    # sitemap -> fetch -> HTML-to-text -> detect, vs demo-site answer key (--base <url|folder>, max 30 pages)
python3 eval/suite.py consistency --detector engine.detect:detect --repeat 3   # same input, same flags? (max 10)
python3 eval/suite.py rewrite     --detector engine.detect:detect    # flags cleared, no new flags, untouched sentences kept, no invented numbers
python3 eval/suite.py calibration --detector engine.detect:detect    # precision per confidence bucket
python3 eval/suite.py versus      --detector engine.detect:detect --against engine.naive:detect -v   # our pipeline vs a naive wrapper
```
`versus` puts two detectors side by side (P/R/F1, clean FP, grounding, LLM calls, ΔF1; `-v` lists cases where they disagree). `--cases <file>` for one file, else every set. The default B, `engine/naive.py`, is the afternoon-build baseline: same `llm.complete` (same provider, model, temperature) but one call per page, a bare category list, no examples, hints, delimiters, grounding, suppression or threshold. Its ungrounded spans score as FPs, as they would mislead an officer. Both sides use the LLM, so this spends credits; the naive side needs a key (it raises with `LLM_PROVIDER=none`).
**Versus panel** `cases_versus.jsonl` (36 cases, 16 clean; built by `build_versus_panel.py`, copied verbatim from other sets): 17 trace to tester feedback (`panel_group: feedback`), 19 are our picks (minimal pairs, never-flag, hard, injection, generalize, demo). Contains test-set cases: don't tune on it. A non-JSON reply from one side is recorded as `no_answer` and the case is dropped from both sides' scores; other errors stop the run. `--resume <report>` reuses cases both sides answered (same model and B only).
```
LLM_PROVIDER=openai LLM_MODEL=<model> python3 eval/suite.py versus --detector engine.detect:detect --against engine.naive:detect --cases eval/cases_versus.jsonl --name versus_<tag>_panel -v
```
Partial only (`reports/versus_groq120b_panel.json`, gpt-oss-120b, **12/36 cases, incomplete**, all feedback group): pipeline P 0.80 R 0.80 F1 0.80, clean flagged 0% · naive P 0.45 R 1.00 F1 0.62, clean flagged 14%. Stopped when the pipeline got prose instead of JSON on `scope_educational_backtest` (now a `no_answer`). Weak evidence: 12 cases, one run, unreviewed labels.

HTTPS calls (LLM, live endpoint, demo site) use certifi's CA bundle when it's installed; python.org Python on macOS has none and fails with `CERTIFICATE_VERIFY_FAILED`.
Reports go to `reports/<cmd>_<detector>_<HHMMSS>.json` (`--no-save` to skip). For a live-endpoint consistency check on chosen pages, `consistency.py --ids ... --runs N` does the same job with tighter cost control.

Offline rules-mode numbers (`reports/suite_rules_offline_*.json`): demo_site F1 0.74 · hard F1 0.50, recall 0.36 · scope clean-FP 44% · site end-to-end F1 0.74, 0 clean pages flagged, 11/11 planted spans survive extraction · deterministic 16/16 · rewrite checks pass 19/19 (cases), 6/6 (demo_site). **LLM mode not yet measured on the new sets.**

`cases_generalize.jsonl` (14 cases, 3 clean) is a held-out check for detect.md v4, written from public SEC patterns (`violation_patterns.md`). Results on gpt-oss-20b, over the 11 cases both prompts answered:
- v3: F1 0.67 · v4: F1 0.82 · clean flagged 0/3 for both.
- Reports: `reports/llm_groq20b_v{3,4}_generalize.json`.
- On the Groq 20b/120b daily caps, the scope, hard, injection and private SEC sets were not run.
- Rules mode on generalize: P 1.00, R 0.17.

## Run every LLM eval (`run_all.py`)
One runner for detect.md **v3 vs v4** on every case set, the **two-pass crossref** (claims vs Form ADV and other docs, `cases_crossref.jsonl`) and, with `--private`, the private SEC-order set. v3 and v4 are frozen copies (`engine/prompts/detect_v{3,4}.md`) run through `engine.detect_versions:detect_v3|detect_v4`, the same pipeline with only the prompt pinned.
```
python3 eval/run_all.py --model openai/gpt-oss-20b              # DRY RUN (default): jobs, report names, ~tokens. No calls.
python3 eval/run_all.py --go --model openai/gpt-oss-20b         # run within --budget (default ~150k est. tokens)
python3 eval/run_all.py --go --only crossref --budget 300000
python3 eval/run_all.py --go --private                          # + SEC set; reports -> private-eval-data/reports/, never commit
python3 eval/run_all.py --smoke --private                       # offline plumbing check (rules mode + crossref stub, temp dir)
```
- Reports: `reports/llm_<tag>_<v3|v4>_<set>.json`, `reports/llm_<tag>_crossref.json` (tag from the model, e.g. `groq20b`). Existing reports are skipped (`--force` to redo), so a run cut off by a daily cap resumes on re-run. v3/v4 alternate per set; finished pairs get a `--compare` at the end.
- Any detector error (Groq 429, 401) stops the job with **no report** (`compliance_eval.py --stop-on-error`) and stops the runner, so quota never scores as misses. Verified with an invalid key: no report written.
- Harness rewrite check is off for these (it would triple cost); rewrites are `suite.py rewrite`.
- Rough cost on gpt-oss-20b: all detect sets v3+v4 ~0.74M tokens, crossref ~234k, SEC v3+v4 ~189k; ~1.16M in all. At Groq's ~200k/day/model that is ~6 days on one model, so pick sets (`--sets`) or split across models.
- **Not run yet** (only dry run + smoke). `compliance_eval.py --out` now also accepts an exact `.json` path.

## Discovery eval (`discovery_eval.py`)
Does `crawl/discover.py` find the firm's own pages and the **third-party pages about it** (hypothesis 1)? It runs the real `discover()` against a simulated web, `discovery_world.json`: the demo site served from `demo-site/site/`, plus a fake Google answering each SERP query from 13 labelled docs. Those include LinkedIn company and advisor posts, Yelp, smartasset, a press release, a podcast, a UK namesake firm, a personal `/in/` profile, a tracking-param duplicate and the planned AdvisorQuill profile. It's offline with no credits and needs `httpx`. It tests query design and filters, **not** real Google indexing.
```
python3 eval/discovery_eval.py -v
```
**v1** (`reports/discovery_v1.json`, 3 queries): own-site recall 2/10 on the GitHub Pages subpath (fetched the 404ing github.io root), 10/10 on its own domain · third-party recall 5/7 (press release and podcast matched no query) · off-site precision 0.71 · AdvisorQuill came back `source: site`, channel `website` · 0 personal leaks.

**v2** (`reports/discovery_v2.json`, 5 queries: added `"press release" OR announces OR announced` and `podcast OR episode OR interview`; path-aware site scoping ported from `shared/discover.ts`; podcast → `other`, AdvisorQuill → `review_site`). Same in both scenarios:
- Own-site recall **10/10** · third-party recall **7/7**, all labelled off-site · channel accuracy 7/7 · off-site precision 0.78 · 0 personal leaks.
- **Simulator change, not tuning:** v2's fake Google also matches words in the URL (as Google does) and understands `OR`. Without URL words the podcast is still missed (6/7): its page text never says "podcast", only its URL does.
- Still through: the UK namesake (Quarrywick Wealth Partners Ltd, same name, different firm) and the Yelp `?osq=` duplicate. Neither is fixed; the namesake needs a human or page-content check.

## What it reports
- Precision, recall and F1, overall and per category
- **Clean docs wrongly flagged.** Compliance officers hate noise, so this matters as much as recall.
- **Grounding:** share of flags whose quote really is in the text. Must be 100%.
- **Citation accuracy:** right rule paragraph
- **Minimal pairs:** flags the bad version and stays quiet on the fixed one
- **Rewrite check:** flags gone after rewrite. Necessary, not sufficient.

**Baseline (keyword regex):** F1 0.70 · clean docs wrongly flagged 28% · minimal pairs 6/8.

## Case format
```json
{"id": "unique_id", "channel": "website", "provenance": "pattern_synthetic|tester|demo_site",
 "reviewed": false, "text": "...",
 "gold": [{"category": "BENEFITS_WITHOUT_RISK", "span": "exact substring", "alt": ["UNSUBSTANTIATED_CLAIM"]}],
 "pair": "optional_pair_name", "role": "violating|fixed", "notes": "optional"}
```
`gold: []` means a clean document. The harness refuses to run if a gold span isn't an exact substring of `text`.

## Honesty rules
- All 37 seeded cases are **`pattern_synthetic`, `reviewed: false`**: written from SEC deficiency categories, not labeled by a compliance professional.
- When a tester or mentor confirms or rejects a flag, fix or add the case and set `reviewed: true`. The harness reports the reviewed subset separately, so put that number on the slide.
- Rule refs in `TAXONOMY` are from memory and unconfirmed.
- `clean_hypothetical_on_request` has an ambiguous label. Ask a mentor.
- Don't tune the prompt to individual cases until it memorizes them. When a fix only helps one case, add a new similar case to check it generalizes.
