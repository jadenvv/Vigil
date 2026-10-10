// Bright Data crawl for the Base44 `scan` function. TypeScript port of crawl/fetch.py.
// P2: copy this file to base44/app/base44/shared/brightdata.ts. No imports, so it runs on
// Deno (Base44) and Node (crawl/tests). Parity with fetch.py is tested in crawl/tests/test_ts_port.py.
//
// API (docs.brightdata.com/api-reference/rest-api/unlocker/unlock-website, checked Oct 10):
//   POST https://api.brightdata.com/request   Authorization: Bearer <token>
//   {"zone", "url", "format": "raw", "data_format": "markdown" | "screenshot"}
// Rules: max 25 URLs per scan, one request at a time, no retries. Page text is untrusted data.

export const API_URL = "https://api.brightdata.com/request";
export const MAX_URLS = 25;

export type Channel = "website" | "blog" | "linkedin" | "review_site" | "press" | "other";

export interface Page {
  url: string;
  channel: Channel;
  markdown: string;
  fetched_at: string; // UTC ISO-8601
  sha256: string;
  screenshot_ref: string; // filled by the caller after uploading `screenshot`
}

export interface FetchResult {
  page: Page;
  screenshot: Uint8Array | null; // PNG bytes, or null if not requested / failed
  log: string[]; // one line per Bright Data call, same shape as crawl/calls.log
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export function guessChannel(url: string): Channel {
  const u = new URL(url);
  const host = u.host.toLowerCase();
  const path = u.pathname.toLowerCase();
  if (host.includes("linkedin.com")) return "linkedin";
  if (["yelp.", "google.", "trustpilot.", "glassdoor.", "wiseradvisor", "smartasset"].some((s) => host.includes(s))) {
    return "review_site";
  }
  if (["prnewswire", "businesswire", "globenewswire"].some((s) => host.includes(s)) ||
      path.includes("/press") || path.includes("/news")) return "press";
  if (path.includes("/blog") || path.includes("/insights") || path.includes("/posts")) return "blog";
  return "website";
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"); // matches Python isoformat(timespec="seconds")
}

async function unlock(fetchFn: FetchFn, token: string, zone: string, url: string, dataFormat: string, log: string[]) {
  const t0 = Date.now();
  try {
    const r = await fetchFn(API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone, url, format: "raw", data_format: dataFormat }),
    });
    const bytes = new Uint8Array(await r.arrayBuffer());
    log.push(`${new Date().toISOString()}\t${dataFormat}\t${r.status}\t${((Date.now() - t0) / 1000).toFixed(1)}s\t${bytes.length}B\t${url}`);
    return { status: r.status, bytes };
  } catch (e) {
    log.push(`${new Date().toISOString()}\t${dataFormat}\tERR:${(e as Error).name}\t${((Date.now() - t0) / 1000).toFixed(1)}s\t0B\t${url}`);
    throw e;
  }
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** One URL -> one Page. Throws on a non-200 markdown fetch (no retry, by design). */
export async function fetchPage(
  url: string,
  opts: { token: string; zone: string; channel?: Channel; screenshot?: boolean; fetchFn?: FetchFn },
): Promise<FetchResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const log: string[] = [];
  // Markdown and screenshot run in parallel (~10-13 s -> ~6 s per URL inside Base44). Cost: a
  // screenshot credit is spent even when the markdown fetch fails. Still one attempt each, no retries.
  const mdCall = unlock(fetchFn, opts.token, opts.zone, url, "markdown", log);
  const shot = opts.screenshot
    ? unlock(fetchFn, opts.token, opts.zone, url, "screenshot", log).catch(() => null)
    : Promise.resolve(null);
  const md = await mdCall.catch(async (e) => {
    await shot;
    throw e;
  });
  const markdown = new TextDecoder().decode(md.bytes);
  if (md.status !== 200) {
    await shot;
    throw new Error(`${url}: HTTP ${md.status}: ${markdown.slice(0, 200)}`);
  }
  const page: Page = {
    url,
    channel: opts.channel || guessChannel(url),
    markdown,
    fetched_at: nowIso(),
    sha256: await sha256Hex(markdown),
    screenshot_ref: "",
  };
  // screenshot is evidence, not a blocker: on failure the page still returns, UI shows "screenshot unavailable"
  const s = await shot;
  const screenshot = s && s.status === 200 && PNG_MAGIC.every((b, i) => s.bytes[i] === b) ? s.bytes : null;
  return { page, screenshot, log };
}

/**
 * Split markdown into ~1,500-token chunks (6,000 chars) on heading / paragraph boundaries.
 * markdown.slice(start, start + text.length) === text for every chunk. Offsets are UTF-16 units,
 * which is what String.prototype.indexOf uses in the app (Python counts code points; same for BMP text).
 */
export function chunk(markdown: string, maxChars = 6000): { start: number; text: string }[] {
  const set = new Set<number>([0, markdown.length]);
  for (const m of markdown.matchAll(/^#{1,6} /gm)) set.add(m.index!);
  for (const m of markdown.matchAll(/\n\s*\n/g)) set.add(m.index! + m[0].length);
  const bounds = [...set].sort((a, b) => a - b);
  const chunks: { start: number; text: string }[] = [];
  let start = 0;
  while (start < markdown.length) {
    const limit = start + maxChars;
    const cands = bounds.filter((b) => b > start && b <= limit);
    let end = cands.length && limit < markdown.length ? cands[cands.length - 1] : Math.min(limit, markdown.length);
    if (end <= start) end = Math.min(limit, markdown.length);
    chunks.push({ start, text: markdown.slice(start, end) });
    start = end;
  }
  return chunks;
}
