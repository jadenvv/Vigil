#!/usr/bin/env python3
"""
One runner for every LLM eval: detect.md v3 vs v4 over each case set, plus the two-pass crossref
(claims vs Form ADV and other docs) and, optionally, the private SEC-order set.

DRY RUN BY DEFAULT. It prints each job, its report name and a rough token estimate, then exits.
Nothing calls the LLM unless you pass --go.

    python3 eval/run_all.py                                  # plan + estimate, no calls
    python3 eval/run_all.py --go                             # run within --budget, skipping reports that exist
    python3 eval/run_all.py --go --only detect --sets generalize,scope
    python3 eval/run_all.py --go --only crossref
    python3 eval/run_all.py --go --private                   # + private SEC set (reports stay in private-eval-data/)
    python3 eval/run_all.py --smoke                          # offline plumbing check: rules mode + crossref stub

COST SAFETY
  - LLM_MODEL is pinned for every job (--model, default from .env) and goes in every report name.
  - Each job stops at the first detector error (e.g. a Groq 429) with no report, and the runner stops too,
    so a quota cap never gets scored as misses or clean docs.
  - Jobs whose report already exists are skipped (--force to redo), so a run cut off by a daily cap
    resumes where it stopped. v3 and v4 alternate per set, so a cut-off leaves comparable pairs.
  - --budget caps the estimated tokens; jobs past it are listed but not run. Groq's free tier allows
    ~200k tokens/day per model and 8k/min, so one full pass may take more than one day per model.
  - The harness rewrite check is off (detect_versions exposes no rewrite): it would triple the cost.

ESTIMATES ARE ROUGH: chars/4 for prompt + text, plus a fixed allowance for output and reasoning.
Crossref assumes 2 checkable claims per doc in pass 2; the real number depends on the model.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PROMPTS = ROOT / "engine" / "prompts"
REPORTS = HERE / "reports"
PRIVATE = ROOT.parent.parent / "private-eval-data"
PRIVATE_CASES = PRIVATE / "cases_sec_orders.jsonl"

# Order = priority. Held-out and test sets first: they are what v4 has never been measured on.
DETECT_SETS = ["generalize", "scope", "hard", "injection", "tester", "demo_site", "holdout", "seeded", "pages"]
CASE_FILE = {"seeded": "cases.jsonl"}
PROMPT_VERSIONS = ["v3", "v4"]

OUT_TOKENS = 700         # detect: JSON flags + reasoning at default effort
CR_OUT_TOKENS = 900      # crossref: low reasoning, but longer JSON
CR_CLAIMS_PER_DOC = 2
CHUNK = 6000


def _tag(model: str) -> str:
    """openai/gpt-oss-20b -> groq20b-style short tag for report names."""
    m = re.search(r"(\d+)b\b", model)
    base = re.sub(r"[^a-z0-9]+", "", model.split("/")[-1].lower())
    return f"groq{m.group(1)}b" if m and "gpt-oss" in model else base


def _cases(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def _detect_tokens(cases: list[dict], prompt_chars: int) -> tuple[int, int]:
    calls = toks = 0
    for c in cases:
        n = max(1, math.ceil(len(c["text"]) / CHUNK))
        calls += n
        toks += n * ((prompt_chars + min(len(c["text"]), CHUNK)) // 4 + OUT_TOKENS)
    return calls, toks


def _crossref_tokens(cases: list[dict]) -> tuple[int, int]:
    p1 = len((PROMPTS / "absolutes.md").read_text())
    p2 = len((PROMPTS / "contradict.md").read_text())
    k = int(os.environ.get("CROSSREF_K", "6"))
    cap = int(os.environ.get("CROSSREF_MAX_CLAIMS", "40"))
    calls = toks = 0
    for c in cases:
        docs = c["docs"]
        for d in docs:
            n = max(1, math.ceil(len(d.get("markdown", "")) / CHUNK))
            calls += n
            toks += n * ((p1 + min(len(d.get("markdown", "")), CHUNK)) // 4 + CR_OUT_TOKENS)
        claims = min(cap, CR_CLAIMS_PER_DOC * len(docs))
        calls += claims
        toks += claims * ((p2 + k * 500) // 4 + CR_OUT_TOKENS)
    return calls, toks


def plan(a) -> list[dict]:
    tag = a.tag or _tag(a.model)
    jobs = []
    if a.only in (None, "detect"):
        sets = a.sets.split(",") if a.sets else DETECT_SETS
        for s in sets:
            path = HERE / CASE_FILE.get(s, f"cases_{s}.jsonl")
            if not path.is_file():
                sys.exit(f"unknown set {s!r}: {path} not found")
            cases = _cases(path)
            for v in PROMPT_VERSIONS:
                calls, toks = _detect_tokens(cases, len((PROMPTS / f"detect_{v}.md").read_text()))
                jobs.append({"name": f"detect {v} {s}", "kind": "detect", "cases": path, "n": len(cases),
                             "detector": f"engine.detect_versions:detect_{v}",
                             "out": REPORTS / f"llm_{tag}_{v}_{s}.json", "calls": calls, "tokens": toks})
    if a.only in (None, "crossref"):
        path = HERE / "cases_crossref.jsonl"
        cases = _cases(path)
        calls, toks = _crossref_tokens(cases)
        jobs.append({"name": "crossref two-pass", "kind": "crossref", "cases": path, "n": len(cases),
                     "detector": "engine.crossref:crossref",
                     "out": REPORTS / f"llm_{tag}_crossref.json", "calls": calls, "tokens": toks})
    if a.private and a.only in (None, "detect"):
        if not PRIVATE_CASES.is_file():
            sys.exit(f"--private: {PRIVATE_CASES} not found")
        cases = _cases(PRIVATE_CASES)
        for v in PROMPT_VERSIONS:
            calls, toks = _detect_tokens(cases, len((PROMPTS / f"detect_{v}.md").read_text()))
            jobs.append({"name": f"detect {v} sec_orders (private)", "kind": "detect", "cases": PRIVATE_CASES,
                         "n": len(cases), "detector": f"engine.detect_versions:detect_{v}",
                         "out": PRIVATE / "reports" / f"llm_{tag}_{v}_sec.json", "calls": calls, "tokens": toks})
    return jobs


def command(job: dict, smoke_dir: Path | None) -> list[str]:
    script = "compliance_eval.py" if job["kind"] == "detect" else "crossref_eval.py"
    detector = job["detector"]
    out = job["out"]
    if smoke_dir is not None:
        if job["kind"] == "crossref":
            detector = "stub"
        out = smoke_dir / out.name
    cmd = [sys.executable, str(HERE / script), "--detector", detector, "--cases", str(job["cases"]), "--out", str(out)]
    if job["kind"] == "detect":
        cmd.append("--stop-on-error")
    return cmd


def _summary(path: Path) -> str:
    rep = json.loads(path.read_text())
    m = rep.get("metrics") or rep["subsets"]["all"]
    f = lambda x: "-" if x is None else f"{x:.2f}"
    extra = (f"clean flagged {f(m.get('clean_doc_fp_rate'))}" if "clean_doc_fp_rate" in m
             else f"near-miss flagged {m.get('near_miss_flagged')}/{m.get('n_near_miss_cases')}")
    return f"P {f(m['precision'])} R {f(m['recall'])} F1 {f(m['f1'])}  {extra}"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--go", action="store_true", help="actually call the LLM (default: dry run)")
    ap.add_argument("--smoke", action="store_true", help="offline: rules mode + crossref stub, reports to a temp dir")
    ap.add_argument("--only", choices=["detect", "crossref"])
    ap.add_argument("--sets", help=f"comma list from {','.join(DETECT_SETS)}")
    ap.add_argument("--private", action="store_true", help="also run the private SEC-order set (never commit it)")
    ap.add_argument("--model", help="LLM_MODEL to pin (default: the one .env selects)")
    ap.add_argument("--tag", help="report-name tag (default from the model, e.g. groq20b)")
    ap.add_argument("--budget", type=int, default=150_000, help="max estimated tokens to spend (default 150k)")
    ap.add_argument("--force", action="store_true", help="re-run jobs whose report already exists")
    a = ap.parse_args()

    sys.path.insert(0, str(ROOT))
    if not a.model:
        if a.smoke:
            a.model = "rules"
        else:
            from engine import llm
            a.model = llm.config()["model"]
    jobs = plan(a)

    total = spent = 0
    print(f"model {a.model}   budget ~{a.budget:,} tokens   {'SMOKE (offline)' if a.smoke else 'GO' if a.go else 'DRY RUN'}\n")
    print(f"  {'job':34s} {'cases':>5s} {'calls':>5s} {'~tokens':>8s}  report")
    for j in jobs:
        exists = j["out"].is_file() and not a.force
        j["skip"] = "exists" if exists else None
        if not exists:
            if total + j["tokens"] > a.budget:
                j["skip"] = "over budget"
            else:
                total += j["tokens"]
        note = f"  [{j['skip']}]" if j["skip"] else ""
        print(f"  {j['name']:34s} {j['n']:5d} {j['calls']:5d} {j['tokens']:8,d}  {j['out'].name}{note}")
    print(f"\n  to run: {sum(1 for j in jobs if not j['skip'])} jobs, ~{total:,} tokens "
          f"(all jobs: ~{sum(j['tokens'] for j in jobs):,})")

    if not (a.go or a.smoke):
        print("\nDry run: nothing was called. Add --go to spend credits.")
        return

    env = {**os.environ, "LLM_MODEL": a.model}
    smoke_dir = None
    if a.smoke:
        import tempfile
        smoke_dir = Path(tempfile.mkdtemp(prefix="run_all_smoke_"))
        env.update(DETECT_MODE="rules", LLM_PROVIDER="none")
        for j in jobs:
            j["skip"] = None
    else:
        env.setdefault("CROSSREF_MAX_TOKENS", "2000")  # the reservation counts against an 8k TPM limit

    done = []
    for j in jobs:
        if j["skip"]:
            continue
        print(f"\n=== {j['name']} ===", flush=True)
        r = subprocess.run(command(j, smoke_dir), cwd=ROOT, env=env, capture_output=True, text=True)
        tail = (r.stdout + r.stderr).strip().splitlines()[-3:]
        if r.returncode != 0:
            print("\n".join(tail))
            print(f"\nStopped: {j['name']} failed (quota or error). Reports so far are kept; re-run to resume.")
            break
        out = smoke_dir / j["out"].name if smoke_dir else j["out"]
        print(f"  {_summary(out)}   -> {out}")
        done.append((j, out))

    pairs = {}
    for j, out in done:
        if j["kind"] == "detect":
            pairs.setdefault(j["name"].split(" ", 2)[2], {})[j["name"].split()[1]] = out
    for s, vs in pairs.items():
        if {"v3", "v4"} <= vs.keys():
            print(f"\n--- v3 vs v4: {s} ---", flush=True)
            subprocess.run([sys.executable, str(HERE / "compliance_eval.py"), "--compare", str(vs["v3"]), str(vs["v4"])],
                           cwd=ROOT)


if __name__ == "__main__":
    main()
