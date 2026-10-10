#!/usr/bin/env python3
"""
Discovery: firm name + domain -> a deduped, channel-labelled URL list (max 25) for fetch.py.

Sources
  1. The firm's own site: homepage links + sitemap.xml (+ up to 2 more sitemaps named in robots.txt).
     Plain HTTP GET, no Bright Data credits. The site may live under a path (GitHub Pages:
     user.github.io/repo/); then "own site" means that host AND under that path.
  2. Bright Data SERP API (needs BRIGHTDATA_SERP_ZONE), one call per query (5 per scan):
       "<firm>" site:linkedin.com   "<firm>" reviews   "<firm>" "top advisor"
       "<firm>" "press release" OR announces OR announced       (press releases)
       "<firm>" podcast OR episode OR interview                  (podcast / interview appearances)
     POST https://api.brightdata.com/request
     {"zone": SERP_ZONE, "url": "https://www.google.com/search?q=...&brd_json=1", "format": "raw"}
     brd_json=1 returns {"organic": [{"link", "title", ...}], ...} (verified live Oct 10). We read organic[].link
     and fall back to scraping URLs from the body.

USAGE (from marketing-rule-watch/)
  python3 crawl/discover.py --firm "Hartwell Wealth" --domain hartwell.example
  python3 crawl/discover.py --firm "Hartwell Wealth" --domain hartwell.example --no-serp
  python3 crawl/discover.py --firm "Quarrywick Wealth" --domain nathanqiu07.github.io/quarrywick-wealth-demo --no-serp
  python3 crawl/fetch.py --urls-file crawl/out/urls.txt --screenshot

Rules: business pages only, so personal profiles (LinkedIn /in/, Instagram, Facebook people/posts, Forbes
/profile/) and celebrity net-worth spam are dropped. One SERP call per query,
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

# Mirrored in base44/app/base44/shared/discover.ts. Each query is one SERP call per scan; keep this list short.
SERP_QUERIES = ['"{firm}" site:linkedin.com', '"{firm}" reviews', '"{firm}" "top advisor"',
                '"{firm}" "press release" OR announces OR announced',
                '"{firm}" podcast OR episode OR interview']
MAX_EXTRA_SITEMAPS = 2  # from robots.txt, so a sitemap index can't fan out
TRACKING_PARAMS = ("utm_", "originalsubdomain=", "trk=", "fbclid=", "gclid=")
SKIP_EXT = re.compile(r"\.(pdf|jpe?g|png|gif|svg|webp|css|js|ico|zip|xml|mp4|mp3)$", re.I)
SKIP_HOSTS = ("google.", "gstatic.", "googleusercontent.", "youtube.com", "facebook.com/sharer",
              "twitter.com/intent", "schema.org", "w3.org")


def normalize(url: str) -> str:
    """Drop fragment, query tracking noise and trailing slash so duplicates collapse."""
    p = urlparse(url.strip())
    path = p.path.rstrip("/") or "/"
    host = p.netloc.lower().removeprefix("www.")
    host = re.sub(r"^[a-z]{2}\.linkedin\.com$", "linkedin.com", host)  # il.linkedin.com etc. from Google
    query = "&".join(kv for kv in p.query.split("&") if kv and not kv.lower().startswith(TRACKING_PARAMS))
    return urlunparse((p.scheme.lower(), host, path, "", query, ""))


def keep(url: str) -> bool:
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.netloc:
        return False
    if SKIP_EXT.search(p.path) or any(h in (p.netloc + p.path).lower() for h in SKIP_HOSTS):
        return False
    if "linkedin.com" in p.netloc and p.path.startswith("/in/"):
        return False  # personal profile: no personal data harvesting
    return not _personal_or_spam(p)


# Business pages only (root CLAUDE.md): no personal social profiles or posts, no celebrity-wealth spam.
# Patterns from a live "Hartwell Wealth" search on 2026-10-10. SERP results only carry the URL here, so
# spam is matched on the URL slug alone. Same rules as isPersonalOrSpam() in shared/discover.ts.
WEALTH_SPAM = re.compile(r"net[-_ ]?worth|hidden[-_]wealth|wealth-grew|-worth-the-", re.I)


def _personal_or_spam(p) -> bool:
    host = p.netloc.lower().removeprefix("www.")
    path = p.path.lower()
    if host == "instagram.com" or host.endswith(".instagram.com"):
        return True
    if host.endswith("forbes.com") and path.startswith("/profile/"):
        return True
    if host.endswith("facebook.com"):  # a company's own page stays; profiles and single posts/photos go
        if path == "/profile.php" or path.startswith("/people/"):
            return True
        if re.search(r"/(photos|posts|videos|reel|permalink\.php)\b", path):
            return True
    return bool(WEALTH_SPAM.search(path))


def same_site(url: str, domain: str) -> bool:
    """Bare-host check (host or a subdomain). Path-aware scoping is in_scope()."""
    host = urlparse(url).netloc.lower().removeprefix("www.")
    d = domain.lower().removeprefix("www.")
    return host == d or host.endswith("." + d)


def site_base(domain: str) -> tuple[str, str, str] | None:
    """(url, host, path) for "hartwell.example", "https://www.hartwell.example" or "user.github.io/repo[/index.html]".

    url always ends in "/", host is lowercased without "www.", path is "/" for a bare domain else "/repo/".
    Same as siteBase() in shared/discover.ts.
    """
    raw = domain.strip()
    p = urlparse(raw if re.match(r"^https?://", raw, re.I) else f"https://{raw}")
    if not p.netloc or "." not in p.netloc:
        return None
    path = re.sub(r"/[^/]*\.[a-z0-9]+$", "/", p.path, flags=re.I)  # drop a trailing file like index.html
    if not path.endswith("/"):
        path += "/"
    return f"{p.scheme}://{p.netloc.lower()}{path}", p.netloc.lower().removeprefix("www."), path


def in_scope(url: str, base: tuple[str, str, str]) -> bool:
    """Bare domain: host or any subdomain. Base with a path: same host AND under it (other repos on
    the same github.io account are third parties)."""
    _, bhost, bpath = base
    p = urlparse(url)
    host = p.netloc.lower().removeprefix("www.")
    if bpath == "/":
        return host == bhost or host.endswith("." + bhost)
    return host == bhost and (p.path + "/").startswith(bpath)


def sitemaps_from_robots(txt: str) -> list[str]:
    return re.findall(r"^\s*sitemap:\s*(\S+)", txt, re.I | re.M)


def drop_folder_duplicates(urls: list[str]) -> list[str]:
    """A folder and its index.html are one page: keep the index.html form (what sitemaps list)."""
    folders = {normalize(re.sub(r"/index\.html?$", "/", u, flags=re.I)) for u in urls if re.search(r"/index\.html?$", u, re.I)}
    return [u for u in urls if u not in folders]


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


def _get(plain: httpx.Client, url: str) -> httpx.Response | None:
    t0 = time.time()
    try:
        r = plain.get(url)
        log_call(url, "plain_get", r.status_code, time.time() - t0, len(r.content))
        return r if r.status_code == 200 else None
    except httpx.HTTPError as e:
        log_call(url, "plain_get", f"ERR:{type(e).__name__}", time.time() - t0, 0)
        print(f"  ! {url}: {type(e).__name__}", file=sys.stderr)
        return None


def site_seed(plain: httpx.Client, base: tuple[str, str, str]) -> list[str]:
    """Homepage links + sitemaps, in-scope only. Free: plain GET, not Bright Data.

    Joins are relative to the base folder, so a GitHub Pages repo fetches /repo/sitemap.xml, not the
    account root (which 404s).
    """
    out = [base[0]]
    if r := _get(plain, base[0]):
        out += links_from_html(r.text, str(r.url))
    sitemap = urljoin(base[0], "sitemap.xml")
    if r := _get(plain, sitemap):
        out += urls_from_sitemap(r.text)
    robots = _get(plain, urljoin(base[0], "robots.txt"))
    extra = [u for u in sitemaps_from_robots(robots.text) if u != sitemap and in_scope(u, base)] if robots else []
    for u in extra[:MAX_EXTRA_SITEMAPS]:
        if r := _get(plain, u):
            out += urls_from_sitemap(r.text)
    return [u for u in out if in_scope(u, base)]


def parse_serp(body: str) -> list[str]:
    """organic[].link from brd_json=1; falls back to any http(s) URL in the body."""
    try:
        data = json.loads(body)
        links = [o.get("link") or o.get("url") for o in data.get("organic", [])]
        return [l for l in links if l]
    except (ValueError, AttributeError):
        return [u.rstrip(").,'\"") for u in re.findall(r"https?://[^\s\"'<>]+", body)]


def serp(bd: httpx.Client, query: str) -> list[str]:
    url = f"https://www.google.com/search?q={quote_plus(query)}&gl=us&hl=en&brd_json=1"
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
    if not r.content.strip():  # seen live: 200 with an empty body after ~50 s
        print(f"  ! SERP {query!r}: empty response (not retried)", file=sys.stderr)
        return []
    return parse_serp(r.text)


def _dedupe(urls: list[str], seen: set) -> list[str]:
    out = []
    for u in urls:
        n = normalize(u)
        if n and n not in seen and keep(n):
            seen.add(n)
            out.append(n)
    return out


def discover(firm: str, domain: str, plain: httpx.Client, bd: httpx.Client | None, cap: int = MAX_URLS) -> list[dict]:
    """Own-site URLs, then off-site SERP hits. Deduped, labelled, capped.

    Off-site content is where hypothesis 1 says the risk is, so it gets at least a third of the cap
    (more if the site is small). SERP hits inside the firm's site (host, plus path if it has one) count
    as own-site.
    """
    base = site_base(domain)
    if base is None:
        raise ValueError(f"not a site or domain: {domain!r}")
    seen: set = set()
    site = drop_folder_duplicates(_dedupe(site_seed(plain, base), seen))
    off: list[str] = []
    if bd is not None:
        for q in SERP_QUERIES:
            for n in _dedupe(serp(bd, q.format(firm=firm)), seen):
                (site if in_scope(n, base) else off).append(n)
    off = off[:max(cap // 3, cap - len(site))]
    site = site[:cap - len(off)]
    return ([{"url": u, "channel": guess_channel(u), "source": "site"} for u in site] +
            [{"url": u, "channel": guess_channel(u), "source": "serp"} for u in off])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--firm", required=True, help="firm name as it appears publicly")
    ap.add_argument("--domain", required=True, help="firm website, e.g. hartwell.example or user.github.io/repo")
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
