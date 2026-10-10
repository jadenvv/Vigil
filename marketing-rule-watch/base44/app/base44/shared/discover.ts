// Pure helpers for the `discover` function. Port of crawl/discover.py (owner: P3; source of truth).
// No imports, so it runs on Deno (Base44) and in the self-check below:
//   deno run base44/shared/discover.ts
// Fetched HTML, sitemaps and SERP bodies are untrusted: we only ever extract URLs from them.

export const SERP_QUERIES = ['"{firm}" site:linkedin.com', '"{firm}" reviews', '"{firm}" "top advisor"'];
const TRACKING_PARAMS = ["utm_", "originalsubdomain=", "trk=", "fbclid=", "gclid="];
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|svg|webp|css|js|ico|zip|xml|mp4|mp3)$/i;
const SKIP_HOSTS = ["google.", "gstatic.", "googleusercontent.", "youtube.com", "facebook.com/sharer",
  "twitter.com/intent", "schema.org", "w3.org"];

function parse(url: string): URL | null {
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

/** Drop fragment, tracking params and trailing slash so duplicates collapse. "" if unparseable. */
export function normalize(url: string): string {
  const p = parse(url);
  if (!p) return "";
  const path = p.pathname.replace(/\/+$/, "") || "/";
  let host = p.host.toLowerCase().replace(/^www\./, "");
  host = host.replace(/^[a-z]{2}\.linkedin\.com$/, "linkedin.com"); // il.linkedin.com etc. from Google
  const query = p.search.replace(/^\?/, "").split("&")
    .filter((kv) => kv && !TRACKING_PARAMS.some((t) => kv.toLowerCase().startsWith(t))).join("&");
  return `${p.protocol.toLowerCase()}//${host}${path}${query ? "?" + query : ""}`;
}

export function keep(url: string): boolean {
  const p = parse(url);
  if (!p || !["http:", "https:"].includes(p.protocol) || !p.host) return false;
  if (SKIP_EXT.test(p.pathname)) return false;
  if (SKIP_HOSTS.some((h) => (p.host + p.pathname).toLowerCase().includes(h))) return false;
  if (p.host.includes("linkedin.com") && p.pathname.startsWith("/in/")) return false; // personal profile
  return true;
}

/** Bare host of a domain input like "hartwell.example", "https://www.hartwell.example/x". */
export function domainHost(domain: string): string {
  const d = domain.trim().toLowerCase();
  const p = parse(d.includes("//") ? d : `https://${d}`);
  return (p?.host ?? d).replace(/^www\./, "");
}

export function sameSite(url: string, domain: string): boolean {
  const host = (parse(url)?.host ?? "").toLowerCase().replace(/^www\./, "");
  const d = domainHost(domain);
  return host === d || host.endsWith("." + d);
}

const A_HREF = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

/** <a href> targets, resolved against `base`. mailto/tel/javascript/# are dropped. */
export function linksFromHtml(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(A_HREF)) {
    const href = (m[1] ?? m[2] ?? m[3] ?? "").replace(/&amp;/g, "&").trim();
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    try {
      out.push(new URL(href, base).href);
    } catch {
      // unresolvable href: skip it
    }
  }
  return out;
}

export function urlsFromSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].trim());
}

/** organic[].link from brd_json=1; falls back to any http(s) URL in the body. */
export function parseSerp(body: string): string[] {
  try {
    const data = JSON.parse(body);
    // deno-lint-ignore no-explicit-any
    return (data?.organic ?? []).map((o: any) => o?.link || o?.url).filter(Boolean);
  } catch {
    return [...body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0].replace(/[).,'"]+$/, ""));
  }
}

/** Normalize, filter and dedupe against `seen` (shared across sources, so order = priority). */
export function dedupe(urls: string[], seen: Set<string>): string[] {
  const out: string[] = [];
  for (const u of urls) {
    const n = normalize(u);
    if (n && !seen.has(n) && keep(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** discover.py's cap: off-site gets at least a third of the cap (more if the site is small). */
export function applyCap(site: string[], off: string[], cap: number): { site: string[]; off: string[] } {
  const offKept = off.slice(0, Math.max(Math.floor(cap / 3), cap - site.length));
  return { site: site.slice(0, cap - offKept.length), off: offKept };
}

if (import.meta.main) {
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
  eq(normalize("https://WWW.Hartwell.example/about/?utm_source=x&a=1#team"), "https://hartwell.example/about?a=1", "normalize");
  eq(normalize("https://il.linkedin.com/company/hw?trk=abc"), "https://linkedin.com/company/hw", "normalize linkedin");
  eq(normalize("https://hartwell.example"), "https://hartwell.example/", "normalize root");
  eq(keep("https://linkedin.com/in/jane-doe"), false, "personal profile dropped");
  eq(keep("https://linkedin.com/company/hw"), true, "company page kept");
  eq(keep("https://hartwell.example/brochure.pdf"), false, "pdf dropped");
  eq(keep("https://www.google.com/search?q=x"), false, "google dropped");
  eq(sameSite("https://blog.hartwell.example/x", "https://www.hartwell.example/"), true, "subdomain same-site");
  eq(sameSite("https://nothartwell.example/", "hartwell.example"), false, "suffix lookalike");
  eq(linksFromHtml(`<a href="/fees">F</a><A class=x HREF='blog/p?a=1&amp;b=2'>B</A><a href=mailto:a@b.c>m</a><a href="#top">t</a>`,
    "https://hartwell.example/"), ["https://hartwell.example/fees", "https://hartwell.example/blog/p?a=1&b=2"], "links");
  eq(urlsFromSitemap("<urlset><url><loc> https://h.example/a </loc></url><url><loc>https://h.example/b</loc></url></urlset>"),
    ["https://h.example/a", "https://h.example/b"], "sitemap");
  eq(parseSerp('{"organic":[{"link":"https://a.example/x"},{"url":"https://b.example"},{}]}'),
    ["https://a.example/x", "https://b.example"], "serp json");
  eq(parseSerp("<html>see https://c.example/p). and</html>"), ["https://c.example/p"], "serp fallback");
  const seen = new Set<string>();
  eq(dedupe(["https://h.example/a/", "https://www.h.example/a", "mailto:x"], seen), ["https://h.example/a"], "dedupe");
  eq(applyCap(Array.from({ length: 30 }, (_, i) => `s${i}`), ["o1", "o2"], 25).site.length, 23, "cap keeps room for off-site");
  console.log("discover.ts self-check: ok");
}
