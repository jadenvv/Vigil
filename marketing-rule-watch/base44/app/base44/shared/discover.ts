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
  if (isPersonalOrSpam(p)) return false;
  return true;
}

// Business pages only (root CLAUDE.md): no personal social profiles or posts, no celebrity-wealth spam.
// Patterns come from a live "Hartwell Wealth" search on 2026-10-10. Search results only carry the URL
// (parseSerp keeps links, not titles), so spam is matched on the URL slug alone.
const WEALTH_SPAM = /net[-_ ]?worth|hidden[-_]wealth|wealth-grew|-worth-the-/i;

function isPersonalOrSpam(p: URL): boolean {
  const host = p.host.toLowerCase().replace(/^www\./, "");
  const path = p.pathname.toLowerCase();
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return true; // reels and profiles
  if (host.endsWith("forbes.com") && path.startsWith("/profile/")) return true;
  if (host.endsWith("facebook.com")) {
    // a company's own page (facebook.com/<page>) stays; profiles and individual posts/photos go
    if (path === "/profile.php" || path.startsWith("/people/")) return true;
    if (/\/(photos|posts|videos|reel|permalink\.php)\b/.test(path)) return true;
  }
  return WEALTH_SPAM.test(path);
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

/** Where a firm's site lives: a bare domain, or a host plus path (GitHub Pages and similar hosts). */
export interface SiteBase {
  url: string; // "https://host/path/", always ending in "/"
  host: string; // lowercased, no "www."
  path: string; // "/" for a bare domain, else "/path/"
}

/**
 * Accepts "hartwell.example", "https://www.hartwell.example", "nathanqiu07.github.io/quarrywick-wealth-demo"
 * or ".../quarrywick-wealth-demo/index.html" (a file name is trimmed to its folder). null if unparseable.
 */
export function siteBase(input: string): SiteBase | null {
  const raw = input.trim();
  const p = parse(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!p || !p.host.includes(".")) return null;
  let path = p.pathname.replace(/\/[^/]*\.[a-z0-9]+$/i, "/"); // drop a trailing file like index.html
  if (!path.endsWith("/")) path += "/";
  const host = p.host.toLowerCase().replace(/^www\./, "");
  return { url: `${p.protocol}//${p.host.toLowerCase()}${path}`, host, path };
}

/**
 * In scope for this firm. A bare domain keeps the old rule (host or any subdomain). A base with a
 * path means the same host AND under that path, so other sites sharing the host are excluded.
 */
export function inScope(url: string, base: SiteBase): boolean {
  const p = parse(url);
  if (!p) return false;
  const host = p.host.toLowerCase().replace(/^www\./, "");
  if (base.path === "/") return host === base.host || host.endsWith("." + base.host);
  return host === base.host && (p.pathname + "/").startsWith(base.path);
}

/** "Sitemap:" lines in a robots.txt. */
export function sitemapsFromRobots(txt: string): string[] {
  return [...txt.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
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

/**
 * A folder and its index.html are one page; scanning both would store it twice. Keeps the
 * index.html form (what sitemaps list) and drops the folder. Input is normalize()d URLs.
 */
export function dropFolderDuplicates(urls: string[]): string[] {
  const folders = new Set(
    urls.filter((u) => /\/index\.html?$/i.test(u)).map((u) => normalize(u.replace(/\/index\.html?$/i, "/"))),
  );
  return urls.filter((u) => !folders.has(u));
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
  // Fixture: the 24 search hits from the live "Hartwell Wealth" run (2026-10-10), after normalize().
  const dropped = [
    "https://hub.stellantis.com/article/how-much-is-lisa-hartwell-worth-the-hidden-wealth-of-a-rising-star",
    "https://oplev-api.tv2lorry.dk/article/how-lisa-hartwell-s-net-worth-reveals-the-hidden-wealth-of-a-modern-entrepreneur",
    "https://confapp.aarachminov.com/how-ed-hartwell-s-2020-fortune-reveals-the-hidden-wealth-of-a-tech-industry-trailblazer.html",
    "https://instagram.com/reel/DandgipA7Py",
    "https://booking.aabentlandbrug.dk/article/how-jamal-hartwell-s-wealth-grew-the-hidden-story-behind-his-net-worth",
    "https://facebook.com/DeepLifeQuotes365/photos/my-husband-brought-his-girlfriend-to-our-divorce-hearing-so-she-could-watch-him-/122236927286780192",
    "https://booking.aabentlandbrug.dk/article/how-ed-hartwell-s-wealth-grew-the-untold-story-behind-his-2021-financial-empire",
    "https://n8n.soundshockaudio.com/article/the-hidden-wealth-of-ed-hartwell-a-deep-look-at-his-2021-financial-standing",
    "https://facebook.com/profile.php?id=61593429118701",
    "https://forbes.com/profile/mack-hartwell",
  ];
  const kept = [
    "https://adviserinfo.sec.gov/firm/summary/322723",
    "https://linkedin.com/company/hartwell-wealth-management",
    "https://hartwellwealth.com/",
    "https://products.bankerslife.com/georgia/hartwell/wealth-management-solutions",
    "https://getwarmer.com/firms/hartwell-company",
    "https://indyfin.com/financial-advisor/michigan/st-joseph/james-hartwell-2843080",
    "https://hartwellwealth.com/faq.php",
    "https://indyfin.com/financial-advisor-firm/michigan/st-joseph/hartwell-company-322723",
    "https://advisor.ml.com/sites/oh/columbus-oh/the_hartwell_team",
    "https://financestrategists.com/wealth-management/hartwell-ga",
    "https://excelsiorwp.com/team/anna-hartwell",
    "https://hartwellfinancialservices.com/team/phil-hartwell",
    "https://careers.edwardjones.com/job/23268316/financial-advisor-hartwell-ga",
    "https://money.usnews.com/financial-advisors/advisor/krista-hartwell-7857707",
  ];
  eq(dropped.filter(keep), [], "personal/spam fixture all dropped");
  eq(kept.filter((u) => !keep(u)), [], "business fixture all kept");
  eq(keep("https://facebook.com/HartwellWealth"), true, "company facebook page kept");
  eq(keep("https://facebook.com/people/Jane-Doe/1000"), false, "facebook person dropped");
  // site base: bare domain keeps the old behaviour; a path scopes to that folder on the host
  const dom = siteBase("www.Hartwell.example")!;
  eq(dom, { url: "https://www.hartwell.example/", host: "hartwell.example", path: "/" }, "bare domain base");
  eq([inScope("https://blog.hartwell.example/p", dom), inScope("https://other.example/", dom)], [true, false], "domain scope");
  const gh = siteBase("nathanqiu07.github.io/quarrywick-wealth-demo")!;
  eq(gh.url, "https://nathanqiu07.github.io/quarrywick-wealth-demo/", "path base");
  eq(siteBase("https://nathanqiu07.github.io/quarrywick-wealth-demo/index.html")!.path, "/quarrywick-wealth-demo/", "file trimmed");
  eq([
    inScope("https://nathanqiu07.github.io/quarrywick-wealth-demo/blog/x.html", gh),
    inScope("https://nathanqiu07.github.io/quarrywick-wealth-demo", gh), // normalize() strips the slash
    inScope("https://nathanqiu07.github.io/other-repo/", gh),
    inScope("https://nathanqiu07.github.io/quarrywick-wealth-demo-old/", gh),
    inScope("https://sub.nathanqiu07.github.io/quarrywick-wealth-demo/", gh),
  ], [true, true, false, false, false], "path scope");
  eq(sitemapsFromRobots("User-agent: *\nSitemap: https://h.example/s1.xml\n  sitemap:https://h.example/s2.xml"),
    ["https://h.example/s1.xml", "https://h.example/s2.xml"], "robots sitemaps");
  eq(siteBase("not a url"), null, "bad base");
  eq(dropFolderDuplicates(["https://h.io/repo", "https://h.io/repo/index.html", "https://h.io/repo/blog", "https://h.io/repo/a.html"]),
    ["https://h.io/repo/index.html", "https://h.io/repo/blog", "https://h.io/repo/a.html"], "folder + index.html collapse");
  eq(dropFolderDuplicates(["https://h.example/", "https://h.example/index.html"]), ["https://h.example/index.html"], "root collapse");
  console.log("discover.ts self-check: ok");
}
