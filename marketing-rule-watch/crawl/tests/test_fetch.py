"""Offline tests for crawl/fetch.py. Bright Data is mocked; no credits are spent."""
import hashlib
import json

import httpx
import pytest

import fetch
from conftest import PNG


def mock_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), headers={"Authorization": "Bearer test_token"})


def test_fetch_page_builds_page_contract(sandbox):
    seen = []

    def handler(req):
        seen.append(json.loads(req.content))
        return httpx.Response(200, text="# Hello\n\nWorld")

    page = fetch.fetch_page(mock_client(handler), "https://firm.example/blog/post-1")
    assert set(page) == {"url", "channel", "markdown", "fetched_at", "sha256", "screenshot_ref"}
    assert page["channel"] == "blog"
    assert page["sha256"] == hashlib.sha256(b"# Hello\n\nWorld").hexdigest()
    assert page["fetched_at"].endswith("+00:00")
    assert seen == [{"zone": "test_zone", "url": "https://firm.example/blog/post-1",
                     "format": "raw", "data_format": "markdown"}]
    assert "\t200\t" in (sandbox / "calls.log").read_text()


def test_fetch_page_raises_on_error_without_retry(sandbox):
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(502, text="bad gateway")

    with pytest.raises(RuntimeError, match="HTTP 502"):
        fetch.fetch_page(mock_client(handler), "https://firm.example/")
    assert len(calls) == 1  # no retry loop


def test_screenshot_saved_when_png(sandbox):
    def handler(req):
        fmt = json.loads(req.content)["data_format"]
        return httpx.Response(200, content=PNG) if fmt == "screenshot" else httpx.Response(200, text="hi")

    page = fetch.fetch_page(mock_client(handler), "https://firm.example/", screenshot=True)
    assert page["screenshot_ref"].endswith(".png")
    assert len(list((sandbox / "screens").glob("*.png"))) == 1


def test_screenshot_failure_keeps_page(sandbox):
    def handler(req):
        fmt = json.loads(req.content)["data_format"]
        return httpx.Response(200, text="not a png") if fmt == "screenshot" else httpx.Response(200, text="hi")

    page = fetch.fetch_page(mock_client(handler), "https://firm.example/", screenshot=True)
    assert page["markdown"] == "hi" and page["screenshot_ref"] == ""


@pytest.mark.parametrize("url,channel", [
    ("https://www.linkedin.com/company/x", "linkedin"),
    ("https://www.yelp.com/biz/x", "review_site"),
    ("https://www.prnewswire.com/news/x", "press"),
    ("https://firm.example/press/award", "press"),
    ("https://firm.example/insights/q3", "blog"),
    ("https://firm.example/about", "website"),
])
def test_guess_channel(url, channel):
    assert fetch.guess_channel(url) == channel


SAMPLE = "# Title\n\nIntro para.\n\n## Section A\n\n" + ("word " * 400 + "\n\n") * 6 + "## Section B\n\nEnd."


@pytest.mark.parametrize("md", ["", "short", SAMPLE, "x" * 20000, SAMPLE * 5])
@pytest.mark.parametrize("max_chars", [500, 6000])
def test_chunk_offsets_round_trip(md, max_chars):
    chunks = fetch.chunk(md, max_chars)
    assert "".join(c["text"] for c in chunks) == md  # nothing lost or duplicated
    for c in chunks:
        assert md[c["start"]:c["start"] + len(c["text"])] == c["text"]
        assert 0 < len(c["text"]) <= max_chars


def test_chunk_prefers_heading_boundaries():
    chunks = fetch.chunk(SAMPLE * 3, 6000)
    assert len(chunks) > 1
    assert all(c["text"].startswith("#") or c["text"].startswith("word") or c["start"] == 0 for c in chunks)


def test_cli_rejects_more_than_cap(monkeypatch, capsys):
    monkeypatch.setattr("sys.argv", ["fetch.py"] + [f"https://e.example/{i}" for i in range(26)])
    with pytest.raises(SystemExit):
        fetch.main()
    assert "cap of 25" in capsys.readouterr().err
