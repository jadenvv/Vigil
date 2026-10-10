#!/usr/bin/env python3
"""
Eval suite: the checks compliance_eval.py doesn't do. Reuses its detector loading and scoring.

  sets         Every case file in one table (cases, holdout, pages, tester, demo_site, hard, scope, injection)
  site         End to end on the demo site: discover pages from sitemap.xml, fetch HTML, strip to visible
               text, detect, score against cases_demo_site.jsonl gold. Also reports planted sentences that
               the HTML-to-text step lost (extraction fidelity) and answer-key pages the sitemap missed.
  consistency  Run the same case N times; how often does the detector give the same flags? (feedback A6)
  rewrite      Rewrite quality beyond "flags gone": no new flags, untouched sentences preserved, no invented
               numbers, length bound, open placeholders.
  calibration  Precision by confidence bucket, to choose a threshold.
  versus       Two detectors side by side on the same cases (default B: engine.naive:detect, one bare LLM
               call per page with no examples, hints, delimiters, grounding or threshold). Shows what the
               pipeline adds over a plain wrapper on the same model. --cases for one file, else every set.

USAGE (from marketing-rule-watch/)
  python3 eval/suite.py sets --detector baseline_regex
  python3 eval/suite.py site --detector baseline_regex                      # live GitHub Pages site
  python3 eval/suite.py site --detector baseline_regex --base demo-site/site # local copy, no network
  python3 eval/suite.py consistency --detector engine.detect:detect --repeat 3 --cases eval/cases_hard.jsonl
  python3 eval/suite.py rewrite --detector baseline_regex
  python3 eval/suite.py calibration --detector baseline_regex
  python3 eval/suite.py versus --detector engine.detect:detect --against engine.naive:detect -v

LLM COST: consistency makes cases x repeat calls; rewrite makes 2 detect + 1 rewrite calls per flagged case;
site makes one call per page; versus makes
(chunks + 1) calls per case. engine.detect:detect calls Groq when .env has a key. For an offline run set
DETECT_MODE=rules LLM_PROVIDER=none.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compliance_eval import (DetectorUnavailable, _flags, _ssl_context, aggregate, load_cases, load_detector,  # noqa: E402
                             locate, score_case)

SETS = ["cases.jsonl", "cases_holdout.jsonl", "cases_pages.jsonl", "cases_tester.jsonl", "cases_demo_site.jsonl",
        "cases_hard.jsonl", "cases_scope.jsonl", "cases_injection.jsonl"]
LIVE_SITE = "https://nathanqiu07.github.io/quarrywick-wealth-demo/"
MAX_PAGES = 30  # credits are finite: never crawl more than this


def _f(x, pct=False):
    if x is None:
        return "  -  "
    return f"{x * 100:4.0f}%" if pct else f"{x:5.2f}"


def _run(detect, text, channel):
    try:
        return _flags(detect(text, channel))
    except DetectorUnavailable as e:
        sys.exit(f"Stopped: {e}")


def _save(out: str | None, name: str, rep: dict) -> None:
    if not out:
        return
    p = Path(out) / f"{name}_{time.strftime('%H%M%S')}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(rep, indent=2))
    print(f"\nsaved {p}")


# ----------------------------------------------------------------------------
# sets: one table across every case file
# ----------------------------------------------------------------------------
def cmd_sets(a, detect, rewrite):
    rows = {}
    print(f"{'set':24} {'n':>3} {'clean':>5} {'P':>5} {'R':>5} {'F1':>5} {'clean FP':>8} {'ground':>6}")
    for name in SETS:
        path = HERE / name
        if not path.exists():
            continue
        recs = [score_case(c, _run(detect, c["text"], c.get("channel", ""))) for c in load_cases(path)]
        g = aggregate(recs)
        rows[name] = {"summary": g, "misses": [r["id"] for r in recs if r["status"] != "ok"]}
        print(f"{name:24} {g['n_cases']:3} {g['n_clean']:5} {_f(g['precision'])} {_f(g['recall'])} {_f(g['f1'])} "
              f"{_f(g['clean_doc_fp_rate'], True):>8} {_f(g['grounding_rate'], True):>6}")
    if a.verbose:
        for name, r in rows.items():
            if r["misses"]:
                print(f"  {name}: not ok -> {', '.join(r['misses'])}")
    print("\nhard/scope/injection were written after the detector was tuned: treat them as test sets. Don't tune on them.")
    return {"sets": rows}


# ----------------------------------------------------------------------------
# site: end to end on the demo site
# ----------------------------------------------------------------------------
class _Text(HTMLParser):
    """Visible text, one line per block element. Drops script/style/head."""
    SKIP = {"script", "style", "head", "noscript", "template"}
    BLOCK = {"p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "br", "section", "article", "header",
             "footer", "nav", "blockquote", "figcaption", "td", "th", "cite", "a", "main", "table", "ul", "ol"}

    def __init__(self):
        super().__init__()
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

    def text(self):
        lines = (re.sub(r"[ \t\r\f\v]+", " ", ln).strip() for ln in "".join(self.parts).split("\n"))
        return "\n".join(ln for ln in lines if ln)


def html_to_text(html: str) -> str:
    p = _Text()
    p.feed(html)
    return p.text()


def _get(base: str, path: str) -> str:
    if base.startswith("http"):
        req = urllib.request.Request(base.rstrip("/") + "/" + path.lstrip("/"), headers={"User-Agent": "compliance-eval/1.0"})
        with urllib.request.urlopen(req, timeout=30, context=_ssl_context()) as r:
            return r.read().decode("utf-8", "replace")
    return (Path(base) / path.lstrip("/")).read_text()


def _page_path(case: dict) -> str | None:
    m = re.search(r"page (/[\w./-]+\.html)", case.get("notes", ""))
    return m.group(1) if m else None


def cmd_site(a, detect, rewrite):
    gold_cases = {p: c for c in load_cases(HERE / "cases_demo_site.jsonl") if (p := _page_path(c))}
    sitemap = _get(a.base, "sitemap.xml")
    found = []
    for loc in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sitemap)[:MAX_PAGES]:
        path = "/" + (loc[len(LIVE_SITE):] if loc.startswith(LIVE_SITE) else urlparse(loc).path).lstrip("/")
        path = "/index.html" if path.endswith("/") else path
        found.append(path)
    missed_pages = sorted(set(gold_cases) - set(found))
    recs, lost = [], []
    for path in found:
        try:
            text = html_to_text(_get(a.base, path))
        except Exception as e:
            print(f"  fetch failed {path}: {e}", file=sys.stderr)
            continue
        gc = gold_cases.get(path, {"id": f"site:{path}", "gold": []})
        kept = []
        for g in gc.get("gold", []):
            (kept if locate(text, g["span"]) is not None else lost).append(g if locate(text, g["span"]) is not None
                                                                           else {"page": path, **g})
        case = {"id": f"site:{path}", "text": text, "gold": kept, "channel": "blog" if "/blog/" in path else "website"}
        preds = _run(detect, text, case["channel"])
        r = score_case(case, preds)
        r["fn"] += [g["category"] for g in gc.get("gold", []) if g not in kept]  # lost in extraction counts as a miss
        recs.append(r)
    g = aggregate(recs)
    n_gold = sum(len(c["gold"]) for c in gold_cases.values())
    print(f"\nDemo site end to end  base={a.base}")
    print(f"  pages in sitemap: {len(found)}   answer-key pages not discovered: {missed_pages or 'none'}")
    print(f"  planted spans surviving HTML->text: {n_gold - len(lost)}/{n_gold}")
    for x in lost:
        print(f"    lost on {x['page']}: {x['span'][:70]!r}")
    print(f"  P {_f(g['precision'])}  R {_f(g['recall'])}  F1 {_f(g['f1'])}  "
          f"clean pages flagged {_f(g['clean_doc_fp_rate'], True)}  grounding {_f(g['grounding_rate'], True)}")
    for r in recs:
        if a.verbose or r["status"] != "ok":
            print(f"  {r['status']:15} {r['id']:36} missed={r['fn']} extra={r['fp']}")
    print("  Note: gold covers only the 11 planted sentences. An extra flag on a full page may be a real issue the\n"
          "  answer key doesn't list; read it before calling it a false positive.")
    return {"base": a.base, "pages": found, "missed_pages": missed_pages, "lost_spans": lost,
            "summary": g, "per_page": recs}


# ----------------------------------------------------------------------------
# consistency: same input, N runs
# ----------------------------------------------------------------------------
def _key(f):
    return (f["category"], re.sub(r"\W+", " ", f["span"].lower()).strip())


def cmd_consistency(a, detect, rewrite):
    cases = load_cases(Path(a.cases))
    if a.limit:
        cases = cases[:a.limit]
    per_case, identical, jac_sum, flips = [], 0, 0.0, 0
    for c in cases:
        runs = [_run(detect, c["text"], c.get("channel", "")) for _ in range(a.repeat)]
        sets = [{_key(f) for f in r} for r in runs]
        union, inter = set().union(*sets), set.intersection(*sets)
        jac = len(inter) / len(union) if union else 1.0
        statuses = [score_case(c, r)["status"] for r in runs]
        same = all(s == sets[0] for s in sets)
        identical += same
        jac_sum += jac
        flips += len(set(statuses)) > 1
        per_case.append({"id": c["id"], "identical": same, "jaccard": jac, "statuses": statuses})
    n = len(cases)
    print(f"\nConsistency  repeat={a.repeat}  cases={n}  ({a.cases})")
    print(f"  identical flag sets on every run: {identical}/{n}")
    print(f"  mean flag-set Jaccard:            {jac_sum / n:.2f}" if n else "")
    print(f"  cases whose pass/fail changed:    {flips}/{n}   <- the number a compliance officer feels")
    for p in per_case:
        if a.verbose or not p["identical"]:
            print(f"  {p['id']:36} jaccard={p['jaccard']:.2f} statuses={p['statuses']}")
    return {"repeat": a.repeat, "n": n, "identical": identical, "mean_jaccard": jac_sum / n if n else None,
            "outcome_flips": flips, "per_case": per_case}


# ----------------------------------------------------------------------------
# rewrite: quality, not just "flags gone"
# ----------------------------------------------------------------------------
NUM = re.compile(r"\d[\d,]*(?:\.\d+)?%?")
PLACEHOLDER = re.compile(r"\[[A-Z][A-Z0-9 _/-]*\]")
SENT = re.compile(r"(?:[^.!?\n]|\.(?=\d))+[.!?]?[\"')\]]*")  # "17.9%" is not a sentence end


def _sentences(t):
    return [s.strip() for s in SENT.findall(t) if s.strip()]


def cmd_rewrite(a, detect, rewrite):
    if rewrite is None:
        sys.exit("this detector has no rewrite()")
    cases = [c for c in load_cases(Path(a.cases)) if c.get("gold")]
    if a.limit:
        cases = cases[:a.limit]
    rows, tot = [], defaultdict(int)
    for c in cases:
        ch = c.get("channel", "")
        flags = _run(detect, c["text"], ch)
        if not flags:
            continue
        new = rewrite(c["text"], flags)
        after = _run(detect, new, ch)
        before_cats = {f["category"] for f in flags}
        touched = [s for s in _sentences(c["text"]) if any(f["span"] and f["span"] in s or s in f["span"] for f in flags)]
        untouched = [s for s in _sentences(c["text"]) if s not in touched]
        # 1, 5 and 10 are the rule's standard periods ("1 year, 5 years, 10 years"), not invented results
        invented = sorted(set(NUM.findall(PLACEHOLDER.sub("", new))) - set(NUM.findall(c["text"])) - {"1", "5", "10"})
        chk = {
            "changed": new.strip() != c["text"].strip(),
            "flags_cleared": not ({f["category"] for f in after} & before_cats),
            "no_new_flags": not ({f["category"] for f in after} - before_cats),
            "untouched_kept": all(s in new for s in untouched),
            "no_invented_numbers": not invented,
            # a one-line claim may need a disclosure sentence added, hence the +200 slack
            "length_ok": 0.5 * len(c["text"]) <= len(new) <= 2 * len(c["text"]) + 200,
        }
        for k, v in chk.items():
            tot[k] += v
        tot["n"] += 1
        rows.append({"id": c["id"], **chk, "invented": invented, "placeholders": PLACEHOLDER.findall(new),
                     "rewrite": new})
    n = tot["n"]
    print(f"\nRewrite quality  cases with flags: {n}  ({a.cases})")
    for k in ("changed", "flags_cleared", "no_new_flags", "untouched_kept", "no_invented_numbers", "length_ok"):
        print(f"  {k:22} {tot[k]}/{n}")
    print(f"  all checks pass        {sum(all(r[k] for k in ('changed', 'flags_cleared', 'no_new_flags', 'untouched_kept', 'no_invented_numbers', 'length_ok')) for r in rows)}/{n}")
    print(f"  open placeholders      {sum(len(r['placeholders']) for r in rows)} (the officer must fill these; fine, but count them)")
    for r in rows:
        bad = [k for k in ("flags_cleared", "no_new_flags", "untouched_kept", "no_invented_numbers", "length_ok") if not r[k]]
        if a.verbose or bad:
            print(f"  {r['id']:36} fails={bad} invented={r['invented']}")
    print("  Still needs a human: does it keep the firm's meaning and read naturally? Score a sample by hand.")
    return {"n": n, "totals": dict(tot), "per_case": rows}


# ----------------------------------------------------------------------------
# calibration: precision by confidence bucket
# ----------------------------------------------------------------------------
def cmd_calibration(a, detect, rewrite):
    buckets = defaultdict(lambda: [0, 0])
    for name in SETS:
        path = HERE / name
        if not path.exists():
            continue
        for c in load_cases(path):
            for p in _run(detect, c["text"], c.get("channel", "")):
                hit = bool(score_case(c, [p])["tp"])
                b = min(9, int(p["confidence"] * 10))
                buckets[b][0] += hit
                buckets[b][1] += 1
    print("\nCalibration (all case sets; a flag is correct if it matches a gold span)")
    print("  confidence   flags  precision")
    out = {}
    for b in sorted(buckets):
        ok, n = buckets[b]
        out[f"{b / 10:.1f}-{(b + 1) / 10:.1f}"] = {"flags": n, "precision": ok / n}
        print(f"  {b / 10:.1f}-{(b + 1) / 10:.1f}     {n:6}  {ok / n:9.2f}")
    if len(buckets) == 1:
        print("  Every flag has the same confidence, so a threshold can't trade precision for recall.")
    return {"buckets": out}


# ----------------------------------------------------------------------------
# versus: our pipeline vs a naive LLM wrapper, same cases, same model
# ----------------------------------------------------------------------------
class _CallCounter:
    """Counts engine.llm.complete calls (both engine detectors call it through the module attribute)."""

    def __init__(self):
        self.n = 0
        try:
            from engine import llm
        except ImportError:
            self.llm = None
            return
        self.llm, self.orig = llm, llm.complete

        def counted(*args, **kw):
            self.n += 1
            return self.orig(*args, **kw)
        llm.complete = counted

    def take(self):
        n, self.n = self.n, 0
        return n


def cmd_versus(a, detect, rewrite):
    other, _ = load_detector(a.against)
    calls = _CallCounter()
    paths = [Path(a.cases)] if a.cases else [HERE / n for n in SETS if (HERE / n).exists()]
    print(f"\nVersus  A = {a.detector}   B = {a.against}")
    print(f"{'set':24} {'n':>3} | {'P':>5} {'R':>5} {'F1':>5} {'cleanFP':>7} {'grnd':>5} {'calls':>5} |"
          f" {'P':>5} {'R':>5} {'F1':>5} {'cleanFP':>7} {'grnd':>5} {'calls':>5} | {'dF1':>5}")
    out = {}
    for path in paths:
        cases = load_cases(path)
        if a.limit:
            cases = cases[:a.limit]
        ra, rb, diffs, ca, cb = [], [], [], 0, 0
        for c in cases:
            pa = _run(detect, c["text"], c.get("channel", ""))
            ca += calls.take()
            pb = _run(other, c["text"], c.get("channel", ""))
            cb += calls.take()
            sa, sb = score_case(c, pa), score_case(c, pb)
            ra.append(sa)
            rb.append(sb)
            if sa["status"] != sb["status"] or len(sa["tp"]) != len(sb["tp"]):
                diffs.append({"id": c["id"], "A": sa["status"], "B": sb["status"], "A_tp": len(sa["tp"]),
                              "B_tp": len(sb["tp"]), "A_fp": len(sa["fp"]), "B_fp": len(sb["fp"]),
                              "B_ungrounded": sb["ungrounded"]})
        ga, gb = aggregate(ra), aggregate(rb)
        d = None if ga["f1"] is None or gb["f1"] is None else ga["f1"] - gb["f1"]
        print(f"{path.name[:24]:24} {len(cases):3} | {_f(ga['precision'])} {_f(ga['recall'])} {_f(ga['f1'])} "
              f"{_f(ga['clean_doc_fp_rate'], True):>7} {_f(ga['grounding_rate'], True):>5} {ca:5} | "
              f"{_f(gb['precision'])} {_f(gb['recall'])} {_f(gb['f1'])} {_f(gb['clean_doc_fp_rate'], True):>7} "
              f"{_f(gb['grounding_rate'], True):>5} {cb:5} | {'  -  ' if d is None else f'{d:+5.2f}'}")
        out[path.name] = {"A": ga, "B": gb, "A_llm_calls": ca, "B_llm_calls": cb, "disagreements": diffs}
        if a.verbose:
            for x in diffs:
                print(f"    {x['id']:36} A={x['A']:14} B={x['B']:14} tp {x['A_tp']}/{x['B_tp']} "
                      f"fp {x['A_fp']}/{x['B_fp']}")
    print("  calls = engine.llm.complete calls (0 for an HTTP or regex detector). "
          "Same model on both sides only if both run locally.")
    return {"against": a.against, "sets": out}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["sets", "site", "consistency", "rewrite", "calibration", "versus"])
    ap.add_argument("--detector", default="baseline_regex")
    ap.add_argument("--cases", default=None, help="case file (default eval/cases.jsonl; versus: every set)")
    ap.add_argument("--against", default="engine.naive:detect", help="versus: the detector to compare with")
    ap.add_argument("--base", default=LIVE_SITE, help="site root URL or local folder (site)")
    ap.add_argument("--repeat", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0, help="only the first N cases (saves LLM quota)")
    ap.add_argument("--out", default=str(HERE / "reports"))
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()
    if a.repeat > 10:
        ap.error("--repeat is capped at 10 (LLM quota)")
    if a.cases is None and a.cmd != "versus":
        a.cases = str(HERE / "cases.jsonl")
    detect, rewrite = load_detector(a.detector)
    rep = globals()[f"cmd_{a.cmd}"](a, detect, rewrite)
    rep = {"cmd": a.cmd, "detector": a.detector, "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"), **rep}
    _save(None if a.no_save else a.out, f"{a.cmd}_{re.sub(r'[^A-Za-z0-9]+', '_', a.detector)[:40]}", rep)


if __name__ == "__main__":
    main()
