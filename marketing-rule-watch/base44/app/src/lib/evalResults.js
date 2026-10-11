// Measured results for the home page. Source of truth: marketing-rule-watch/research/slide_numbers.md
// (live run 16:03–16:05 on 10-10, model Base44 InvokeLLM). Copy numbers and caveats from there only:
// never round up, never add a number that file doesn't have. Synthetic-case F1 stays off the home page.
export const EVAL_TITLE = "How we measure ourselves";

export const EVAL_RESULTS = [
  {
    label: "Clean cases wrongly flagged",
    value: "28% → 0%",
    detail: "Keyword rules flagged 5 of 18 clean cases; Vigil flagged 0 of 18.",
    set: "37 cases we wrote, unreviewed",
  },
  {
    label: "Planted issues found",
    value: "21 of 21",
    detail: "Keyword rules found 15 of 21 on the same cases.",
    set: "37 cases we wrote, unreviewed",
  },
  {
    label: "Tester-style cases caught",
    value: "5 of 5",
    detail: "0 of 5 clean cases flagged. Keyword rules caught 0 of 5 and flagged 2 of 5 clean.",
    set: "10 cases we wrote from Sense Check comments",
  },
  {
    label: "Demo firm, planted issues",
    value: "9 → 11 of 11",
    detail: "Found 9 of 11 first, fixed the 2 misses on this site, now 11 of 11 with 0 false alarms.",
    set: "Our fictional site; a development set",
  },
];

export const EVAL_CAVEAT =
  "Our own tests, one run each, on cases we wrote. Not real-world accuracy. The detection prompt was developed with these cases visible. Model: Base44 InvokeLLM.";
