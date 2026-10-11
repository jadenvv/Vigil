// {name, domain? | site?, include_search?=false} -> {urls:[{url, channel, source, same_site}], base, searches_used, log}.
// Port of crawl/discover.py. Writes nothing: /setup shows the list, the human picks, scan fetches.
// Who: any signed-in user for the site seed (free plain GETs, max 3, SSRF-guarded by shared/net-guard.ts);
// signed out, only the demo firm's own site (judges on the home page); include_search (SERP credits) is admin only.
// `site` is a base URL that may include a path (e.g. a GitHub Pages repo); `domain` is a bare domain.
// With a path, "same site" means same host AND under that path. A `domain` value with a path is treated as a site.
// Site seed is a plain fetch (free). Search spends Bright Data SERP credits: one call per query, no retries.
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { API_URL, guessChannel, MAX_URLS } from "../../shared/brightdata.ts";
import { unsafeUrl } from "../../shared/net-guard.ts";
import {
  applyCap, dedupe, dropFolderDuplicates, inScope, linksFromHtml, parseSerp, SERP_QUERIES, type SiteBase, siteBase, sitemapsFromRobots,
  urlsFromSitemap,
} from "../../shared/discover.ts";

const SITE_TIMEOUT_MS = 10_000;
const SERP_TIMEOUT_MS = 45_000; // P3 saw SERP take ~50 s once; a 10 s cap would drop most real searches
const UA = "MarketingRuleWatch/0.1 (hackathon compliance demo)";
const MAX_EXTRA_SITEMAPS = 2; // from robots.txt, so a sitemap index can't fan out

const MAX_BODY_CHARS = 2_000_000;
const MAX_GETS_NON_ADMIN = 3; // home, sitemap.xml, robots.txt; a followed redirect counts as a GET

interface Budget { left: number }

/** Reads at most ~maxChars of the body, then cancels the stream, so a huge response can't fill memory. */
async function readCapped(r: Response, maxChars: number): Promise<string> {
  if (!r.body) return "";
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (out.length < maxChars) {
    const { done, value } = await reader.read();
    if (done) return out + decoder.decode();
    out += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  return out.slice(0, maxChars);
}

/** Guarded GET: every hop is checked (scheme, port, resolved address) and redirects are followed by hand, once. */
async function plainGet(url: string, log: string[], budget: Budget): Promise<{ body: string; finalUrl: string } | null> {
  let target = url;
  for (let hop = 0; hop < 2; hop++) {
    if (budget.left <= 0) {
      log.push(`plain_get SKIP:budget ${target}`);
      return null;
    }
    const unsafe = await unsafeUrl(target);
    if (unsafe) {
      log.push(`plain_get ERR:blocked(${unsafe}) 0ms ${target}`);
      return null;
    }
    budget.left--;
    const t0 = Date.now();
    try {
      const r = await fetch(target, {
        headers: { "User-Agent": UA },
        redirect: "manual",
        signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
      });
      const location = r.headers.get("location");
      if (r.status >= 300 && r.status < 400 && location) {
        await r.body?.cancel();
        log.push(`plain_get ${r.status} ${Date.now() - t0}ms redirect ${target}`);
        target = new URL(location, target).href;
        continue;
      }
      const body = await readCapped(r, MAX_BODY_CHARS);
      log.push(`plain_get ${r.status} ${Date.now() - t0}ms ${body.length}B ${target}`);
      return r.status === 200 ? { body, finalUrl: target } : null;
    } catch (e) {
      log.push(`plain_get ERR:${(e as Error).name} ${Date.now() - t0}ms ${target}`);
      return null;
    }
  }
  log.push(`plain_get ERR:too_many_redirects 0ms ${url}`);
  return null;
}

async function siteSeed(base: SiteBase, log: string[], budget: Budget): Promise<string[]> {
  const out = [base.url];
  const home = await plainGet(base.url, log, budget);
  if (home) out.push(...linksFromHtml(home.body, home.finalUrl));
  const sitemapUrl = new URL("sitemap.xml", base.url).href;
  const sitemap = await plainGet(sitemapUrl, log, budget);
  if (sitemap) out.push(...urlsFromSitemap(sitemap.body));
  const robots = await plainGet(new URL("robots.txt", base.url).href, log, budget);
  const extra = robots ? sitemapsFromRobots(robots.body).filter((u) => u !== sitemapUrl && inScope(u, base)) : [];
  for (const u of extra.slice(0, MAX_EXTRA_SITEMAPS)) {
    const s = await plainGet(u, log, budget);
    if (s) out.push(...urlsFromSitemap(s.body));
  }
  return out.filter((u) => inScope(u, base));
}

async function serp(query: string, token: string, zone: string, log: string[]): Promise<string[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en&brd_json=1`;
  const t0 = Date.now();
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone, url, format: "raw" }),
      signal: AbortSignal.timeout(SERP_TIMEOUT_MS),
    });
    const body = await r.text();
    log.push(`serp ${r.status} ${Date.now() - t0}ms ${body.length}B ${query}`);
    if (r.status !== 200 || !body.trim()) return []; // P3 saw 200 with an empty body; not retried
    return parseSerp(body);
  } catch (e) {
    log.push(`serp ERR:${(e as Error).name} ${Date.now() - t0}ms ${query}`);
    return [];
  }
}

const siteKey = (b: SiteBase) => `${b.host}${b.path.replace(/\/$/, "")}`;

/** True when `base` is exactly the site of a Firm marked is_demo (same normalized host + path). */
// deno-lint-ignore no-explicit-any
async function isDemoSite(base44: any, base: SiteBase): Promise<boolean> {
  const demos = await base44.asServiceRole.entities.Firm.filter({ is_demo: true }).catch(() => []);
  // deno-lint-ignore no-explicit-any
  return demos.some((f: any) => {
    const b = siteBase(String(f.domain ?? ""));
    return b !== null && siteKey(b) === siteKey(base);
  });
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  const isAdmin = user?.role === "admin";

  const { name = "", domain = "", site = "", include_search = false } = await req.json().catch(() => ({}));
  const base = siteBase(String(site || domain));
  if (!base) return Response.json({ error: "site or domain required, e.g. hartwell.example" }, { status: 400 });
  // Signed out: only the demo firm's own site (exact host + path key), site seed only, never search.
  if (!user && !(await isDemoSite(base44, base))) return Response.json({ error: "Sign in to find pages" }, { status: 401 });
  const search = Boolean(include_search) && user !== null; // forced off when signed out
  if (search && !isAdmin) return Response.json({ error: "Search is admin only" }, { status: 403 });
  if (search && !String(name).trim()) return Response.json({ error: "name required for search" }, { status: 400 });

  const log: string[] = [];
  const seen = new Set<string>();
  const ownSite = dropFolderDuplicates(dedupe(await siteSeed(base, log, { left: isAdmin ? Infinity : MAX_GETS_NON_ADMIN }), seen));
  const off: string[] = [];
  let searchesUsed = 0;

  if (search) {
    const token = secrets.get("BRIGHTDATA_TOKEN");
    const zone = secrets.get("BRIGHTDATA_SERP_ZONE");
    if (!token || !zone) return Response.json({ error: "BRIGHTDATA_TOKEN / BRIGHTDATA_SERP_ZONE not set" }, { status: 500 });
    for (const q of SERP_QUERIES) { // sequential, one call each
      searchesUsed++;
      for (const n of dedupe(await serp(q.replace("{firm}", String(name).trim()), token, zone, log), seen)) {
        (inScope(n, base) ? ownSite : off).push(n);
      }
    }
  }

  const capped = applyCap(ownSite, off, MAX_URLS);
  const row = (url: string, source: "site" | "search") =>
    ({ url, channel: guessChannel(url), source, same_site: inScope(url, base) });
  return Response.json({
    urls: [...capped.site.map((u) => row(u, "site")), ...capped.off.map((u) => row(u, "search"))],
    base: base.url,
    searches_used: searchesUsed,
    log,
  });
}
