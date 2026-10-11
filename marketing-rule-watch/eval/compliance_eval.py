#!/usr/bin/env python3
"""
Compliance-flag eval harness for an SEC Marketing Rule (Rule 206(4)-1) checker.

WHAT IT MEASURES
  - Span-level precision / recall / F1, overall and per issue category
  - False-positive rate on CLEAN documents (compliance officers hate noise)
  - Evidence grounding: does every flag quote text that really is in the document?
  - Citation accuracy: does the flag cite the right rule paragraph?
  - Minimal pairs: flags the bad version AND stays quiet on the fixed version
  - Rewrite check (optional): after your detector's rewrite, are the flags gone?

HONESTY NOTE
  Every case in cases.jsonl starts as provenance="pattern_synthetic", reviewed=false:
  written from SEC-published deficiency categories, NOT independently labeled by a
  compliance professional. Metrics are reported separately for reviewed=true cases.
  Flip a case to reviewed=true (and fix its label) when a real tester confirms or
  rejects it. Rule paragraph refs below are from memory: have a compliance
  professional confirm them. Output is "potential issue for review", never legal advice.

USAGE
  python3 compliance_eval.py --detector baseline_regex -v
  python3 compliance_eval.py --detector mydetector:detect       # module:function in cwd
  python3 compliance_eval.py --detector http://localhost:8000/detect
  python3 compliance_eval.py --compare reports/old.json reports/new.json

DETECTOR CONTRACT
  detect(text: str, channel: str) -> list[dict]
    each flag: {"category": <TAXONOMY id>, "span": <exact quote from text>,
                "rule": <optional, e.g. "206(4)-1(a)(4)">, "confidence": <optional 0-1>}
  Optional in the same module:  rewrite(text: str, flags: list[dict]) -> str
  HTTP detectors: POST {"text","channel"}, respond with a list or {"flags": [...]}.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
IOU_MIN = 0.3  # a flag matches a gold span if same category and character IoU >= this

TAXONOMY = {
    "UNSUBSTANTIATED_CLAIM": {"rule": "206(4)-1(a)(2)", "desc": "Material claim with no reasonable basis to substantiate"},
    "BENEFITS_WITHOUT_RISK": {"rule": "206(4)-1(a)(4)", "desc": "Benefits promoted without fair and balanced treatment of risks"},
    "UNBALANCED_SPECIFIC_ADVICE": {"rule": "206(4)-1(a)(5)", "desc": "Specific past advice shown without balance"},
    "UNFAIR_PERFORMANCE_PRESENTATION": {"rule": "206(4)-1(a)(6)", "desc": "Cherry-picked results or time periods"},
    "GROSS_WITHOUT_NET": {"rule": "206(4)-1(d)(1)", "desc": "Gross performance without net of equal prominence"},
    "HYPOTHETICAL_PERFORMANCE": {"rule": "206(4)-1(d)(6)", "desc": "Hypothetical / backtested performance shown broadly"},
    "TESTIMONIAL_NO_DISCLOSURE": {"rule": "206(4)-1(b)", "desc": "Testimonial/endorsement missing required disclosures"},
    "RATING_NO_DISCLOSURE": {"rule": "206(4)-1(c)", "desc": "Third-party rating missing required disclosures"},
}


# ----------------------------------------------------------------------------
# Baseline detector: deliberately naive keyword rules. It exists so the harness
# runs end to end today and so you can see how much headroom a real one has.
# ----------------------------------------------------------------------------
def baseline_regex(text: str, channel: str = "") -> list[dict]:
    flags: list[dict] = []

    def add(cat: str, span: str) -> None:
        flags.append({"category": cat, "span": span, "rule": TAXONOMY[cat]["rule"]})

    for m in re.finditer(r"(?:risk[- ]free|guarantee[sd]?(?: [A-Za-z0-9%$.]+){0,3}|can'?t lose|no risk|never lose[sd]?)", text, re.I):
        add("BENEFITS_WITHOUT_RISK", m.group(0).rstrip(" ."))
    for m in re.finditer(r"(?:#1|number one|\bbest\b|proven track record|outperform\w*|beats? the market)[^.,;]*", text, re.I):
        add("UNSUBSTANTIATED_CLAIM", m.group(0).rstrip(" ."))
    if not re.search(r"disclos|compensat|current client|paid", text, re.I):
        for m in re.finditer(r"[\"\u201c][^\"\u201d]{20,200}[\"\u201d]", text):
            add("TESTIMONIAL_NO_DISCLOSURE", m.group(0))
    if re.search(r"\bgross\b", text, re.I) and not re.search(r"\bnet\b", text, re.I):
        m = re.search(r"[^.]*\bgross\b[^.]*", text, re.I)
        add("GROSS_WITHOUT_NET", m.group(0).strip())
    for m in re.finditer(r"(?:back-?test\w*|hypothetical|simulated|model portfolio)[^.]*", text, re.I):
        add("HYPOTHETICAL_PERFORMANCE", m.group(0).strip())
    for m in re.finditer(r"(?:best year[^.]*|since the [A-Z][a-z]+ \d{4} (?:low|bottom)[^.]*)", text, re.I):
        add("UNFAIR_PERFORMANCE_PRESENTATION", m.group(0).strip())
    if not re.search(r"methodology|rating date|as of|paid|licensing", text, re.I):
        for m in re.finditer(r"(?:top[- ]rated|award[- ]winning|named (?:a )?top [^.]*|ranked #?\d+[^.]*)", text, re.I):
            add("RATING_NO_DISCLOSURE", m.group(0).strip())
    for m in re.finditer(r"(?:our (?:pick|call)|we (?:recommended|put clients in))[^.]*?(?:doubled|tripled|soared)[^.]*", text, re.I):
        add("UNBALANCED_SPECIFIC_ADVICE", m.group(0).strip())
    return flags


def naive_rewrite(text: str, flags: list[dict]) -> str:
    """Demo only: deletes flagged spans. Real rewrites need a human quality rating too."""
    for f in flags:
        if f.get("span"):
            text = text.replace(f["span"], "")
    return re.sub(r"\s+", " ", text).strip()


# ----------------------------------------------------------------------------
# Loading and validation
# ----------------------------------------------------------------------------
# Span grounding mirrors engine/postprocess.py ground() exactly (same normalization map), so the
# eval counts a flag grounded only when the app would keep it. Keep them in sync. Vendored rather
# than imported: engine.taxonomy execs this file to load TAXONOMY, so importing engine here is
# circular.
_TRANS = str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'",
                        "–": "-", "—": "-", " ": " "})


def _normalize_with_map(s: str) -> tuple[str, list[int]]:
    """Lowercase, straighten quotes, collapse whitespace; keep a map back to original indices."""
    out, idx, prev_space = [], [], False
    for i, ch in enumerate(s.translate(_TRANS)):
        if ch.isspace():
            if prev_space:
                continue
            ch, prev_space = " ", True
        else:
            prev_space = False
        out.append(ch.lower())
        idx.append(i)
    return "".join(out), idx


def locate(text: str, span: str):
    """(start, end) of the substring of text that span refers to, or None. Same repairs as
    production ground(): exact match, then stripped, then normalized (case/quote/whitespace drift)."""
    if not span or not span.strip():
        return None
    if span in text:
        i = text.find(span)
        return (i, i + len(span))
    span = span.strip().strip(".")
    if span and span in text:
        i = text.find(span)
        return (i, i + len(span))
    nt, idx = _normalize_with_map(text)
    ns, _ = _normalize_with_map(span)
    ns = ns.strip()
    i = nt.find(ns) if ns else -1
    if i < 0:
        return None
    return (idx[i], idx[i + len(ns) - 1] + 1)


def iou(a, b) -> float:
    inter = max(0, min(a[1], b[1]) - max(a[0], b[0]))
    union = (a[1] - a[0]) + (b[1] - b[0]) - inter
    return inter / union if union else 0.0


def load_cases(path: Path) -> list[dict]:
    cases, seen = [], set()
    for n, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        c = json.loads(line)
        if c["id"] in seen:
            sys.exit(f"duplicate case id {c['id']} (line {n})")
        seen.add(c["id"])
        for g in c.get("gold", []):
            if g["category"] not in TAXONOMY:
                sys.exit(f"{c['id']}: unknown category {g['category']}")
            if locate(c["text"], g["span"]) is None:
                sys.exit(f"{c['id']}: gold span not found in text: {g['span']!r}")
        cases.append(c)
    return cases


# Modes from detect-text whose flags came from an LLM. Anything else ("rules", "llm_error",
# "llm_unavailable", or a mode we don't know yet) stops the run.
LLM_MODES = {"llm", "llm_groq"}


def _ssl_context() -> ssl.SSLContext:
    """Use certifi's CA bundle when installed: python.org builds on macOS ship without one."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


class DetectorUnavailable(RuntimeError):
    """The live detector can't answer (quota, HTTP error, non-LLM mode). Aborts the run, no report."""


def load_detector(spec: str):
    if spec == "baseline_regex":
        return baseline_regex, naive_rewrite
    if spec.startswith("http://") or spec.startswith("https://"):
        # Base44 returns 403 to Python's default urllib User-Agent.
        headers = {"Content-Type": "application/json", "User-Agent": "compliance-eval/1.0"}
        # detect-text is admin only: pass an admin's Base44 token via EVAL_DETECTOR_TOKEN (never commit it).
        if os.environ.get("EVAL_DETECTOR_TOKEN"):
            headers["Authorization"] = f"Bearer {os.environ['EVAL_DETECTOR_TOKEN']}"
        ctx = _ssl_context()

        def http_detect(text, channel=""):
            req = urllib.request.Request(
                spec, data=json.dumps({"text": text, "channel": channel}).encode(), headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
                    body = json.loads(r.read())
            except (urllib.error.URLError, TimeoutError) as e:
                raise DetectorUnavailable(f"HTTP request failed: {e}") from e
            # A refused or failed LLM call comes back 200 with zero flags. Scoring that would
            # report fake clean-doc wins and misses, so stop the run instead.
            mode = body.get("mode", "llm") if isinstance(body, dict) else "llm"
            if mode not in LLM_MODES:
                raise DetectorUnavailable(f"endpoint answered mode={mode!r}, not one of {sorted(LLM_MODES)}")
            return body
        return http_detect, None
    mod_name, _, fn_name = spec.partition(":")
    sys.path.insert(0, str(Path.cwd()))
    mod = importlib.import_module(mod_name)
    return getattr(mod, fn_name or "detect"), getattr(mod, "rewrite", None)


def _provider(raw) -> str | None:
    """Who answered, from the endpoint's provider/model fields or its mode. None for local detectors."""
    if not isinstance(raw, dict):
        return None
    who = raw.get("provider") or raw.get("mode")
    return f"{who}:{raw['model']}" if who and raw.get("model") else who


def _flags(raw) -> list[dict]:
    if isinstance(raw, dict):
        raw = raw.get("flags", [])
    out = []
    for p in raw or []:
        if isinstance(p, str):
            p = {"category": p}
        out.append({"category": str(p.get("category", "UNKNOWN")), "span": p.get("span", "") or "",
                    "rule": p.get("rule"), "confidence": float(p.get("confidence", 1.0))})
    return out


# ----------------------------------------------------------------------------
# Scoring
# ----------------------------------------------------------------------------
def score_case(c: dict, preds: list[dict]) -> dict:
    text = c["text"]
    gold = [(g["category"], set(g.get("alt", [])), locate(text, g["span"])) for g in c.get("gold", [])]
    used, tp, fp, ungrounded, cite_ok = set(), [], [], 0, 0
    for p in sorted(preds, key=lambda p: -p["confidence"]):
        loc = locate(text, p["span"])
        if loc is None:
            ungrounded += 1
            fp.append(p["category"])
            continue
        hit = None
        for gi, (gcat, galt, gloc) in enumerate(gold):
            if gi in used or (p["category"] != gcat and p["category"] not in galt):
                continue
            if iou(loc, gloc) >= IOU_MIN:
                hit = gi
                break
        if hit is None:
            fp.append(p["category"])
        else:
            used.add(hit)
            tp.append(gold[hit][0])
            if p.get("rule") and p["rule"].replace(" ", "") == TAXONOMY[gold[hit][0]]["rule"].replace(" ", ""):
                cite_ok += 1
    fn = [g[0] for gi, g in enumerate(gold) if gi not in used]
    clean = not gold
    if clean:
        status = "false_positive" if preds else "ok"
    elif fn and fp:
        status = "miss+fp"
    elif fn:
        status = "miss"
    elif fp:
        status = "extra_flag"
    else:
        status = "ok"
    return {"id": c["id"], "provenance": c.get("provenance"), "reviewed": bool(c.get("reviewed")),
            "clean": clean, "tp": tp, "fp": fp, "fn": fn, "ungrounded": ungrounded, "cite_ok": cite_ok,
            "pred_cats": sorted({p["category"] for p in preds}), "status": status,
            "flags": [{"category": p["category"], "span": p["span"]} for p in preds]}


def _prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else None
    r = tp / (tp + fn) if tp + fn else None
    if p is None or r is None:
        return p, r, None
    return p, r, (0.0 if p + r == 0 else 2 * p * r / (p + r))


def aggregate(recs: list[dict]) -> dict:
    cats = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    n_pred = n_ung = n_cite = 0
    for r in recs:
        for k in ("tp", "fp", "fn"):
            for c in r[k]:
                cats[c][k] += 1
        n_pred += len(r["tp"]) + len(r["fp"])
        n_ung += r["ungrounded"]
        n_cite += r["cite_ok"]
    TP = sum(v["tp"] for v in cats.values())
    FP = sum(v["fp"] for v in cats.values())
    FN = sum(v["fn"] for v in cats.values())
    p, r, f = _prf(TP, FP, FN)
    clean = [x for x in recs if x["clean"]]
    per_cat = {}
    for c, v in sorted(cats.items()):
        cp, cr, cf = _prf(v["tp"], v["fp"], v["fn"])
        per_cat[c] = {**v, "precision": cp, "recall": cr, "f1": cf}
    return {
        "n_cases": len(recs), "n_clean": len(clean),
        "precision": p, "recall": r, "f1": f, "tp": TP, "fp": FP, "fn": FN,
        "clean_doc_fp_rate": (sum(1 for x in clean if x["fp"]) / len(clean)) if clean else None,
        "flags_per_clean_doc": (sum(len(x["fp"]) for x in clean) / len(clean)) if clean else None,
        "grounding_rate": (1 - n_ung / n_pred) if n_pred else None,
        "citation_accuracy": (n_cite / TP) if TP else None,
        "per_category": per_cat,
    }


def pair_scores(cases: list[dict], by_id: dict) -> dict:
    groups = defaultdict(dict)
    for c in cases:
        if c.get("pair"):
            groups[c["pair"]][c["role"]] = c
    total = passed = 0
    detail = {}
    for name, g in groups.items():
        if "violating" not in g or "fixed" not in g:
            continue
        v, f = g["violating"], g["fixed"]
        cat = v["gold"][0]["category"]
        catches = cat in by_id[v["id"]]["tp"]
        quiet = cat not in by_id[f["id"]]["pred_cats"]
        total += 1
        passed += int(catches and quiet)
        detail[name] = {"flags_violating": catches, "quiet_on_fixed": quiet}
    return {"pairs": total, "passed": passed, "pass_rate": (passed / total) if total else None, "detail": detail}


def rewrite_check(cases, by_id, detect, rewrite) -> dict | None:
    if rewrite is None:
        return None
    tried = ok = 0
    for c in cases:
        r = by_id[c["id"]]
        if not r["tp"]:
            continue
        tried += 1
        try:
            flags = _flags(detect(c["text"], c.get("channel", "")))
            new = rewrite(c["text"], flags)
            again = {f["category"] for f in _flags(detect(new, c.get("channel", "")))}
            ok += int(new.strip() != c["text"].strip() and not (again & set(r["tp"])))
        except Exception:
            pass
    return {"tried": tried, "passed": ok, "pass_rate": (ok / tried) if tried else None,
            "note": "necessary, not sufficient: also have a human rate rewrite quality"}


# ----------------------------------------------------------------------------
# Reporting
# ----------------------------------------------------------------------------
def _f(x, pct=False):
    if x is None:
        return "   - "
    return f"{x*100:4.0f}%" if pct else f"{x:5.2f}"


def print_report(rep: dict, verbose: bool) -> None:
    print(f"\nDetector: {rep['detector']}   cases: {rep['n_cases']}   ({rep['timestamp']})")
    if rep.get("providers"):
        print("Answered by: " + ", ".join(f"{k} x{v}" for k, v in rep["providers"].items()))
    extra = [k for k in rep["subsets"] if k.startswith("provider=")]
    for name in ("all", "reviewed", "pattern_synthetic", *extra):
        m = rep["subsets"].get(name)
        if not m or not m["n_cases"]:
            print(f"\n[{name}] 0 cases" + ("  <- label real cases (reviewed=true) to make this meaningful" if name == "reviewed" else ""))
            continue
        print(f"\n[{name}] {m['n_cases']} cases ({m['n_clean']} clean)")
        print(f"  precision {_f(m['precision'])}   recall {_f(m['recall'])}   F1 {_f(m['f1'])}   (tp {m['tp']} fp {m['fp']} fn {m['fn']})")
        print(f"  clean docs wrongly flagged {_f(m['clean_doc_fp_rate'], True)}   flags/clean doc {_f(m['flags_per_clean_doc'])}")
        print(f"  evidence grounding {_f(m['grounding_rate'], True)}   citation accuracy {_f(m['citation_accuracy'], True)}")
        if name == "all":
            print(f"  {'category':34s} {'P':>5s} {'R':>5s} {'F1':>5s}  tp fp fn")
            for c, v in m["per_category"].items():
                print(f"  {c:34s} {_f(v['precision'])} {_f(v['recall'])} {_f(v['f1'])}  {v['tp']:2d} {v['fp']:2d} {v['fn']:2d}")
    p = rep["pairs"]
    print(f"\nMinimal pairs: {p['passed']}/{p['pairs']} passed (flags the bad one AND quiet on the fixed one)")
    if rep.get("rewrite"):
        w = rep["rewrite"]
        print(f"Rewrite check: {w['passed']}/{w['tried']} passed  ({w['note']})")
    if verbose:
        print("\nCases that are not ok:")
        for r in rep["cases"]:
            if r["status"] != "ok":
                print(f"  {r['id']:28s} {r['status']:15s} missed={r['fn']} extra={r['fp']}"
                      + (f"  [{r['provider']}]" if r.get("provider") else ""))


def do_compare(a_path: str, b_path: str) -> None:
    a, b = json.loads(Path(a_path).read_text()), json.loads(Path(b_path).read_text())
    print(f"\nA: {a['detector']} ({a['timestamp']})\nB: {b['detector']} ({b['timestamp']})\n")
    ma, mb = a["subsets"]["all"], b["subsets"]["all"]
    for k, label, pct in [("precision", "precision", False), ("recall", "recall", False), ("f1", "F1", False),
                          ("clean_doc_fp_rate", "clean docs flagged", True), ("grounding_rate", "grounding", True)]:
        x, y = ma[k], mb[k]
        d = "" if x is None or y is None else f"  ({'+' if y >= x else ''}{(y-x)*100:.0f} pts)"
        print(f"  {label:20s} {_f(x, pct)} -> {_f(y, pct)}{d}")
    print(f"  {'minimal pairs':20s} {a['pairs']['passed']}/{a['pairs']['pairs']} -> {b['pairs']['passed']}/{b['pairs']['pairs']}")
    sa = {r["id"]: r["status"] for r in a["cases"]}
    sb = {r["id"]: r["status"] for r in b["cases"]}
    changed = [(i, sa[i], sb[i]) for i in sa if i in sb and sa[i] != sb[i]]
    print("\nCase-level changes (use these as your 'what we changed and why' receipts):")
    for i, x, y in changed or [("(none)", "", "")]:
        print(f"  {i:28s} {x:15s} -> {y}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--detector")
    ap.add_argument("--cases", default=str(HERE / "cases.jsonl"))
    ap.add_argument("--out", default=str(HERE / "reports"), help="report directory, or a path ending in .json")
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument("--stop-on-error", action="store_true",
                    help="any detector exception (e.g. a 429) ends the run with no report, instead of scoring a miss")
    ap.add_argument("--compare", nargs=2, metavar=("A.json", "B.json"))
    ap.add_argument("--expect-provider", metavar="NAME",
                    help="stop (no report) as soon as a case is answered by another provider, e.g. base44")
    a = ap.parse_args()
    if a.compare:
        return do_compare(*a.compare)
    if not a.detector:
        ap.error("--detector is required (try baseline_regex)")

    cases_path = Path(a.cases)
    cases = load_cases(cases_path)
    detect, rewrite = load_detector(a.detector)
    recs = []
    for c in cases:
        try:
            raw = detect(c["text"], c.get("channel", ""))
            preds, provider = _flags(raw), _provider(raw)
        except DetectorUnavailable as e:
            sys.exit(f"Stopped at case {len(recs) + 1}/{len(cases)} ({c['id']}): {e}. No report saved.")
        except Exception as e:  # a crashing detector should show up as misses, not abort the run
            if a.stop_on_error:
                sys.exit(f"Stopped at case {len(recs) + 1}/{len(cases)} ({c['id']}): {type(e).__name__}: {e}. "
                         "No report saved.")
            print(f"  detector error on {c['id']}: {e}", file=sys.stderr)
            preds, provider = [], "error"
        # A fallback model mid-run would blend two models' numbers into one score.
        if a.expect_provider and provider not in (None, "error") and provider.split(":")[0] != a.expect_provider:
            seen = Counter(r["provider"] for r in recs) + Counter([provider])
            sys.exit(f"Mixed-provider run: case {len(recs) + 1}/{len(cases)} ({c['id']}) answered by {provider!r}, "
                     f"expected {a.expect_provider!r}. Seen so far: {dict(seen)}. No report saved.")
        recs.append({**score_case(c, preds), "provider": provider})
    by_id = {r["id"]: r for r in recs}
    providers = sorted({r["provider"] or "local" for r in recs})
    rep = {
        "detector": a.detector,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "cases_sha": hashlib.sha1(cases_path.read_bytes()).hexdigest()[:10],
        "n_cases": len(cases),
        "subsets": {
            "all": aggregate(recs),
            "reviewed": aggregate([r for r in recs if r["reviewed"]]),
            "pattern_synthetic": aggregate([r for r in recs if r["provenance"] == "pattern_synthetic"]),
        },
        "providers": dict(sorted(Counter(r["provider"] or "local" for r in recs).items())),
        "pairs": pair_scores(cases, by_id),
        "rewrite": rewrite_check(cases, by_id, detect, rewrite),
        "cases": recs,
    }
    if len(providers) > 1:  # a mix: never let one model's numbers pass as another's
        for pv in providers:
            rep["subsets"][f"provider={pv}"] = aggregate([r for r in recs if (r["provider"] or "local") == pv])
    print_report(rep, a.verbose)
    if not a.no_save:
        out = Path(a.out)
        if out.suffix == ".json":
            path = out
        else:
            name = re.sub(r"[^A-Za-z0-9_.-]+", "_", a.detector)
            path = out / f"{name}_{time.strftime('%H%M%S')}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(rep, indent=2))
        print(f"\nSaved {path}")


if __name__ == "__main__":
    main()
