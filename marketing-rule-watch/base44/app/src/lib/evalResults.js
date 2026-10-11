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

// Next detector version (detect.md v4). NOT deployed: the live app still runs v3, so render this apart from
// EVAL_RESULTS and never under EVAL_CAVEAT (different model). Source: eval/reports/llm_groq20b_v{3,4}_generalize.json.
export const EVAL_NEXT = {
  label: "Held-out issues found, next version",
  value: "5 → 7 of 9",
  detail: "Detector v4 vs the live v3 prompt on the 11 held-out cases both answered; 0 of 3 clean cases flagged by either.",
  set: "Held-out cases a teammate wrote from public SEC risk alerts before v4",
  caveat:
    "Next detector version, not yet live. One run on a smaller model (gpt-oss-20b via Groq), not the live app's Base44 InvokeLLM. 3 of 14 cases errored on the model's daily cap and are left out. Cases written by the same person who then wrote v4; unreviewed.",
};

// Full numbers for the /evals page, generated from the report JSONs in eval/reports/ (one run each; ratios
// rounded to 2 places). Each run names its model and whether it is the live app. Keyword rows use no model.
export const details = {
  sets: [
    {
      id: "synthetic",
      title: "37 synthetic cases",
      caveat: "37 cases we wrote from SEC deficiency categories; no compliance professional reviewed them. The detection prompt was developed with these cases visible. One run each.",
      runs: [
        {
          label: "Keyword rules (baseline_regex)",
          model: null,
          live: false,
          report: "baseline_regex_120954.json",
          cases: 37,
          precision: 0.68,
          recall: 0.71,
          f1: 0.7,
          tp: 15,
          fp: 7,
          fn: 6,
          cleanFlagged: "5 of 18",
          cleanFlaggedRate: 0.28,
          grounding: 1.0,
          minimalPairs: "6 of 8",
          perCategory: {
            BENEFITS_WITHOUT_RISK: {
              tp: 3,
              fp: 2,
              fn: 2
            },
            GROSS_WITHOUT_NET: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            HYPOTHETICAL_PERFORMANCE: {
              tp: 2,
              fp: 2,
              fn: 0
            },
            RATING_NO_DISCLOSURE: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 1,
              fp: 0,
              fn: 2
            },
            UNBALANCED_SPECIFIC_ADVICE: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            UNFAIR_PERFORMANCE_PRESENTATION: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 2,
              fp: 3,
              fn: 2
            }
          }
        },
        {
          label: "Vigil, live detector v3",
          model: "Base44 InvokeLLM (live app, detector v3)",
          live: true,
          report: "llm_invokellm_160353.json",
          cases: 37,
          precision: 0.95,
          recall: 1.0,
          f1: 0.98,
          tp: 21,
          fp: 1,
          fn: 0,
          cleanFlagged: "0 of 18",
          cleanFlaggedRate: 0.0,
          grounding: 1.0,
          minimalPairs: "8 of 8",
          perCategory: {
            BENEFITS_WITHOUT_RISK: {
              tp: 5,
              fp: 1,
              fn: 0
            },
            GROSS_WITHOUT_NET: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            HYPOTHETICAL_PERFORMANCE: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            RATING_NO_DISCLOSURE: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 3,
              fp: 0,
              fn: 0
            },
            UNBALANCED_SPECIFIC_ADVICE: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            UNFAIR_PERFORMANCE_PRESENTATION: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 4,
              fp: 0,
              fn: 0
            }
          },
          note: "The one false positive (email_riskfree) flagged \"pays 7% every year\", arguably a real issue our label left out; still scored as a false positive."
        }
      ]
    },
    {
      id: "tester",
      title: "10 tester-style cases",
      caveat: "10 cases written by us based on Sense Check 1 testers' comments (not tester-labeled). 3 were written together with the fix they test, so not an independent test. One run each.",
      runs: [
        {
          label: "Keyword rules (baseline_regex)",
          model: null,
          live: false,
          report: "baseline_regex_tester.json",
          cases: 10,
          precision: 0.0,
          recall: 0.0,
          f1: 0.0,
          tp: 0,
          fp: 7,
          fn: 5,
          cleanFlagged: "2 of 5",
          cleanFlaggedRate: 0.4,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            BENEFITS_WITHOUT_RISK: {
              tp: 0,
              fp: 3,
              fn: 4
            },
            HYPOTHETICAL_PERFORMANCE: {
              tp: 0,
              fp: 1,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 0,
              fp: 2,
              fn: 0
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 0,
              fp: 1,
              fn: 1
            }
          }
        },
        {
          label: "Vigil, live detector v3",
          model: "Base44 InvokeLLM (live app, detector v3)",
          live: true,
          report: "llm_invokellm_tester_160414.json",
          cases: 10,
          precision: 1.0,
          recall: 1.0,
          f1: 1.0,
          tp: 5,
          fp: 0,
          fn: 0,
          cleanFlagged: "0 of 5",
          cleanFlaggedRate: 0.0,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            BENEFITS_WITHOUT_RISK: {
              tp: 4,
              fp: 0,
              fn: 0
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 1,
              fp: 0,
              fn: 0
            }
          }
        }
      ]
    },
    {
      id: "demo_site",
      title: "16 demo-site cases",
      caveat: "Taken from our own fictional site, Quarrywick Wealth. A development set: the 2 misses found on this site were fixed before this run. Not real-world accuracy. One run each.",
      runs: [
        {
          label: "Keyword rules (baseline_regex)",
          model: null,
          live: false,
          report: "baseline_regex_demo_site.json",
          cases: 16,
          precision: 0.27,
          recall: 0.55,
          f1: 0.36,
          tp: 6,
          fp: 16,
          fn: 5,
          cleanFlagged: "5 of 8",
          cleanFlaggedRate: 0.62,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            BENEFITS_WITHOUT_RISK: {
              tp: 1,
              fp: 15,
              fn: 1
            },
            GROSS_WITHOUT_NET: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            HYPOTHETICAL_PERFORMANCE: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            RATING_NO_DISCLOSURE: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 0,
              fp: 0,
              fn: 1
            },
            UNBALANCED_SPECIFIC_ADVICE: {
              tp: 0,
              fp: 0,
              fn: 1
            },
            UNFAIR_PERFORMANCE_PRESENTATION: {
              tp: 0,
              fp: 0,
              fn: 1
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 1,
              fp: 1,
              fn: 1
            }
          }
        },
        {
          label: "Vigil, live detector v3",
          model: "Base44 InvokeLLM (live app, detector v3)",
          live: true,
          report: "llm_invokellm_demo_site_160443.json",
          cases: 16,
          precision: 1.0,
          recall: 1.0,
          f1: 1.0,
          tp: 11,
          fp: 0,
          fn: 0,
          cleanFlagged: "0 of 8",
          cleanFlaggedRate: 0.0,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            BENEFITS_WITHOUT_RISK: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            GROSS_WITHOUT_NET: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            HYPOTHETICAL_PERFORMANCE: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            RATING_NO_DISCLOSURE: {
              tp: 2,
              fp: 0,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            UNBALANCED_SPECIFIC_ADVICE: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            UNFAIR_PERFORMANCE_PRESENTATION: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 2,
              fp: 0,
              fn: 0
            }
          }
        }
      ]
    },
    {
      id: "generalize",
      title: "14 held-out cases (SEC 2024-2025 patterns)",
      caveat: "14 cases written by a teammate from public SEC risk alerts and sweeps (17:30), before detect.md v4 (18:29), by the same person who then wrote v4. The v3 detector never saw them. Unreviewed. Measured on a smaller model (gpt-oss-20b via Groq), not the live app's Base44 InvokeLLM, so these numbers are not comparable to the other sets' live numbers. One run each.",
      runs: [
        {
          label: "Keyword rules (baseline_regex)",
          model: null,
          live: false,
          report: "baseline_regex_generalize.json",
          cases: 14,
          precision: 0.0,
          recall: 0.0,
          f1: 0.0,
          tp: 0,
          fp: 2,
          fn: 12,
          cleanFlagged: "1 of 3",
          cleanFlaggedRate: 0.33,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            RATING_NO_DISCLOSURE: {
              tp: 0,
              fp: 0,
              fn: 3
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 0,
              fp: 0,
              fn: 2
            },
            UNFAIR_PERFORMANCE_PRESENTATION: {
              tp: 0,
              fp: 0,
              fn: 1
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 0,
              fp: 2,
              fn: 6
            }
          }
        },
        {
          label: "Detector v3 (the prompt live now)",
          model: "gpt-oss-20b via Groq, on a laptop (not the live app's model)",
          live: false,
          report: "llm_groq20b_v3_generalize.json",
          cases: 14,
          precision: 0.89,
          recall: 0.67,
          f1: 0.76,
          tp: 8,
          fp: 1,
          fn: 4,
          cleanFlagged: "0 of 3",
          cleanFlaggedRate: 0.0,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            RATING_NO_DISCLOSURE: {
              tp: 3,
              fp: 0,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 1,
              fp: 0,
              fn: 1
            },
            UNFAIR_PERFORMANCE_PRESENTATION: {
              tp: 1,
              fp: 0,
              fn: 0
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 3,
              fp: 1,
              fn: 3
            }
          }
        },
        {
          label: "Detector v4, next version, not yet live",
          model: "gpt-oss-20b via Groq, on a laptop (not the live app's model)",
          live: false,
          report: "llm_groq20b_v4_generalize.json",
          cases: 14,
          precision: 0.88,
          recall: 0.58,
          f1: 0.7,
          tp: 7,
          fp: 1,
          fn: 5,
          cleanFlagged: "0 of 3",
          cleanFlaggedRate: 0.0,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            RATING_NO_DISCLOSURE: {
              tp: 3,
              fp: 0,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 0,
              fp: 0,
              fn: 2
            },
            UNFAIR_PERFORMANCE_PRESENTATION: {
              tp: 0,
              fp: 0,
              fn: 1
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 4,
              fp: 1,
              fn: 2
            }
          },
          note: "3 of 14 cases errored on the model's daily cap and are scored as misses here."
        },
        {
          label: "Detector v3, the 11 cases both versions answered",
          model: "gpt-oss-20b via Groq, on a laptop (not the live app's model)",
          live: false,
          report: "llm_groq20b_v3_generalize.json",
          cases: 11,
          precision: 0.83,
          recall: 0.56,
          f1: 0.67,
          tp: 5,
          fp: 1,
          fn: 4,
          cleanFlagged: "0 of 3",
          cleanFlaggedRate: 0.0,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            RATING_NO_DISCLOSURE: {
              tp: 3,
              fp: 0,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 0,
              fp: 0,
              fn: 1
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 2,
              fp: 1,
              fn: 3
            }
          }
        },
        {
          label: "Detector v4 (not yet live), the same 11 cases",
          model: "gpt-oss-20b via Groq, on a laptop (not the live app's model)",
          live: false,
          report: "llm_groq20b_v4_generalize.json",
          cases: 11,
          precision: 0.88,
          recall: 0.78,
          f1: 0.82,
          tp: 7,
          fp: 1,
          fn: 2,
          cleanFlagged: "0 of 3",
          cleanFlaggedRate: 0.0,
          grounding: 1.0,
          minimalPairs: null,
          perCategory: {
            RATING_NO_DISCLOSURE: {
              tp: 3,
              fp: 0,
              fn: 0
            },
            TESTIMONIAL_NO_DISCLOSURE: {
              tp: 0,
              fp: 0,
              fn: 1
            },
            UNSUBSTANTIATED_CLAIM: {
              tp: 4,
              fp: 1,
              fn: 1
            }
          }
        }
      ]
    }
  ],
  consistency: {
    pages: 3,
    runsPerPage: 2,
    identical: "2 of 3",
    sameCategories: "3 of 3",
    model: "Base44 InvokeLLM (live app, detector v3)",
    report: "consistency_160459.json",
    caveat: "3 pages of our own fictional site, 2 runs each. The one difference was the same claim quoted at two lengths. Far too few calls for a rate."
  }
}
;
