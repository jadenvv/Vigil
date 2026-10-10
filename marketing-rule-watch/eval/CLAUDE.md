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
```
Reports go to `reports/<cmd>_<detector>_<HHMMSS>.json` (`--no-save` to skip). For a live-endpoint consistency check on chosen pages, `consistency.py --ids ... --runs N` does the same job with tighter cost control.

Offline rules-mode numbers (`reports/suite_rules_offline_*.json`): demo_site F1 0.74 · hard F1 0.50, recall 0.36 · scope clean-FP 44% · site end-to-end F1 0.74, 0 clean pages flagged, 11/11 planted spans survive extraction · deterministic 16/16 · rewrite checks pass 19/19 (cases), 6/6 (demo_site). **LLM mode not yet measured on the new sets.**

## Discovery eval (`discovery_eval.py`)
Does `crawl/discover.py` find the firm's own pages and the **third-party pages about it** (hypothesis 1)? It runs the real `discover()` against a simulated web, `discovery_world.json`: the demo site served from `demo-site/site/`, plus a fake Google answering the 3 SERP queries from 13 labelled docs. Those include LinkedIn company and advisor posts, Yelp, smartasset, a press release, a podcast, a UK namesake firm, a personal `/in/` profile, a tracking-param duplicate and the planned AdvisorQuill profile. It's offline with no credits and needs `httpx`. It tests query design and filters, **not** real Google indexing.
```
python3 eval/discovery_eval.py -v
```
`reports/discovery_v1.json`, with the same result in both scenarios unless noted:
- **Own-site recall:** 2/10 on the real GitHub Pages subpath (`urljoin(base, "/")` and `"/sitemap.xml"` drop the `/quarrywick-wealth-demo/` path, so it fetches the github.io root, which 404s). 10/10 on its own domain.
- **Third-party recall:** 5/7. The press release and the podcast match none of the queries (`site:linkedin.com`, `reviews`, `"top advisor"`).
- **Off-site precision:** 0.71. The UK namesake and the Yelp `?osq=` duplicate get through.
- **Personal `/in/` leaks:** 0.
- **AdvisorQuill:** on the subpath it comes back as `source: site`, because `same_site` compares hostnames and both sites are on `nathanqiu07.github.io`. Its channel is `website`, not `review_site`, because `guess_channel` doesn't know the host.

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
