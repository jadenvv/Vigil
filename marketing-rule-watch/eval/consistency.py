#!/usr/bin/env python3
"""Run the same pages through a detector N times and report how often the flags agree.

Tester A (Check 1): "you can get differing responses even though the response should be the same".
A flag is (category, span). Per page we report whether every run returned the identical flag set,
and the Jaccard overlap between runs. Small n: report it with its n, never as a general rate.

  python3 eval/consistency.py --detector https://<app>/functions/detect-text \
      --cases eval/cases_demo_site.jsonl --ids demo_home,demo_performance,demo_testimonials --runs 2

Every call is one request with no retry. Stops (no report) if the endpoint isn't answering with an LLM.
"""
from __future__ import annotations

import argparse
import itertools
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compliance_eval import DetectorUnavailable, _flags, _provider, load_detector  # noqa: E402


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a | b else 1.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--detector", required=True)
    ap.add_argument("--cases", default=str(HERE / "cases_demo_site.jsonl"))
    ap.add_argument("--ids", required=True, help="comma-separated case ids")
    ap.add_argument("--runs", type=int, default=2)
    ap.add_argument("--out", default=str(HERE / "reports"))
    ap.add_argument("--expect-provider", metavar="NAME", help="stop (no report) if another provider answers")
    a = ap.parse_args()
    if a.runs < 2:
        ap.error("--runs must be at least 2 (a single run has nothing to compare with)")
    if a.runs > 10:
        ap.error("--runs is capped at 10 (LLM quota)")

    wanted = a.ids.split(",")
    cases = {c["id"]: c for c in map(json.loads, Path(a.cases).read_text().splitlines()) if c["id"] in wanted}
    missing = [i for i in wanted if i not in cases]
    if missing:
        sys.exit(f"Unknown case ids: {missing}")
    detect, _ = load_detector(a.detector)

    pages = []
    for cid in wanted:
        c, runs = cases[cid], []
        for n in range(a.runs):
            try:
                raw = detect(c["text"], c.get("channel", ""))
            except DetectorUnavailable as e:
                sys.exit(f"Stopped on {cid} run {n + 1}: {e}. No report saved.")
            pv = _provider(raw)
            if a.expect_provider and pv and pv.split(":")[0] != a.expect_provider:
                sys.exit(f"Mixed-provider run: {cid} run {n + 1} answered by {pv!r}, "
                         f"expected {a.expect_provider!r}. No report saved.")
            runs.append({"provider": pv,
                         "flags": sorted({(f["category"], f["span"]) for f in _flags(raw)})})
        sets = [set(r["flags"]) for r in runs]
        pairs = list(itertools.combinations(sets, 2))
        pages.append({"id": cid, "identical": all(s == sets[0] for s in sets),
                      "jaccard_mean": sum(jaccard(x, y) for x, y in pairs) / len(pairs),
                      "categories_identical": len({frozenset(c for c, _ in s) for s in sets}) == 1,
                      "runs": runs})

    rep = {"detector": a.detector, "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"), "runs_per_page": a.runs,
           "n_pages": len(pages), "pages_identical": sum(p["identical"] for p in pages),
           "pages_same_categories": sum(p["categories_identical"] for p in pages),
           "jaccard_mean": sum(p["jaccard_mean"] for p in pages) / len(pages), "pages": pages}
    for p in pages:
        print(f"{p['id']:24s} identical={p['identical']!s:5s} same categories={p['categories_identical']!s:5s} "
              f"jaccard={p['jaccard_mean']:.2f}  flags per run={[len(r['flags']) for r in p['runs']]}  "
              f"providers={[r['provider'] for r in p['runs']]}")
    print(f"\n{rep['pages_identical']}/{rep['n_pages']} pages gave identical flag sets across {a.runs} runs; "
          f"{rep['pages_same_categories']}/{rep['n_pages']} same categories; mean Jaccard {rep['jaccard_mean']:.2f}")
    out = Path(a.out) / f"consistency_{time.strftime('%H%M%S')}.json"
    out.write_text(json.dumps(rep, indent=2))
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
