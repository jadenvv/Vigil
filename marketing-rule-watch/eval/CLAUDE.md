# Eval harness (owned by Person 4)

Read the root `CLAUDE.md` first. This folder **measures** the detector; it doesn't build it.

## Files
- `compliance_eval.py`: the harness. Holds `TAXONOMY`, the single source of truth for categories.
- `cases.jsonl`: 37 seeded cases (19 with issues, 18 clean, 8 minimal pairs).
- `reports/`: JSON output of each run. Commit these; they're the before/after receipts for the pitch.

## Commands (run from repo root)
```
python3 eval/compliance_eval.py --detector baseline_regex -v                 # baseline
python3 eval/compliance_eval.py --detector engine.detect:detect -v           # local detector
python3 eval/compliance_eval.py --detector https://<base44-endpoint>/detect  # live app, if exposed
python3 eval/compliance_eval.py --compare eval/reports/A.json eval/reports/B.json
```

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
