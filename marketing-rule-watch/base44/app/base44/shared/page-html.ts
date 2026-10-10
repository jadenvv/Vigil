// Raw HTML capture for the "page as captured" view. Scraped HTML is untrusted: we strip active content
// here as a cheap first layer, and the client sanitizes again before rendering.
// Self-check: deno run base44/shared/page-html.ts
import { API_URL } from "./brightdata.ts";

export const MAX_HTML_BYTES = 2_000_000;

/**
 * One Bright Data Unlocker call with format "raw" and no data_format, which returns the page's HTML.
 * Returns null on any failure (no retry): the page is still stored, only without a capture.
 */
export async function fetchRawHtml(url: string, token: string, zone: string, log: string[]): Promise<string | null> {
  const t0 = Date.now();
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone, url, format: "raw" }),
    });
    const html = await r.text();
    log.push(`${new Date().toISOString()}\thtml\t${r.status}\t${((Date.now() - t0) / 1000).toFixed(1)}s\t${html.length}B\t${url}`);
    if (r.status !== 200 || !/<html|<body|<head/i.test(html)) return null;
    return html.length > MAX_HTML_BYTES ? null : html;
  } catch (e) {
    log.push(`${new Date().toISOString()}\thtml\tERR:${(e as Error).name}\t${((Date.now() - t0) / 1000).toFixed(1)}s\t0B\t${url}`);
    return null;
  }
}

/** Removes scripts, frames, embeds, inline event handlers and javascript: URLs. */
export function stripActiveContent(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "") // unclosed or self-closing
    .replace(/<(iframe|frame|frameset|object|embed|applet)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(iframe|frame|object|embed|applet)\b[^>]*\/?>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "")
    // attribute rewrites only inside tags, so visible text (which the highlight must match) is untouched
    .replace(/<[a-z][^>]*>/gi, (tag) =>
      tag
        .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/(href|src|action|formaction)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"'));
}

/** Adds <base href> so the page's relative CSS, images and links resolve against its original URL. */
export function withBase(html: string, pageUrl: string): string {
  if (/<base\b/i.test(html)) return html;
  const tag = `<base href="${pageUrl.replace(/"/g, "&quot;")}">`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (m) => `${m}${tag}`);
  return tag + html;
}

if (import.meta.main) {
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
  const dirty = `<html><head><script src="x.js"></script><SCRIPT>alert(1)</SCRIPT><meta http-equiv="refresh" content="0;url=evil">` +
    `<link rel="stylesheet" href="style.css"></head><body onload="x()"><p onclick='y()'>We guarantee 8%.</p>` +
    `<a href="javascript:alert(1)">a</a><iframe src="//evil"></iframe><embed src="e.swf"><script>unclosed`;
  const clean = stripActiveContent(dirty);
  eq(/script|onload|onclick|javascript:|iframe|embed|refresh/i.test(clean), false, "active content gone");
  eq(clean.includes("<p>We guarantee 8%.</p>") && clean.includes('href="style.css"'), true, "content and css kept");
  eq(stripActiveContent("<p>Focus on=results, onboarding = easy</p>"), "<p>Focus on=results, onboarding = easy</p>", "text untouched");
  eq(withBase("<html><head><title>t</title></head></html>", "https://h.io/repo/a.html"),
    '<html><head><base href="https://h.io/repo/a.html"><title>t</title></head></html>', "base injected");
  eq(withBase('<head><base href="/x/"></head>', "https://h.io/"), '<head><base href="/x/"></head>', "existing base kept");
  console.log("page-html.ts self-check: ok");
}
