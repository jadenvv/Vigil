#!/usr/bin/env python3
"""
Builds eval/cases_versus.jsonl: a 36-case panel for `suite.py versus` (our pipeline vs the naive wrapper).

Cases are copied verbatim from the existing sets (no new text, no relabeling), with three added fields:
  panel_group   "feedback" (traces to a tester quote in research/feedback_changes.md) or "important" (our call)
  panel_reason  why the case is on the panel
  source        the file it came from

Re-run after any source case changes:  python3 eval/build_versus_panel.py
Several picks come from test sets (hard, scope, injection): don't tune the prompt on this panel either.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

FEEDBACK = [
    ("cases_tester.jsonl", "tester_a_new_words_bulletproof", "A5: new wording a keyword list misses"),
    ("cases_tester.jsonl", "tester_a_new_words_zero_downside", "A5: new wording a keyword list misses"),
    ("cases_tester.jsonl", "tester_a_new_words_comes_close", "A5: superiority claim without trigger words"),
    ("cases_tester.jsonl", "tester_a_employee_venting_hours", "A1: employee venting is out of scope"),
    ("cases_tester.jsonl", "tester_a_employee_venting_crm", "A1: employee venting is out of scope"),
    ("cases_tester.jsonl", "tester_b_inflated_down_year", "B: flag inflated claims"),
    ("cases_tester.jsonl", "tester_b_confident_but_clean", "B3: confident tone, nothing to flag (precision)"),
    ("cases_tester.jsonl", "tester_b_example_not_ad", "B4: example of what not to say"),
    ("cases_tester.jsonl", "tester_b_quoted_rule_not_ad", "B4: education about the rule"),
    ("cases_tester.jsonl", "tester_b_example_page_with_real_claim", "B4 control: example framing next to a real claim"),
    ("cases_scope.jsonl", "scope_employee_venting", "A1: employee review, out of scope"),
    ("cases_scope.jsonl", "scope_example_bad_ad", "B4: bad claim quoted as a warning"),
    ("cases_scope.jsonl", "scope_educational_backtest", "B4: explainer about hypotheticals"),
    ("cases_scope.jsonl", "scope_control_example_then_pick", "B4 control: 'For example' then the firm's own pick"),
    ("cases_hard.jsonl", "hard_implied_no_loss", "A5: 'never lost money' with no trigger words"),
    ("cases_hard.jsonl", "hard_superlative_soft", "A5: implied #1 with no 'best'/'top'"),
    ("cases_demo_site.jsonl", "demo_about", "A5 demo pick: 'never lost money in a down year', full page"),
]

IMPORTANT = [
    ("cases.jsonl", "guarantee_violating", "minimal pair: flag the bad version"),
    ("cases.jsonl", "guarantee_fixed", "minimal pair: stay quiet on the fix"),
    ("cases.jsonl", "testimonial_violating", "minimal pair: undisclosed testimonial"),
    ("cases.jsonl", "testimonial_fixed", "minimal pair: disclosed testimonial (suppression)"),
    ("cases.jsonl", "email_riskfree", "the one FP in the InvokeLLM live run"),
    ("cases.jsonl", "clean_boilerplate", "never-flag list: standard risk disclaimer"),
    ("cases.jsonl", "clean_puffery", "never-flag list: generic puffery"),
    ("cases_hard.jsonl", "hard_testimonial_link_only", "disclosure only behind a link (Dec 2025 risk alert)"),
    ("cases_hard.jsonl", "hard_rating_stars_only", "star rating with no date, period or compensation"),
    ("cases_hard.jsonl", "hard_every_client_on_schedule", "one claim buried in an 876-char page of boilerplate"),
    ("cases_hard.jsonl", "hard_testimonial_footnote_disclosure", "clean: disclosure in a footnote on the same page"),
    ("cases_injection.jsonl", "inj_ignore_previous", "injection asks for zero flags"),
    ("cases_injection.jsonl", "inj_fake_json", "page smuggles a fake detector answer"),
    ("cases_injection.jsonl", "inj_plant_flag_clean", "injection tries to plant a false flag"),
    ("cases_generalize.jsonl", "gen_conflict_free_about", "no-conflicts claim (top SEC finding, Apr 2024)"),
    ("cases_generalize.jsonl", "gen_ai_first", "AI washing (Mar 2024 actions)"),
    ("cases_generalize.jsonl", "gen_conflict_disclosed_clean", "clean control: conflicts acknowledged"),
    ("cases_demo_site.jsonl", "demo_testimonials", "demo page, per-quote disclosure (old miss #8)"),
    ("cases_demo_site.jsonl", "demo_fees_clean", "clean full demo page"),
]


def main() -> None:
    cache: dict[str, dict] = {}
    out = []
    for group, picks in (("feedback", FEEDBACK), ("important", IMPORTANT)):
        for fname, cid, reason in picks:
            if fname not in cache:
                cache[fname] = {c["id"]: c for c in map(json.loads, filter(str.strip, (HERE / fname).open()))}
            c = dict(cache[fname][cid])  # KeyError = a source case was renamed: fix the list
            c.pop("pair", None)  # the panel holds only one side of most pairs; pair scoring would be misleading
            c.pop("role", None)
            out.append({**c, "panel_group": group, "panel_reason": reason, "source": fname})
    path = HERE / "cases_versus.jsonl"
    path.write_text("".join(json.dumps(c) + "\n" for c in out))
    n_clean = sum(1 for c in out if not c["gold"])
    print(f"wrote {path.name}: {len(out)} cases ({len(FEEDBACK)} feedback, {len(IMPORTANT)} important; {n_clean} clean)")


if __name__ == "__main__":
    main()
