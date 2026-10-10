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
  verify.py        stretch: performance-math checks via Daytona
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
- WARNING: this Mac's `.env` has a Groq key, so `--detector engine.detect:detect` is NOT offline. Check `python3 -c "from engine import llm; print(llm.config()['provider'])"` first.
- Pending: one live run vs `detect-text` after ~4:00 when orchestrator reopens it (one run only, quota is finite), saved as `reports/llm_invokellm_<time>.json` and compared to `baseline_regex_120954.json`.
