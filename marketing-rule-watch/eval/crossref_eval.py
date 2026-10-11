#!/usr/bin/env python3
"""
Cross-reference eval: does the detector catch a firm contradicting itself across documents?

WHAT IT MEASURES
  Pass 1 of the detector pulls checkable claims out of each document ("we've never had a losing
  year", "fee-only", "over $2 billion"); pass 2 checks each one against the firm's OTHER documents
  (other pages, old blog posts, its Form ADV). This scores that end to end:
  - Contradictions caught (recall), precision, F1
  - Near-miss cases wrongly flagged: boilerplate, compatible numbers, a loss that belongs to another
    product or firm, a quoted bad example, an injection. These must stay quiet.
  - Grounding: share of flags whose claim_span AND evidence_span are exact substrings of the
    documents their URLs name. Must be 100%: an officer has to be able to find both quotes.

HONESTY NOTE
  Every case in cases_crossref.jsonl is provenance="pattern_synthetic", reviewed=false, about
  fictional firms. Written to the shape of real ADV disclosures, not labelled by a compliance
  professional. Output is "potential issue for review", never legal advice.

USAGE
  python3 eval/crossref_eval.py --detector stub -v                       # offline keyword stub
  python3 eval/crossref_eval.py --detector engine.crossref:crossref -v   # real detector (spends LLM credits)
  python3 eval/crossref_eval.py --detector stub --out eval/reports/crossref_stub.json

DETECTOR CONTRACT
  crossref(docs: list[dict]) -> list[dict]
    doc:  {"url": str, "markdown": str, "channel": optional}
    flag: {"claim_span", "claim_url", "evidence_span", "evidence_url", "topic", "confidence", "why"}
  A {"flags": [...]} dict is accepted too.

MATCHING
  A flag matches an expected contradiction when claim_contains is in claim_span and
  evidence_contains is in evidence_span (case-insensitive), and claim_url / evidence_url equal the
  expected ones (skipped when the expected entry omits a URL). Each expected item matches at most
  one flag; duplicates and ungrounded flags count as false positives, as they would mislead or
  annoy an officer.

  Any exception from the detector stops the run with no report: a dead LLM must never be scored
  as "found nothing, so the near misses passed".
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOPICS = {"losses", "returns", "guarantees", "conflicts", "fees", "size", "credentials", "regulatory", "other"}
KINDS = {"contradiction", "consistent", "boilerplate", "different_scope", "injection"}


# ----------------------------------------------------------------------------
# Stub detector: trivial keyword rules so the scorer runs offline. Not a baseline worth beating
# on its own; it exists to exercise the harness. Claim and evidence spans are whole sentences.
# ----------------------------------------------------------------------------
_STUB_RULES = [
    # topic, claim pattern, evidence pattern
    ("losses", r"never had a losing year|not had a negative|not posted a calendar-year loss|never lost",
     r"declined \d|lost \d"),
    ("conflicts", r"conflict-free|free of conflicts", r"12b-1|revenue sharing"),
    ("fees", r"never accepts? commissions|fee-only|no commissions", r"commission|compensation for the sale"),
    ("guarantees", r"guaranteed income|guaranteed returns", r"not guaranteed"),
    ("regulatory", r"no disciplinary history|spotless record", r"consent order|fine of"),
    ("credentials", r"every adviser .*(?:CFP|CERTIFIED FINANCIAL PLANNER)", r"candidate"),
    ("size", r"manage over \$[\d.,]+ (?:million|billion)", r"\$[\d,]{9,} in regulatory assets"),
]


def _sentences(md: str):
    # Split on . ! ? followed by whitespace or end of line, so "7.4%" stays in one sentence.
    for m in re.finditer(r"(?:[^\n.!?]|[.!?](?=\S))+(?:[.!?]|$)", md, re.M):
        s = m.group(0).strip()
        if s:
            yield s


def stub_crossref(docs: list[dict]) -> list[dict]:
    flags = []
    for topic, claim_re, ev_re in _STUB_RULES:
        for d in docs:
            for claim in _sentences(d["markdown"]):
                if not re.search(claim_re, claim, re.I):
                    continue
                for o in docs:
                    if o["url"] == d["url"]:
                        continue
                    for ev in _sentences(o["markdown"]):
                        if re.search(ev_re, ev, re.I):
                            flags.append({"claim_span": claim, "claim_url": d["url"], "evidence_span": ev,
                                          "evidence_url": o["url"], "topic": topic, "confidence": 0.5,
                                          "why": f"stub keyword match ({topic})"})
                            break
    return flags


# ----------------------------------------------------------------------------
# Loading and validation
# ----------------------------------------------------------------------------
def load_cases(path: Path) -> list[dict]:
    cases, seen = [], set()
    for n, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        c = json.loads(line)
        cid = c.get("id")
        if cid in seen:
            sys.exit(f"duplicate case id {cid} (line {n})")
        seen.add(cid)
        if c.get("kind") not in KINDS:
            sys.exit(f"{cid}: unknown kind {c.get('kind')!r}")
        docs = {d["url"]: d["markdown"] for d in c["docs"]}
        if len(docs) != len(c["docs"]):
            sys.exit(f"{cid}: duplicate doc url")
        if (c["kind"] == "contradiction") != bool(c.get("expected")):
            sys.exit(f"{cid}: kind {c['kind']} must {'have' if c['kind'] == 'contradiction' else 'not have'} expected flags")
        for e in c.get("expected", []):
            for side in ("claim", "evidence"):
                needle, url = e[f"{side}_contains"], e.get(f"{side}_url")
                pool = [docs[url]] if url else list(docs.values())
                if url and url not in docs:
                    sys.exit(f"{cid}: expected {side}_url not among docs: {url}")
                if not any(needle.lower() in md.lower() for md in pool):
                    sys.exit(f"{cid}: expected {side}_contains not found: {needle!r}")
        cases.append(c)
    return cases


def load_detector(spec: str):
    if spec == "stub":
        return stub_crossref
    mod_name, _, fn_name = spec.partition(":")
    sys.path.insert(0, str(Path.cwd()))
    mod = importlib.import_module(mod_name)
    return getattr(mod, fn_name or "crossref")


def _flags(raw) -> list[dict]:
    if isinstance(raw, dict):
        raw = raw.get("flags", [])
    out = []
    for p in raw or []:
        out.append({k: str(p.get(k) or "") for k in
                    ("claim_span", "claim_url", "evidence_span", "evidence_url", "topic", "why")}
                   | {"confidence": float(p.get("confidence", 1.0) or 0.0)})
    return out


# ----------------------------------------------------------------------------
# Scoring
# ----------------------------------------------------------------------------
def grounded(flag: dict, docs: dict) -> bool:
    """Both spans are non-empty exact substrings of the docs their URLs name."""
    for side in ("claim", "evidence"):
        span, url = flag[f"{side}_span"], flag[f"{side}_url"]
        if not span.strip() or url not in docs or span not in docs[url]:
            return False
    return True


def matches(flag: dict, exp: dict) -> bool:
    for side in ("claim", "evidence"):
        if exp[f"{side}_contains"].lower() not in flag[f"{side}_span"].lower():
            return False
        if exp.get(f"{side}_url") and exp[f"{side}_url"] != flag[f"{side}_url"]:
            return False
    return True


def score_case(c: dict, preds: list[dict]) -> dict:
    docs = {d["url"]: d["markdown"] for d in c["docs"]}
    expected = c.get("expected", [])
    used, tp, fp, n_ung = set(), 0, 0, 0
    detail = []
    for p in sorted(preds, key=lambda p: -p["confidence"]):
        g = grounded(p, docs)
        hit = None
        if g:
            hit = next((i for i, e in enumerate(expected) if i not in used and matches(p, e)), None)
        else:
            n_ung += 1
        if hit is None:
            fp += 1
        else:
            used.add(hit)
            tp += 1
        detail.append({**p, "grounded": g, "matched": hit})
    fn = len(expected) - len(used)
    if not expected:
        status = "false_positive" if preds else "ok"
    elif fn and fp:
        status = "miss+fp"
    elif fn:
        status = "miss"
    elif fp:
        status = "extra_flag"
    else:
        status = "ok"
    return {"id": c["id"], "kind": c["kind"], "reviewed": bool(c.get("reviewed")),
            "tp": tp, "fp": fp, "fn": fn, "n_pred": len(preds), "ungrounded": n_ung,
            "missed": [e for i, e in enumerate(expected) if i not in used],
            "status": status, "flags": detail}


def aggregate(recs: list[dict]) -> dict:
    TP, FP, FN = (sum(r[k] for r in recs) for k in ("tp", "fp", "fn"))
    n_pred = sum(r["n_pred"] for r in recs)
    p = TP / (TP + FP) if TP + FP else None
    r = TP / (TP + FN) if TP + FN else None
    f = None if p is None or r is None else (0.0 if p + r == 0 else 2 * p * r / (p + r))
    near = [x for x in recs if x["kind"] != "contradiction"]
    contra = [x for x in recs if x["kind"] == "contradiction"]
    by_kind = defaultdict(lambda: {"cases": 0, "flagged": 0, "tp": 0, "fn": 0})
    for x in recs:
        k = by_kind[x["kind"]]
        k["cases"] += 1
        k["flagged"] += int(x["n_pred"] > 0)
        k["tp"] += x["tp"]
        k["fn"] += x["fn"]
    return {
        "n_cases": len(recs), "n_contradiction_cases": len(contra), "n_near_miss_cases": len(near),
        "precision": p, "recall": r, "f1": f, "tp": TP, "fp": FP, "fn": FN,
        "contradiction_cases_fully_caught": sum(1 for x in contra if x["fn"] == 0),
        "near_miss_flagged": sum(1 for x in near if x["n_pred"]),
        "near_miss_flagged_rate": (sum(1 for x in near if x["n_pred"]) / len(near)) if near else None,
        "grounding_rate": (1 - sum(x["ungrounded"] for x in recs) / n_pred) if n_pred else None,
        "n_flags": n_pred,
        "by_kind": dict(sorted(by_kind.items())),
    }


# ----------------------------------------------------------------------------
# Reporting
# ----------------------------------------------------------------------------
def _f(x, pct=False):
    if x is None:
        return "   - "
    return f"{x*100:4.0f}%" if pct else f"{x:5.2f}"


def _short(s: str, n: int = 90) -> str:
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 3] + "..."


def print_report(rep: dict, verbose: bool) -> None:
    m = rep["metrics"]
    print(f"\nDetector: {rep['detector']}   cases: {rep['n_cases']}   ({rep['timestamp']})")
    print(f"  contradictions caught (recall) {_f(m['recall'])}   precision {_f(m['precision'])}   F1 {_f(m['f1'])}"
          f"   (tp {m['tp']} fp {m['fp']} fn {m['fn']})")
    print(f"  contradiction cases fully caught {m['contradiction_cases_fully_caught']}/{m['n_contradiction_cases']}")
    print(f"  near-miss cases wrongly flagged {m['near_miss_flagged']}/{m['n_near_miss_cases']}"
          f" ({_f(m['near_miss_flagged_rate'], True).strip()})")
    print(f"  grounding {_f(m['grounding_rate'], True)}   flags {m['n_flags']}")
    print(f"  {'kind':16s} cases flagged  tp  fn")
    for k, v in m["by_kind"].items():
        print(f"  {k:16s} {v['cases']:5d} {v['flagged']:7d} {v['tp']:3d} {v['fn']:3d}")
    if verbose:
        print("\nPer case:")
        for r in rep["cases"]:
            print(f"  {r['id']:36s} {r['kind']:16s} {r['status']:15s} tp {r['tp']} fp {r['fp']} fn {r['fn']}")
            for e in r["missed"]:
                print(f"      MISSED  claim~{e['claim_contains']!r}  evidence~{e['evidence_contains']!r}")
            for fl in r["flags"]:
                tag = "TP" if fl["matched"] is not None else ("FP-UNGROUNDED" if not fl["grounded"] else "FP")
                print(f"      {tag:13s} [{fl['topic']}] claim: {_short(fl['claim_span'])!r}")
                print(f"      {'':13s} evidence: {_short(fl['evidence_span'])!r} ({fl['evidence_url']})")


def run(cases: list[dict], detect, detector_name: str, cases_sha: str = "") -> dict:
    recs = []
    for i, c in enumerate(cases, 1):
        docs = [{k: d[k] for k in ("url", "markdown", "channel") if k in d} for d in c["docs"]]
        try:
            preds = _flags(detect(docs))
        except Exception as e:  # LLM down, quota, bug: never score a failure as a quiet, clean run
            sys.exit(f"Stopped at case {i}/{len(cases)} ({c['id']}): detector raised "
                     f"{type(e).__name__}: {e}. No report saved.")
        recs.append(score_case(c, preds))
    return {"detector": detector_name, "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "cases_sha": cases_sha, "n_cases": len(cases), "metrics": aggregate(recs),
            "metrics_reviewed": aggregate([r for r in recs if r["reviewed"]]), "cases": recs}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--detector", required=True, help="'stub' or module:function, e.g. engine.crossref:crossref")
    ap.add_argument("--cases", default=str(HERE / "cases_crossref.jsonl"))
    ap.add_argument("--out", default=str(HERE / "reports"), help="report directory, or a path ending in .json")
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()

    cases_path = Path(a.cases)
    cases = load_cases(cases_path)
    detect = load_detector(a.detector)
    rep = run(cases, detect, a.detector, hashlib.sha1(cases_path.read_bytes()).hexdigest()[:10])
    print_report(rep, a.verbose)
    if not a.no_save:
        out = Path(a.out)
        if out.suffix != ".json":
            name = re.sub(r"[^A-Za-z0-9_.-]+", "_", a.detector)
            out = out / f"crossref_{name}_{time.strftime('%H%M%S')}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(rep, indent=2, ensure_ascii=False))
        print(f"\nSaved {out}")


if __name__ == "__main__":
    main()
