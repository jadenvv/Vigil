"""Offline tests for crawl/snapshot.py."""
import hashlib

import snapshot


def page(md, at, url="https://firm.example/performance"):
    return {"url": url, "channel": "website", "markdown": md, "fetched_at": at,
            "sha256": hashlib.sha256(md.encode()).hexdigest(), "screenshot_ref": ""}


def test_new_then_unchanged_then_changed(tmp_path):
    v1 = page("# Performance\n\nReturns 12% net.\n", "2026-10-10T13:00:00+00:00")
    v1b = page("# Performance\n\nReturns 12% net.\n", "2026-10-10T14:00:00+00:00")
    v2 = page("# Performance\n\nReturns 31% gross!\n", "2026-10-10T15:00:00+00:00")

    assert [r["status"] for r in snapshot.record([v1], tmp_path)] == ["new"]
    assert [r["status"] for r in snapshot.record([v1b], tmp_path)] == ["unchanged"]
    [r] = snapshot.record([v2], tmp_path)
    assert r["status"] == "changed"
    assert r["snapshot"]["prev_sha256"] == v1["sha256"]
    assert "-Returns 12% net." in r["snapshot"]["diff"] and "+Returns 31% gross!" in r["snapshot"]["diff"]

    hist = snapshot.load_index(tmp_path)[v1["url"]]
    assert len(hist) == 2  # unchanged re-crawl did not add a version
    assert (tmp_path / hist[0]["path"]).read_text() == v1["markdown"]  # exact text preserved
    assert "markdown" not in hist[0]


def test_as_of_returns_version_live_at_date(tmp_path):
    snapshot.record([page("old", "2026-10-10T13:00:00+00:00")], tmp_path)
    snapshot.record([page("new", "2026-10-10T15:00:00+00:00")], tmp_path)
    url = "https://firm.example/performance"
    assert snapshot.as_of(url, "2026-10-10T12:00:00+00:00", tmp_path) is None
    s = snapshot.as_of(url, "2026-10-10T14:30:00+00:00", tmp_path)
    assert (tmp_path / s["path"]).read_text() == "old"
    s = snapshot.as_of(url, "2026-10-10T16:00:00+00:00", tmp_path)
    assert (tmp_path / s["path"]).read_text() == "new"


def test_pages_tracked_independently(tmp_path):
    a = page("A", "2026-10-10T13:00:00+00:00", "https://firm.example/a")
    b = page("B", "2026-10-10T13:00:00+00:00", "https://firm.example/b")
    assert [r["status"] for r in snapshot.record([a, b], tmp_path)] == ["new", "new"]
    assert set(snapshot.load_index(tmp_path)) == {a["url"], b["url"]}
