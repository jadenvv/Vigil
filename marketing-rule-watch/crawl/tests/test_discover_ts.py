"""Parity: base44/app/base44/shared/discover.ts must scope and filter URLs exactly like crawl/discover.py.

Runs the TS under Node 22+ (--experimental-strip-types); skipped if node can't."""
import json
import subprocess
from pathlib import Path

import pytest

import discover

TS = Path(__file__).resolve().parents[2] / "base44" / "app" / "base44" / "shared" / "discover.ts"
URLS = ["https://www.linkedin.com/in/x", "https://linkedin.com/company/x?trk=1", "https://instagram.com/f",
        "https://forbes.com/profile/x", "https://facebook.com/f/posts/1", "https://facebook.com/f",
        "https://x.example/ceo-net-worth", "https://f.example/a?utm_source=x&page=2", "https://f.example/doc.pdf",
        "https://u.github.io/firm-demo/a.html", "https://u.github.io/other/a.html", "https://sub.f.example/x"]
BASES = ["f.example", "https://www.f.example", "u.github.io/firm-demo", "u.github.io/firm-demo/index.html"]
SCRIPT = f"""
import * as d from {json.dumps(TS.as_uri())};
const job = {json.dumps({"urls": URLS, "bases": BASES})};
const out = {{queries: d.SERP_QUERIES, norm: job.urls.map(d.normalize), keep: job.urls.map(u => d.keep(d.normalize(u))),
  bases: job.bases.map(b => {{ const s = d.siteBase(b); return s && [s.url, s.host, s.path]; }}),
  scope: job.bases.map(b => job.urls.map(u => d.inScope(u, d.siteBase(b))))}};
console.log(JSON.stringify(out));
"""


@pytest.fixture(scope="module")
def ts():
    try:
        r = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", SCRIPT],
                           capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        pytest.skip("node not installed")
    if "bad option" in r.stderr:
        pytest.skip("node < 22.6 (no --experimental-strip-types)")
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def test_queries_match(ts):
    assert ts["queries"] == discover.SERP_QUERIES


def test_normalize_and_keep_match(ts):
    assert ts["norm"] == [discover.normalize(u) for u in URLS]
    assert ts["keep"] == [discover.keep(discover.normalize(u)) for u in URLS]


def test_site_base_and_scope_match(ts):
    assert ts["bases"] == [list(discover.site_base(b)) for b in BASES]
    assert ts["scope"] == [[discover.in_scope(u, discover.site_base(b)) for u in URLS] for b in BASES]
