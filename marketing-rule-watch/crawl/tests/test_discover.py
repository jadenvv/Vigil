"""Offline tests for crawl/discover.py. Both the firm site and Bright Data SERP are mocked."""
import json

import httpx

import discover

HOME = """<html><body>
<a href="/about">About</a> <a href="/blog/">Blog</a> <a href="/blog/post-1#top">Post</a>
<a href="https://hartwell.example/fees">Fees</a> <a href="mailto:x@hartwell.example">Mail</a>
<a href="/brochure.pdf">PDF</a> <a href="https://other.example/x">Elsewhere</a>
</body></html>"""
SITEMAP = """<?xml version="1.0"?><urlset>
<url><loc>https://hartwell.example/performance</loc></url>
<url><loc> https://www.hartwell.example/about/ </loc></url></urlset>"""


def site_client():
    def handler(req):
        if req.url.path == "/sitemap.xml":
            return httpx.Response(200, text=SITEMAP)
        if req.url.path == "/":
            return httpx.Response(200, text=HOME)
        return httpx.Response(404)
    return httpx.Client(transport=httpx.MockTransport(handler))


def serp_client(queries):
    def handler(req):
        body = json.loads(req.content)
        queries.append(body["url"])
        assert body["zone"] == "serp_zone" and body["format"] == "raw"
        return httpx.Response(200, json={"organic": [
            {"link": "https://www.linkedin.com/company/hartwell-wealth"},
            {"link": "https://www.linkedin.com/in/some-person"},
            {"link": "https://www.yelp.com/biz/hartwell-wealth"},
            {"link": "https://hartwell.example/about"},
        ]})
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_site_only_dedupes_and_filters(sandbox):
    rows = discover.discover("Hartwell Wealth", "hartwell.example", site_client(), None)
    urls = [r["url"] for r in rows]
    assert urls == ["https://hartwell.example/", "https://hartwell.example/about",
                    "https://hartwell.example/blog", "https://hartwell.example/blog/post-1",
                    "https://hartwell.example/fees", "https://hartwell.example/performance"]
    assert {r["source"] for r in rows} == {"site"}
    assert dict((r["url"], r["channel"]) for r in rows)["https://hartwell.example/blog/post-1"] == "blog"


def test_serp_adds_offsite_and_drops_personal_profiles(sandbox, monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_SERP_ZONE", "serp_zone")
    queries = []
    rows = discover.discover("Hartwell Wealth", "hartwell.example", site_client(), serp_client(queries))
    urls = [r["url"] for r in rows]
    assert len(queries) == len(discover.SERP_QUERIES)  # one call per query, no retries
    assert "brd_json=1" in queries[0] and "%22Hartwell+Wealth%22" in queries[0]
    assert "https://linkedin.com/company/hartwell-wealth" in urls
    assert "https://yelp.com/biz/hartwell-wealth" in urls
    assert not any("/in/" in u for u in urls)
    assert urls.count("https://hartwell.example/about") == 1
    by = {r["url"]: r for r in rows}
    assert by["https://linkedin.com/company/hartwell-wealth"]["channel"] == "linkedin"
    assert by["https://yelp.com/biz/hartwell-wealth"]["channel"] == "review_site"


def test_cap_is_enforced(sandbox):
    many = "".join(f'<a href="/p{i}">x</a>' for i in range(100))

    def handler(req):
        return httpx.Response(200, text=many) if req.url.path == "/" else httpx.Response(404)
    rows = discover.discover("F", "f.example", httpx.Client(transport=httpx.MockTransport(handler)), None)
    assert len(rows) == 25


def test_serp_error_is_logged_not_retried(sandbox, monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_SERP_ZONE", "serp_zone")
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(407, text="no")
    assert discover.serp(httpx.Client(transport=httpx.MockTransport(handler)), "q") == []
    assert len(calls) == 1
    assert "\tserp\t407\t" in (sandbox / "calls.log").read_text()


def test_site_down_does_not_crash(sandbox):
    def handler(req):
        raise httpx.ConnectError("down")
    rows = discover.discover("F", "f.example", httpx.Client(transport=httpx.MockTransport(handler)), None)
    assert [r["url"] for r in rows] == ["https://f.example/"]


def test_parse_serp_fallback_on_html():
    html = '<a href="https://firm.example/x">x</a> text https://press.example/y).'
    assert discover.parse_serp(html) == ["https://firm.example/x", "https://press.example/y"]
