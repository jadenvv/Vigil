#!/usr/bin/env python3
"""
Snapshots: keep every distinct version of each crawled page so a firm can show what it said on a date.

Reads Page JSON from fetch.py and appends to an on-disk history:
  crawl/out/snapshots/<sha1(url)[:12]>/<fetched_at>_<sha256[:12]>.md   (exact markdown as fetched)
  crawl/out/snapshots/index.json                                         ({url: [Snapshot, ...]})
A page only gets a new snapshot when its sha256 changed since the last one. Changed pages get a
unified diff (difflib) against the previous version.

Snapshot = Page fields (minus markdown) + {"path", "prev_sha256", "diff"}

USAGE (from marketing-rule-watch/)
  python3 crawl/fetch.py --urls-file crawl/out/urls.txt --out crawl/out/pages.json
  python3 crawl/snapshot.py crawl/out/pages.json            # prints new / changed / unchanged
  python3 crawl/snapshot.py --history https://firm.example/  # list stored versions of one URL
No network calls, no credits.
"""
import argparse
import difflib
import hashlib
import json
import sys
from pathlib import Path

from fetch import HERE

SNAP_DIR = HERE / "out" / "snapshots"


def _index_path(root: Path) -> Path:
    return root / "index.json"


def load_index(root: Path = SNAP_DIR) -> dict:
    p = _index_path(root)
    return json.loads(p.read_text()) if p.exists() else {}


def diff(old: str, new: str, url: str = "") -> str:
    return "".join(difflib.unified_diff(old.splitlines(keepends=True), new.splitlines(keepends=True),
                                        fromfile=f"{url} (before)", tofile=f"{url} (after)", n=2))


def record(pages: list[dict], root: Path = SNAP_DIR) -> list[dict]:
    """Store new versions. Returns one result per page: {url, status: new|changed|unchanged, snapshot}."""
    index = load_index(root)
    results = []
    for page in pages:
        url = page["url"]
        history = index.setdefault(url, [])
        last = history[-1] if history else None
        if last and last["sha256"] == page["sha256"]:
            results.append({"url": url, "status": "unchanged", "snapshot": last})
            continue
        folder = root / hashlib.sha1(url.encode()).hexdigest()[:12]
        folder.mkdir(parents=True, exist_ok=True)
        stamp = page["fetched_at"].replace(":", "").replace("+", "Z")
        path = folder / f"{stamp}_{page['sha256'][:12]}.md"
        path.write_text(page["markdown"], encoding="utf-8")
        snap = {k: v for k, v in page.items() if k != "markdown"}
        snap["path"] = str(path.relative_to(root))
        snap["prev_sha256"] = last["sha256"] if last else ""
        snap["diff"] = diff((root / last["path"]).read_text(encoding="utf-8"), page["markdown"], url) if last else ""
        history.append(snap)
        results.append({"url": url, "status": "changed" if last else "new", "snapshot": snap})
    root.mkdir(parents=True, exist_ok=True)
    _index_path(root).write_text(json.dumps(index, indent=2, ensure_ascii=False))
    return results


def as_of(url: str, when: str, root: Path = SNAP_DIR) -> dict | None:
    """The version that was live at `when` (UTC ISO-8601): the latest snapshot fetched at or before it."""
    older = [s for s in load_index(root).get(url, []) if s["fetched_at"] <= when]
    return older[-1] if older else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pages", nargs="?", help="Page JSON from fetch.py")
    ap.add_argument("--history", metavar="URL", help="list stored versions of one URL")
    ap.add_argument("--root", default=str(SNAP_DIR))
    args = ap.parse_args()
    root = Path(args.root)

    if args.history:
        for s in load_index(root).get(args.history, []):
            print(f"{s['fetched_at']}  {s['sha256'][:12]}  {root / s['path']}")
        return 0
    if not args.pages:
        ap.error("give a pages.json or --history URL")

    results = record(json.loads(Path(args.pages).read_text()), root)
    for r in results:
        print(f"  {r['status']:<9} {r['url']}", file=sys.stderr)
        if r["status"] == "changed":
            print(r["snapshot"]["diff"], file=sys.stderr)
    counts = {s: sum(r["status"] == s for r in results) for s in ("new", "changed", "unchanged")}
    print(f"\n{counts} -> {_index_path(root)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
