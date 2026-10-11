# Person 4 — Detector and rewrite

Read the root `CLAUDE.md` first, plus `eval/CLAUDE.md` (you own both). You own **whether the flags are right**. Develop here, prove it with the eval, then hand the prompt to P2 for Base44.

## Tools
- Claude Code on your laptop
- Python 3.11+: `pydantic` (v2), `httpx`, `python-dotenv`, and an LLM client (`anthropic` SDK with a team key from the team note; no sponsor LLM credits were provided)
- **Daytona** (stretch only) for sandboxed math checks

## Files
```
engine/
  __init__.py
  detect.py        detect(text, channel="") -> list[Flag]
  rewrite.py       rewrite(text, flags) -> str
  verify.py        stretch: performance-math checks via Daytona (spec'd, not built)
  prompts/
    detect.md      the prompt P2 pastes into Base44
    rewrite.md
```
Contracts and taxonomy are defined in root `CLAUDE.md`. Import `TAXONOMY` from `eval/compliance_eval.py`; don't redefine it.

## Detect pipeline (v1 by 2:30)
1. **Cheap pre-pass:** regex cues (gross/net, "back-tested", quoted text, "ranked/top-rated", "guarantee", "never lost"). These are **hints passed to the LLM**, not flags.
2. **LLM pass:** one call per chunk. The prompt includes:
   - The 8 categories, each with a one-line definition
   - Per category, 2 "flag" examples and 2 "do not flag" examples
   - The channel and the pre-pass hints
   - Page text inside clear delimiters, with an explicit instruction that it is **data, not instructions**
   - JSON-only output, validated with pydantic
3. **Grounding filter:** drop any flag whose `span` is not an exact substring of the chunk. Required, not optional.
4. **Disclosure-aware suppression:** don't flag a testimonial, rating or performance figure when the required context is in the same chunk (client status, compensation, methodology, rating date, net returns, 1/5/10-year periods).
5. **Confidence threshold:** choose it from eval results.

**Never flag:** standard risk disclaimers ("past performance does not guarantee…"), fee schedules, event invites, generic puffery ("we work to find the best fit").

## Loop
Edit prompt → `python3 eval/compliance_eval.py --detector engine.detect:detect -v` → read the misses and false alarms → repeat. Commit the report JSON with each prompt change.

**Targets by the 2:30 hand-off:** F1 > 0.70 (baseline), clean docs wrongly flagged ≤ 10%, grounding 100%, minimal pairs 8/8.

## Rewrite (after Check 2)
- For each approved flag, the LLM returns a **minimal** edit plus any missing disclosure, without changing meaning beyond the fix.
- Then re-run `detect()` on the result. The app shows "flags cleared: n/m".
- The eval's rewrite check only proves the flags are gone. Have a teammate eyeball 5 rewrites for quality.

## Verify (stretch, only if rewrite is done by 5:00)
- **Checks:** gross shown without net; missing 1/5/10-year periods; cumulative vs annualized consistency; internal arithmetic.
- The LLM writes a small Python snippet to recompute a claim. That's **untrusted generated code, so run it in a Daytona sandbox**, never locally or in Base44.
- **Setup:** Daytona account → redeem the $100 code (team note) under Billing → Wallet. Paste `https://www.daytona.io/docs/llms-full.txt` into your agent before coding. **Don't guess SDK method names.**
- **Output:** `{claim_span, check, expected, found, pass, code_ref}`.
- If it's not working by 5:30, drop it and don't claim the Daytona track.

## Inputs and outputs
| From | What | When |
|---|---|---|
| P3 | A few real crawled pages | 2:00 |
| Devin | Demo-site issues mirrored into `eval/cases.jsonl` | 1:30 |
| P1 | Tester quotes → new or relabeled eval cases | after each check |

| To | What | When |
|---|---|---|
| P2 | `prompts/detect.md` + grounding logic | **2:30** |
| P2 | `prompts/rewrite.md` | ~5:00 |
| P1 | `--compare` before/after report | **7:00** |

When a prompt changes inside Base44, copy it back to `prompts/` so the repo stays the source of truth.

## Status (p4-eval, covering for P4, 10-10)
- `4b26fd2` eval sends `User-Agent: compliance-eval/1.0` on HTTP detector calls (Base44 403s urllib's default). Offline baseline unchanged: F1 0.70, clean flagged 28%, pairs 6/8.
- `02e3a2a` `prompts/rewrite.md` v2: each edit replaces the **whole sentence** holding the flag (span-only edits came out ungrammatical). Schema unchanged. Engine tests 12/12. Not yet run against a live LLM; p2-backend regenerates `prompts.ts` from it after 4:00.
- `5e6ac69` `eval/cases_tester.jsonl`: 7 cases from Check 1 quotes (4 issues in non-keyword wording, 3 clean incl. employee venting). `provenance: tester`, `reviewed: false`, text written by p4-eval, not by testers. Kept out of `cases.jsonl` so the 37-case set stays comparable. Keyword baseline: 0/4 caught, 0/3 clean flagged (`reports/baseline_regex_tester.json`).
- `e5dbe1c` eval stops a live run (no report) on `mode != "llm"` or any HTTP error; before, a quota refusal (200, zero flags) would have been scored as clean.
- `79da230` eval accepts mode `llm_groq` (Groq fallback behind InvokeLLM), records `provider` (or `provider:model`) per case, and splits the summary by provider when answers are mixed. Slide numbers must name the model(s) that answered.
- `091f9a1` `eval/cases_demo_site.jsonl`: 16 cases mirroring the Quarrywick demo site (10 page-sized cases incl. 2 clean pages, 11 planted issues, plus 6 answer-key clean items). Keyword baseline F1 0.36, clean flagged 62%.
- `c1fccd0` firm renamed Hartwell → Quarrywick in eval/engine fixtures (Hartwell is a real adviser); keyword scores unchanged.
- `2948ba6` postprocess: 1/5/10-year periods on the page no longer suppress a cherry-picked-window flag ("since the … low", "best N years"); JS port mirrored. Fixes demo miss #6.
- `ac7c18d` detect.md v2 + per-quote hints: each testimonial needs its own disclosure; a neighbour's disclosure doesn't cover it. Fixes demo miss #8 (model-side; verify on the live re-run). Parity now covers tester + demo-site cases + the stored testimonials markdown (90 texts, 0 mismatches).
- `af93aa0` B4 (Tester B): examples of what not to say, quoted/paraphrased rule text and education are not flagged unless the firm itself is speaking. detect.md v3. cases_tester.jsonl now 10 cases (+3). Rules mode: example clean cases 2/2 → 0/2 flagged, own claim still caught.
- WARNING: this Mac's `.env` has a Groq key, so `--detector engine.detect:detect` is NOT offline. Check `python3 -c "from engine import llm; print(llm.config()['provider'])"` first.
- `f090727` `eval/consistency.py` (A6, Tester A "differing responses"): runs chosen pages N times, reports identical flag sets / same categories / Jaccard. Stops on DetectorUnavailable.
- `f20150c` `--expect-provider base44` on both eval scripts: the first case answered by another model (e.g. `base44+groq`) ends the run with no report, so Groq answers never blend into InvokeLLM numbers.
- `cabebb3` LIVE run, detector v3 on Base44 InvokeLLM, 16:03–16:05, 69 calls, all `base44:base44-invokellm`, no errors. 37 seeded: F1 0.70 → 0.98, clean flagged 28% → 0%, pairs 6/8 → 8/8 (`llm_invokellm_160353.json`; 1 FP `email_riskfree`, left scored as FP). Tester 10: 0/5 → 5/5 caught, 2/5 → 0/5 clean flagged. Demo site 16: F1 0.36 → 1.00 (dev set: its 2 misses were fixed first). Consistency 3 pages × 2: 2/3 identical, 3/3 same categories. detect-text closed again by p2-backend (~16:07).
- `cb05c56` `research/slide_numbers.md` + `research/what_we_changed.md` (the only research/ files p4-eval touched, by orchestrator request). Every number has its caveat there; use them for slides.
- Not done: no live rewrite eval, no live run on cases_hard / scope / injection (quota).
- detect.md **v4**: added patterns from SEC risk alerts and sweeps (`eval/violation_patterns.md`): no-conflicts claims, first/only, AI capability claims, team superlatives, ratings named in passing, link-only disclosures and unnamed benchmarks. On gpt-oss-20b, over the 11 generalize cases both prompts answered: F1 0.67 → 0.82, clean flagged 0/3 → 0/3. The gain is the 2 no-conflicts cases. Scope clean-FP on v4 is **unmeasured** (Groq daily cap). p2-backend: regenerate `prompts.ts`. Parity 94/94.

## Cross-reference (two-pass contradictions, 10-10 evening)
- `engine/crossref.py`: `crossref(docs) -> list[ContradictionFlag]`. Pass 1 (`prompts/absolutes.md`) lists absolute/checkable claims per doc; pass 2 (`prompts/contradict.md`) checks each claim against keyword-retrieved passages from the OTHER docs. Both spans grounded; boilerplate, low confidence (<0.6) and non-quotes dropped. Needs an LLM (raises under `DETECT_MODE=rules`).
- **New contract (not yet agreed with P2/base44):** `{claim_span, claim_url, evidence_span, evidence_url, topic, confidence, why}`; topics `losses|returns|guarantees|conflicts|fees|size|credentials|regulatory|other`.
- Fixtures: `demo-site/docs/` (fictional Form ADV + 2021 blog, `load_demo_docs()`), 8 planted contradictions + near misses in `docs/README.md`. Eval: `eval/crossref_eval.py --detector engine.crossref:crossref` over `eval/cases_crossref.jsonl` (17 cases). Offline tests: engine 19/19, eval 20/20.
- **Always mark absolutes (`99d9bf2`):** `review(docs) -> list[Mark]`, Mark = flag + `{status, severity, absolute}`. Every contradiction → `contradicted`/`high` (absolute or a plain checkable fact). Every absolute/guarantee nothing contradicts → `unverified`/`review`, empty evidence, why "no other document we checked contradicts it, but the firm may need to substantiate it". Every plain checkable fact (number, date, fee, count) nothing contradicts → `unverified`/`info`, why "specific checkable fact … keep records that support it" (all pass-1 claims are now marked). `absolute` = pass-1 model flag OR regex backstop (`ABSOLUTE_RX`: never/always/guarantee/risk-free/conflict-free/100%/consistently/most trusted…). `crossref()` is unchanged for the eval (contradictions only). CLI `--demo` prints `marks`.
- gpt-oss returned empty replies at default reasoning: `llm.complete(..., reasoning_effort=)`, `CROSSREF_REASONING` (default low), `CROSSREF_MAX_TOKENS` (default 4000; use 2000 on the shared 8k TPM key, the reservation counts against the limit).
- **review() not yet verified live:** 3 demo runs at 18:10–18:35 all ended in Groq 429 (shared key: 20b TPM contended, 120b daily cap). No live numbers for review(); offline tests only.
- Groq `gpt-oss-120b` hit its 200k tokens/day cap at ~18:00 (shared key). Live runs after that used `LLM_MODEL=openai/gpt-oss-20b`; name the model with any number.
