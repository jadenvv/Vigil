// {name, domain? | site?, include_search?=false} -> {urls:[{url, channel, source, same_site}], base, searches_used, log}.
// Port of crawl/discover.py. Admin only. Writes nothing: /setup shows the list, the human picks, scan fetches.
// `site` is a base URL that may include a path (e.g. a GitHub Pages repo); `domain` is a bare domain.
// With a path, "same site" means same host AND under that path. A `domain` value with a path is treated as a site.
// Site seed is a plain fetch (free). Search spends Bright Data SERP credits: one call per query, no retries.
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { API_URL, guessChannel, MAX_URLS } from "../../shared/brightdata.ts";
import {
  applyCap, dedupe, dropFolderDuplicates, inScope, linksFromHtml, parseSerp, SERP_QUERIES, type SiteBase, siteBase, sitemapsFromRobots,
  urlsFromSitemap,
} from "../../shared/discover.ts";

const SITE_TIMEOUT_MS = 10_000;
const SERP_TIMEOUT_MS = 45_000; // P3 saw SERP take ~50 s once; a 10 s cap would drop most real searches
const UA = "MarketingRuleWatch/0.1 (hackathon compliance demo)";
const MAX_EXTRA_SITEMAPS = 2; // from robots.txt, so a sitemap index can't fan out

async function plainGet(url: string, log: string[]): Promise<{ body: string; finalUrl: string } | null> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(SITE_TIMEOUT_MS) });
    const body = await r.text();
    log.push(`plain_get ${r.status} ${Date.now() - t0}ms ${body.length}B ${url}`);
    return r.status === 200 ? { body, finalUrl: r.url } : null;
  } catch (e) {
    log.push(`plain_get ERR:${(e as Error).name} ${Date.now() - t0}ms ${url}`);
    return null;
  }
}

async function siteSeed(base: SiteBase, log: string[]): Promise<string[]> {
  const out = [base.url];
  const home = await plainGet(base.url, log);
  if (home) out.push(...linksFromHtml(home.body, home.finalUrl));
  const sitemapUrl = new URL("sitemap.xml", base.url).href;
  const sitemap = await plainGet(sitemapUrl, log);
  if (sitemap) out.push(...urlsFromSitemap(sitemap.body));
  const robots = await plainGet(new URL("robots.txt", base.url).href, log);
  const extra = robots ? sitemapsFromRobots(robots.body).filter((u) => u !== sitemapUrl && inScope(u, base)) : [];
  for (const u of extra.slice(0, MAX_EXTRA_SITEMAPS)) {
    const s = await plainGet(u, log);
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

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") return Response.json({ error: "Discover is admin only" }, { status: 401 });

  const { name = "", domain = "", site = "", include_search = false } = await req.json().catch(() => ({}));
  const base = siteBase(String(site || domain));
  if (!base) return Response.json({ error: "site or domain required, e.g. hartwell.example" }, { status: 400 });
  if (include_search && !String(name).trim()) return Response.json({ error: "name required for search" }, { status: 400 });

  const log: string[] = [];
  const seen = new Set<string>();
  const ownSite = dropFolderDuplicates(dedupe(await siteSeed(base, log), seen));
  const off: string[] = [];
  let searchesUsed = 0;

  if (include_search) {
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
