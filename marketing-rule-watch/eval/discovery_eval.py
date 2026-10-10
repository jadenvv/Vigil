#!/usr/bin/env python3
"""Does discovery find the firm's pages, and the third-party pages about it?

Runs the real crawl/discover.py against a simulated web (eval/discovery_world.json): the demo site's own
files served from disk, and a fake Google that answers each SERP query from a small labelled index.
Offline, no credits. It measures discover.py's logic and query design, not Google's real ranking.

  python3 eval/discovery_eval.py            # every scenario
  python3 eval/discovery_eval.py -v         # plus every URL and why it was missed

Needs httpx (same as crawl/). Scores per scenario:
  own-site recall      sitemap pages found / sitemap pages
  third-party recall   relevant off-site pages found / relevant (the hypothesis-1 number)
  labelled off-site    of those found, how many came out with source="serp" (not mistaken for own site)
  off-site precision   relevant / all off-site URLs returned (wrong-firm namesakes count against it)
  personal leaks       personal profiles returned (must be 0)
  duplicates returned  same page under a second URL (tracking params normalize() should strip)
  channel accuracy     guess_channel() vs the label, on relevant pages found
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "crawl"))
try:
    import httpx
    import discover
except ModuleNotFoundError as e:
    sys.exit(f"{e}. Install httpx (pip install httpx) or use the crawl/ environment.")

SITE_DIR = ROOT / "demo-site" / "site"
DEMO_ROOT = "https://nathanqiu07.github.io/quarrywick-wealth-demo/"
TOP_K = 10  # one page of Google results per query


def _norm(u: str) -> str:
    return re.sub(r"/index\.html$", "", discover.normalize(u))


def _move(url: str, site_root: str) -> str:
    """The world is written for the GitHub Pages copy; move own-site URLs to the scenario's host."""
    return site_root + url[len(DEMO_ROOT):] if url.startswith(DEMO_ROOT) else url


def site_handler(site_root: str):
    root = urlparse(site_root)

    def handler(req: httpx.Request) -> httpx.Response:
        path = req.url.path
        if req.url.host != root.hostname or not path.startswith(root.path.rstrip("/")):
            return httpx.Response(404, text="Site not found")  # e.g. the github.io account root
        rel = path[len(root.path.rstrip("/")):].lstrip("/") or "index.html"
        if rel.endswith("/"):
            rel += "index.html"
        f = SITE_DIR / rel
        if not f.is_file():
            return httpx.Response(404)
        return httpx.Response(200, text=f.read_text().replace(DEMO_ROOT, site_root))
    return handler


def search(index: list[dict], query: str) -> list[dict]:
    """Tiny Google. Every term must match; `A OR B` matches either; site: restricts the host.

    The haystack is title + text + the URL's words, since Google also matches terms in the URL
    (moneywisepodcast.example/episodes/... matches "podcast"). Added in v2 along with the OR queries:
    a simulator change so it can read the new queries, not a tweak to the labels.
    """
    site = re.search(r"site:(\S+)", query)
    q = re.sub(r"site:\S+", "", query)
    terms = re.findall(r'"[^"]+"|\S+', q)
    groups, i = [], 0  # each group is a list of alternatives; a term followed by OR joins the next one
    while i < len(terms):
        alts = [terms[i].strip('"').lower()]
        while i + 2 < len(terms) and terms[i + 1] == "OR":
            alts.append(terms[i + 2].strip('"').lower())
            i += 2
        groups.append(alts)
        i += 1
    hits = []
    for d in index:
        url_words = " ".join(re.split(r"[^a-z0-9]+", d["url"].lower()))
        hay = (d["title"] + " " + d["text"]).lower() + " " + url_words
        host = urlparse(d["url"]).netloc.lower()
        if site and not host.removeprefix("www.").endswith(site.group(1).lower()):
            continue
        if all(any(a in hay for a in alts) for alts in groups):
            hits.append(d)
    return hits[:TOP_K]


def serp_handler(index: list[dict], queries: list[str]):
    def handler(req: httpx.Request) -> httpx.Response:
        google = json.loads(req.content)["url"]
        q = parse_qs(urlparse(google).query)["q"][0]
        queries.append(q)
        return httpx.Response(200, json={"organic": [{"link": d["url"], "title": d["title"]} for d in search(index, q)]})
    return handler


def run_scenario(world: dict, sc: dict, verbose: bool) -> dict:
    site_root = sc["site_root"]
    index = [dict(d, url=_move(d["url"], site_root)) for d in world["index"]]
    sitemap = discover.urls_from_sitemap((SITE_DIR / "sitemap.xml").read_text().replace(DEMO_ROOT, site_root))
    queries: list[str] = []

    discover.log_call = lambda *a, **k: None  # don't write the simulated calls to crawl/calls.log
    with httpx.Client(transport=httpx.MockTransport(site_handler(site_root))) as plain, \
         httpx.Client(transport=httpx.MockTransport(serp_handler(index, queries))) as bd:
        os.environ.setdefault("BRIGHTDATA_SERP_ZONE", "simulated")
        rows = discover.discover(world["firm"], sc["domain"], plain, bd)

    got = {_norm(r["url"]): r for r in rows}
    own_gold = {_norm(u) for u in sitemap}
    own_found = own_gold & set(got)

    rel = {}
    for d in index:
        if d.get("relevant") and not d.get("duplicate_of"):
            rel[_norm(d["url"])] = d
    rel_found = [u for u in rel if u in got]
    labelled = [u for u in rel_found if got[u]["source"] == "serp"]
    off_rows = [u for u, r in got.items() if r["source"] == "serp" or u in rel]
    off_rows = [u for u in off_rows if u not in own_gold]
    precision = sum(u in rel for u in off_rows) / len(off_rows) if off_rows else None
    by_url = {_norm(d["url"]): d for d in index}
    leaks = [u for u in got if by_url.get(u, {}).get("personal") or "/in/" in urlparse(u).path]
    wrong_firm = [u for u in got if by_url.get(u, {}).get("wrong_firm")]
    dupes = [u for u in got if by_url.get(u, {}).get("duplicate_of")]
    chan_ok = [u for u in rel_found if got[u]["channel"] == rel[u]["channel"]]

    def why_missed(u: str) -> str:
        if any(_norm(d["url"]) == u for q in queries for d in search(index, q)):
            return "returned by search but dropped (filter/dedupe/cap)"
        return "no query matches it"

    res = {
        "scenario": sc["id"], "domain": sc["domain"], "urls_returned": len(rows), "serp_calls": len(queries),
        "own_site_recall": [len(own_found), len(own_gold)],
        "third_party_recall": [len(rel_found), len(rel)],
        "third_party_labelled_offsite": [len(labelled), len(rel_found)],
        "offsite_precision": precision,
        "personal_leaks": leaks, "wrong_firm_returned": wrong_firm,
        "duplicates_returned": dupes,
        "channel_accuracy": [len(chan_ok), len(rel_found)],
        "missed_third_party": {u: {"why": why_missed(u), "channel": rel[u]["channel"], "note": rel[u]["why"]}
                               for u in rel if u not in got},
        "mislabelled_own_site": [u for u in rel_found if got[u]["source"] == "site"],
        "channel_errors": {u: [got[u]["channel"], rel[u]["channel"]] for u in rel_found if u not in chan_ok},
        "own_site_missed": sorted(own_gold - own_found),
        "returned": rows,
    }
    _print(res, sc, verbose)
    return res


def _frac(p):
    return f"{p[0]}/{p[1]}"


def _print(r: dict, sc: dict, verbose: bool) -> None:
    print(f"\n== {r['scenario']}  domain={r['domain']}")
    print(f"   {sc['note']}")
    print(f"  URLs returned          {r['urls_returned']}   (SERP calls {r['serp_calls']})")
    print(f"  own-site recall        {_frac(r['own_site_recall'])}")
    print(f"  third-party recall     {_frac(r['third_party_recall'])}")
    print(f"  labelled as off-site   {_frac(r['third_party_labelled_offsite'])}")
    p = r["offsite_precision"]
    print(f"  off-site precision     {'-' if p is None else f'{p:.2f}'}")
    print(f"  personal leaks         {len(r['personal_leaks'])}")
    print(f"  wrong-firm returned    {len(r['wrong_firm_returned'])}")
    print(f"  duplicates returned    {len(r['duplicates_returned'])}  {' '.join(r['duplicates_returned'])}")
    print(f"  channel accuracy       {_frac(r['channel_accuracy'])}")
    for u, m in r["missed_third_party"].items():
        print(f"  miss  {m['channel']:<11} {m['why']:<45} {u}")
    for u in r["mislabelled_own_site"]:
        print(f"  label third-party page tagged source=site: {u}")
    for u, (g, want) in r["channel_errors"].items():
        print(f"  chan  {g} (want {want}): {u}")
    if verbose:
        for u in r["own_site_missed"]:
            print(f"  own   missed {u}")
        for row in r["returned"]:
            print(f"  got   {row['source']:<5} {row['channel']:<11} {row['url']}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--world", default=str(HERE / "discovery_world.json"))
    ap.add_argument("--out", default=str(HERE / "reports"), help="directory for the JSON report")
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    world = json.loads(Path(args.world).read_text())
    results = [run_scenario(world, sc, args.verbose) for sc in world["scenarios"]]
    print("\nSimulated search: measures discover.py's queries and filters, not real Google indexing. "
          "A brand-new github.io site may not be indexed at all.")
    if not args.no_save:
        out = Path(args.out) / f"discovery_{time.strftime('%H%M%S')}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(results, indent=2))
        print(f"saved {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
