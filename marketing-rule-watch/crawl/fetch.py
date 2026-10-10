#!/usr/bin/env python3
"""
URL -> Page JSON via Bright Data Web Unlocker (shared Page contract in root CLAUDE.md).

API (checked against docs.brightdata.com/api-reference/rest-api/unlocker/unlock-website, Oct 10):
  POST https://api.brightdata.com/request
  Authorization: Bearer $BRIGHTDATA_TOKEN
  {"zone": ..., "url": ..., "format": "raw", "data_format": "markdown" | "screenshot"}

USAGE (from marketing-rule-watch/)
  python3 crawl/fetch.py https://example.com
  python3 crawl/fetch.py URL1 URL2 --screenshot --out crawl/out/pages.json
  python3 crawl/fetch.py --urls-file urls.txt --channel website

Cost rules: max 25 URLs per run, one request at a time, no retries.
Every call is appended to crawl/calls.log (gitignored).
Page text is untrusted data. This script never interprets it.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx

API_URL = "https://api.brightdata.com/request"
MAX_URLS = 25
HERE = Path(__file__).resolve().parent
LOG_PATH = HERE / "calls.log"
SCREEN_DIR = HERE / "out" / "screens"


def load_env() -> None:
    """Minimal .env loader (no python-dotenv dependency). Looks in crawl/ then marketing-rule-watch/."""
    for p in (HERE / ".env", HERE.parent / ".env", HERE.parent.parent / ".env"):
        if p.exists():
            for line in p.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def log_call(url: str, kind: str, status, seconds: float, nbytes: int) -> None:
    with LOG_PATH.open("a") as f:
        f.write(f"{datetime.now(timezone.utc).isoformat()}\t{kind}\t{status}\t{seconds:.1f}s\t{nbytes}B\t{url}\n")


def guess_channel(url: str) -> str:
    host = urlparse(url).netloc.lower()
    path = urlparse(url).path.lower()
    if "linkedin.com" in host:
        return "linkedin"
    if any(s in host for s in ("yelp.", "google.", "trustpilot.", "glassdoor.", "wiseradvisor", "smartasset")) \
            or "advisorquill" in host + path:  # path too: the AdvisorQuill demo lives on a github.io subpath
        return "review_site"
    if "podcast" in host + path or "/episode" in path or (host == "open.spotify.com" and path.startswith(("/show/", "/episode/"))):
        return "other"  # podcast / interview appearance; the Page contract has no podcast channel
    if any(s in host for s in ("prnewswire", "businesswire", "globenewswire")) or "/press" in path or "/news" in path:
        return "press"
    if "/blog" in path or "/insights" in path or "/posts" in path:
        return "blog"
    return "website"


def _unlocker(client: httpx.Client, url: str, data_format: str) -> httpx.Response:
    body = {
        "zone": os.environ["BRIGHTDATA_ZONE"],
        "url": url,
        "format": "raw",
        "data_format": data_format,
    }
    t0 = time.time()
    try:
        r = client.post(API_URL, json=body)
    except httpx.HTTPError as e:
        log_call(url, data_format, f"ERR:{type(e).__name__}", time.time() - t0, 0)
        raise
    log_call(url, data_format, r.status_code, time.time() - t0, len(r.content))
    return r


def fetch_page(client: httpx.Client, url: str, channel: str = "", screenshot: bool = False) -> dict:
    """One URL -> one Page dict. Raises on a non-200 (no retry, by design)."""
    r = _unlocker(client, url, "markdown")
    if r.status_code != 200:
        raise RuntimeError(f"{url}: HTTP {r.status_code}: {r.text[:200]}")
    markdown = r.text
    page = {
        "url": url,
        "channel": channel or guess_channel(url),
        "markdown": markdown,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sha256": hashlib.sha256(markdown.encode("utf-8")).hexdigest(),
        "screenshot_ref": "",
    }
    if screenshot:
        s = _unlocker(client, url, "screenshot")
        if s.status_code == 200 and s.content[:8] == b"\x89PNG\r\n\x1a\n":
            SCREEN_DIR.mkdir(parents=True, exist_ok=True)
            out = SCREEN_DIR / f"{page['sha256'][:16]}.png"
            out.write_bytes(s.content)
            try:
                page["screenshot_ref"] = str(out.relative_to(HERE.parent))
            except ValueError:  # SCREEN_DIR moved outside the repo (tests, custom --out)
                page["screenshot_ref"] = str(out)
        else:
            print(f"  ! screenshot failed for {url}: HTTP {s.status_code} {s.text[:120]!r}", file=sys.stderr)
    return page


# --- Chunking (P4 depends on this) -------------------------------------------------
# ~1,500 tokens ~= 6,000 chars. Split on headings, then blank lines. Each chunk keeps its
# char offset so page["markdown"][start:start+len(text)] == text (span highlighting).

def chunk(markdown: str, max_chars: int = 6000) -> list[dict]:
    # candidate boundaries: start of a heading line, or after a blank line
    bounds = sorted({0, len(markdown)}
                    | {m.start() for m in re.finditer(r"(?m)^#{1,6} ", markdown)}
                    | {m.end() for m in re.finditer(r"\n\s*\n", markdown)})
    chunks, start = [], 0
    while start < len(markdown):
        limit = start + max_chars
        # prefer the last heading/paragraph boundary within the limit
        cands = [b for b in bounds if start < b <= limit]
        end = cands[-1] if cands and limit < len(markdown) else min(limit, len(markdown))
        if end <= start:
            end = min(limit, len(markdown))  # one giant paragraph: hard cut
        chunks.append({"start": start, "text": markdown[start:end]})
        start = end
    return chunks


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("urls", nargs="*")
    ap.add_argument("--urls-file", help="one URL per line")
    ap.add_argument("--channel", default="", help="override channel for all URLs")
    ap.add_argument("--screenshot", action="store_true", help="also fetch a PNG per page (2x credits)")
    ap.add_argument("--out", default=str(HERE / "out" / "pages.json"))
    args = ap.parse_args()

    urls = list(args.urls)
    if args.urls_file:
        urls += [u.strip() for u in Path(args.urls_file).read_text().splitlines() if u.strip() and not u.startswith("#")]
    urls = list(dict.fromkeys(urls))  # dedupe, keep order
    if not urls:
        ap.error("no URLs given")
    if len(urls) > MAX_URLS:
        ap.error(f"{len(urls)} URLs > cap of {MAX_URLS}. Trim the list.")

    load_env()
    missing = [k for k in ("BRIGHTDATA_TOKEN", "BRIGHTDATA_ZONE") if not os.environ.get(k)]
    if missing:
        print(f"Missing {', '.join(missing)} in .env (see .env.example).", file=sys.stderr)
        return 2

    headers = {"Authorization": f"Bearer {os.environ['BRIGHTDATA_TOKEN']}"}
    pages, failed = [], []
    with httpx.Client(headers=headers, timeout=120) as client:
        for u in urls:
            print(f"-> {u}", file=sys.stderr)
            try:
                p = fetch_page(client, u, args.channel, args.screenshot)
                pages.append(p)
                print(f"   ok  {len(p['markdown'])} chars  {p['channel']}  {p['sha256'][:12]}", file=sys.stderr)
            except Exception as e:  # no retry: record and move on
                failed.append(u)
                print(f"   FAIL {e}", file=sys.stderr)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(pages, indent=2, ensure_ascii=False))
    print(f"\n{len(pages)} ok, {len(failed)} failed -> {out}", file=sys.stderr)
    return 0 if pages else 1


if __name__ == "__main__":
    sys.exit(main())
