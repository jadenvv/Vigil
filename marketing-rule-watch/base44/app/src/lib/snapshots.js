// Page history in the app. Every scan stores a new Page row, so the rows for one URL are its snapshots;
// there is no separate Snapshot entity. Same rules as crawl/snapshot.py: versions in fetch order,
// "changed" means a different sha256 from the previous capture, and as-of returns the latest capture
// fetched at or before the given time.

function captureTime(page) {
  const t = Date.parse(page.fetched_at ?? page.created_date ?? "");
  return Number.isNaN(t) ? 0 : t;
}

// Oldest first, each with {changed, isFirst} relative to the capture before it.
export function versions(pages) {
  const sorted = [...pages].sort((a, b) => captureTime(a) - captureTime(b));
  return sorted.map((page, i) => ({
    page,
    isFirst: i === 0,
    changed: i > 0 && (page.sha256 || "") !== (sorted[i - 1].sha256 || ""),
  }));
}

// One row per URL: the most recent capture. The inbox and Exam view show only these.
export function latestPerUrl(pages) {
  const latest = new Map();
  for (const page of pages) {
    const current = latest.get(page.url);
    if (!current || captureTime(page) >= captureTime(current)) latest.set(page.url, page);
  }
  return [...latest.values()];
}

// `when` is a Date or epoch ms. Returns null when nothing had been captured yet.
export function asOf(pages, when) {
  const limit = when instanceof Date ? when.getTime() : when;
  let found = null;
  for (const page of pages) {
    const t = captureTime(page);
    if (t <= limit && (!found || t >= captureTime(found))) found = page;
  }
  return found;
}

// Line diff (LCS), returned as hunks with `context` unchanged lines around each change, like
// difflib.unified_diff(n=2). Lines: {type: "same"|"add"|"del", text}. Pages are capped at ~20k chars,
// so the O(n*m) table stays small.
export function lineDiff(oldText, newText, context = 2) {
  const a = (oldText ?? "").split("\n");
  const b = (newText ?? "").split("\n");
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const lines = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: "del", text: a[i++] });
    } else {
      lines.push({ type: "add", text: b[j++] });
    }
  }
  while (i < n) lines.push({ type: "del", text: a[i++] });
  while (j < m) lines.push({ type: "add", text: b[j++] });

  const keep = new Array(lines.length).fill(false);
  lines.forEach((line, k) => {
    if (line.type === "same") return;
    for (let c = Math.max(0, k - context); c <= Math.min(lines.length - 1, k + context); c++) keep[c] = true;
  });
  const hunks = [];
  let hunk = null;
  lines.forEach((line, k) => {
    if (!keep[k]) {
      hunk = null;
      return;
    }
    if (!hunk) hunks.push((hunk = []));
    hunk.push(line);
  });
  return hunks;
}
