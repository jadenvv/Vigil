#!/usr/bin/env python3
"""
Discovery: firm name + domain -> a deduped, channel-labelled URL list (max 25) for fetch.py.

Sources
  1. The firm's own site: homepage links + /sitemap.xml. Plain HTTP GET, no Bright Data credits.
  2. Bright Data SERP API (needs BRIGHTDATA_SERP_ZONE):
       "<firm>" site:linkedin.com   "<firm>" reviews   "<firm>" "top advisor"
     POST https://api.brightdata.com/request
     {"zone": SERP_ZONE, "url": "https://www.google.com/search?q=...&brd_json=1", "format": "raw"}
     VERIFY: brd_json=1 response shape. We read organic[].link and fall back to scraping URLs from the body.

USAGE (from marketing-rule-watch/)
  python3 crawl/discover.py --firm "Hartwell Wealth" --domain hartwell.example
  python3 crawl/discover.py --firm "Hartwell Wealth" --domain hartwell.example --no-serp
  python3 crawl/fetch.py --urls-file crawl/out/urls.txt --screenshot

Rules: business pages only, so personal LinkedIn profiles (/in/) are dropped. One SERP call per query,
no retries, every call logged to crawl/calls.log. Result text is untrusted data.
"""
import argparse
import json
import os
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote_plus, urljoin, urlparse, urlunparse

import httpx

from fetch import API_URL, HERE, MAX_URLS, guess_channel, load_env, log_call

SERP_QUERIES = ['"{firm}" site:linkedin.com', '"{firm}" reviews', '"{firm}" "top advisor"']
SKIP_EXT = re.compile(r"\.(pdf|jpe?g|png|gif|svg|webp|css|js|ico|zip|xml|mp4|mp3)$", re.I)
SKIP_HOSTS = ("google.", "gstatic.", "googleusercontent.", "youtube.com", "facebook.com/sharer",
              "twitter.com/intent", "schema.org", "w3.org")


def normalize(url: str) -> str:
    """Drop fragment, query tracking noise and trailing slash so duplicates collapse."""
    p = urlparse(url.strip())
    path = p.path.rstrip("/") or "/"
    return urlunparse((p.scheme.lower(), p.netloc.lower().removeprefix("www."), path, "", p.query, ""))


def keep(url: str) -> bool:
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.netloc:
        return False
    if SKIP_EXT.search(p.path) or any(h in (p.netloc + p.path).lower() for h in SKIP_HOSTS):
        return False
    if "linkedin.com" in p.netloc and p.path.startswith("/in/"):
        return False  # personal profile: no personal data harvesting
    return True


def same_site(url: str, domain: str) -> bool:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    d = domain.lower().removeprefix("www.")
    return host == d or host.endswith("." + d)


class _Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for k, v in attrs:
                if k == "href" and v:
                    self.hrefs.append(v)


def links_from_html(html: str, base: str) -> list[str]:
    p = _Links()
    p.feed(html)
    return [urljoin(base, h) for h in p.hrefs if not h.startswith(("mailto:", "tel:", "javascript:", "#"))]


def urls_from_sitemap(xml: str) -> list[str]:
    return [u.strip() for u in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml)]


def site_seed(plain: httpx.Client, domain: str) -> list[str]:
    """Homepage links + sitemap.xml, same-site only. Free: plain GET, not Bright Data."""
    base = domain if domain.startswith("http") else f"https://{domain}"
    out = [base]
    for path, parse in (("/", lambda r: links_from_html(r.text, str(r.url))),
                        ("/sitemap.xml", lambda r: urls_from_sitemap(r.text))):
        url = urljoin(base, path)
        t0 = time.time()
        try:
            r = plain.get(url)
            log_call(url, "plain_get", r.status_code, time.time() - t0, len(r.content))
            if r.status_code == 200:
                out += parse(r)
        except httpx.HTTPError as e:
            log_call(url, "plain_get", f"ERR:{type(e).__name__}", time.time() - t0, 0)
            print(f"  ! {url}: {type(e).__name__}", file=sys.stderr)
    return [u for u in out if same_site(u, urlparse(base).netloc)]


def parse_serp(body: str) -> list[str]:
    """organic[].link from brd_json=1; falls back to any http(s) URL in the body."""
    try:
        data = json.loads(body)
        links = [o.get("link") or o.get("url") for o in data.get("organic", [])]
        return [l for l in links if l]
    except (ValueError, AttributeError):
        return [u.rstrip(").,'\"") for u in re.findall(r"https?://[^\s\"'<>]+", body)]


def serp(bd: httpx.Client, query: str) -> list[str]:
    url = f"https://www.google.com/search?q={quote_plus(query)}&brd_json=1"
    body = {"zone": os.environ["BRIGHTDATA_SERP_ZONE"], "url": url, "format": "raw"}
    t0 = time.time()
    try:
        r = bd.post(API_URL, json=body)
    except httpx.HTTPError as e:
        log_call(url, "serp", f"ERR:{type(e).__name__}", time.time() - t0, 0)
        print(f"  ! SERP {query!r}: {type(e).__name__}", file=sys.stderr)
        return []
    log_call(url, "serp", r.status_code, time.time() - t0, len(r.content))
    if r.status_code != 200:
        print(f"  ! SERP {query!r}: HTTP {r.status_code} {r.text[:120]!r}", file=sys.stderr)
        return []
    return parse_serp(r.text)


def discover(firm: str, domain: str, plain: httpx.Client, bd: httpx.Client | None, cap: int = MAX_URLS) -> list[dict]:
    """Own-site URLs first (most likely to matter), then off-site SERP hits. Deduped, labelled, capped."""
    found: list[tuple[str, str]] = [(u, "site") for u in site_seed(plain, domain)]
    if bd is not None:
        for q in SERP_QUERIES:
            found += [(u, "serp") for u in serp(bd, q.format(firm=firm))]
    seen, rows = set(), []
    for u, src in found:
        n = normalize(u)
        if n in seen or not keep(n):
            continue
        seen.add(n)
        rows.append({"url": n, "channel": guess_channel(n), "source": src})
        if len(rows) >= cap:
            break
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--firm", required=True, help="firm name as it appears publicly")
    ap.add_argument("--domain", required=True, help="firm website, e.g. hartwell.example")
    ap.add_argument("--no-serp", action="store_true", help="own site only, spend no credits")
    ap.add_argument("--cap", type=int, default=MAX_URLS)
    ap.add_argument("--out", default=str(HERE / "out" / "urls.json"))
    args = ap.parse_args()
    if args.cap > MAX_URLS:
        ap.error(f"--cap may not exceed {MAX_URLS}")

    load_env()
    use_serp = not args.no_serp
    if use_serp and not (os.environ.get("BRIGHTDATA_TOKEN") and os.environ.get("BRIGHTDATA_SERP_ZONE")):
        print("No BRIGHTDATA_TOKEN / BRIGHTDATA_SERP_ZONE in .env: own site only.", file=sys.stderr)
        use_serp = False

    ua = {"User-Agent": "MarketingRuleWatch/0.1 (hackathon compliance demo)"}
    with httpx.Client(headers=ua, timeout=30, follow_redirects=True) as plain:
        if use_serp:
            auth = {"Authorization": f"Bearer {os.environ['BRIGHTDATA_TOKEN']}"}
            with httpx.Client(headers=auth, timeout=120) as bd:
                rows = discover(args.firm, args.domain, plain, bd, args.cap)
        else:
            rows = discover(args.firm, args.domain, plain, None, args.cap)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, indent=2))
    out.with_suffix(".txt").write_text("".join(r["url"] + "\n" for r in rows))
    for r in rows:
        print(f"  {r['channel']:<12} {r['source']:<5} {r['url']}", file=sys.stderr)
    print(f"\n{len(rows)} URLs -> {out} and {out.with_suffix('.txt')}", file=sys.stderr)
    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())
