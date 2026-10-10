"""Parity: crawl/base44/brightdata.ts (runs in Base44) must behave exactly like crawl/fetch.py."""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

import pytest

import fetch
from test_fetch import SAMPLE

HARNESS = Path(__file__).with_name("ts_harness.ts")
pytestmark = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")

URLS = ["https://www.linkedin.com/company/x", "https://www.yelp.com/biz/x", "https://www.prnewswire.com/n",
        "https://firm.example/press/a", "https://firm.example/insights/q3", "https://firm.example/about",
        "https://firm.example/news", "https://firm.example/posts/1"]
TEXTS = ["", "short", SAMPLE, SAMPLE * 4, "x" * 13000, "# A\n\n\n\nB\n   \n# C\n" * 900, "Café — naïve “quotes”\n\n" * 400]


@pytest.fixture(scope="module")
def ts():
    job = json.dumps({"urls": URLS, "texts": TEXTS, "max_chars": 6000})
    r = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", str(HARNESS)],
                       input=job, capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def test_channel_parity(ts):
    assert ts["channels"] == [fetch.guess_channel(u) for u in URLS]


def test_sha256_parity(ts):
    assert ts["sha"] == [hashlib.sha256(t.encode()).hexdigest() for t in TEXTS]


def test_chunk_parity(ts):
    assert ts["chunks"] == [fetch.chunk(t, 6000) for t in TEXTS]


def test_fetch_page_contract(ts):
    f = ts["fetch"]
    assert set(f["page"]) == {"url", "channel", "markdown", "fetched_at", "sha256", "screenshot_ref"}
    assert f["page"]["channel"] == "blog" and f["page"]["markdown"] == "# Hi\n\nThere"
    assert f["page"]["sha256"] == hashlib.sha256(b"# Hi\n\nThere").hexdigest()
    assert f["page"]["fetched_at"].endswith("+00:00") and "." not in f["page"]["fetched_at"]
    assert f["screenshot_len"] == 10 and f["log_lines"] == 2
    assert f["sent"][0] == {"zone": "z", "url": "https://firm.example/blog/x", "format": "raw", "data_format": "markdown"}
    assert "HTTP 502" in f["err"]
    fails = [s for s in f["sent"] if s["url"].endswith("/fail")]
    assert sum(1 for s in fails if s["data_format"] == "markdown") == 2  # one per call above, no retry


def test_markdown_and_screenshot_run_in_parallel(ts):
    p = ts["parallel"]
    assert p["has_shot"]
    assert p["elapsed_ms"] < 550, p  # two 300 ms calls overlap instead of taking 600+ ms
    assert "HTTP 502" in p["err_with_shot"]
