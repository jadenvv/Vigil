// {name, domain, include_search?=false} -> {urls:[{url, channel, source, same_site}], searches_used, log}.
// Port of crawl/discover.py. Admin only. Writes nothing: /setup shows the list, the human picks, scan fetches.
// Site seed is a plain fetch (free). Search spends Bright Data SERP credits: one call per query, no retries.
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { API_URL, guessChannel, MAX_URLS } from "../../shared/brightdata.ts";
import { applyCap, dedupe, domainHost, linksFromHtml, parseSerp, sameSite, SERP_QUERIES, urlsFromSitemap } from "../../shared/discover.ts";

const SITE_TIMEOUT_MS = 10_000;
const SERP_TIMEOUT_MS = 45_000; // P3 saw SERP take ~50 s once; a 10 s cap would drop most real searches
const UA = "MarketingRuleWatch/0.1 (hackathon compliance demo)";

async function siteSeed(base: string, log: string[]): Promise<string[]> {
  const out = [base];
  for (const [path, extract] of [
    ["/", (body: string, url: string) => linksFromHtml(body, url)],
    ["/sitemap.xml", (body: string) => urlsFromSitemap(body)],
  ] as const) {
    const url = new URL(path, base).href;
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(SITE_TIMEOUT_MS) });
      const body = await r.text();
      log.push(`plain_get ${r.status} ${Date.now() - t0}ms ${body.length}B ${url}`);
      if (r.status === 200) out.push(...extract(body, r.url));
    } catch (e) {
      log.push(`plain_get ERR:${(e as Error).name} ${Date.now() - t0}ms ${url}`);
    }
  }
  return out.filter((u) => sameSite(u, base));
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

  const { name = "", domain = "", include_search = false } = await req.json().catch(() => ({}));
  const host = domainHost(String(domain));
  if (!host || !host.includes(".")) return Response.json({ error: "domain required, e.g. hartwell.example" }, { status: 400 });
  if (include_search && !String(name).trim()) return Response.json({ error: "name required for search" }, { status: 400 });

  const log: string[] = [];
  const seen = new Set<string>();
  const site = dedupe(await siteSeed(`https://${host}/`, log), seen);
  const off: string[] = [];
  let searchesUsed = 0;

  if (include_search) {
    const token = secrets.get("BRIGHTDATA_TOKEN");
    const zone = secrets.get("BRIGHTDATA_SERP_ZONE");
    if (!token || !zone) return Response.json({ error: "BRIGHTDATA_TOKEN / BRIGHTDATA_SERP_ZONE not set" }, { status: 500 });
    for (const q of SERP_QUERIES) { // sequential, one call each
      searchesUsed++;
      for (const n of dedupe(await serp(q.replace("{firm}", String(name).trim()), token, zone, log), seen)) {
        (sameSite(n, host) ? site : off).push(n);
      }
    }
  }

  const capped = applyCap(site, off, MAX_URLS);
  const row = (url: string, source: "site" | "search") =>
    ({ url, channel: guessChannel(url), source, same_site: sameSite(url, host) });
  return Response.json({
    urls: [...capped.site.map((u) => row(u, "site")), ...capped.off.map((u) => row(u, "search"))],
    searches_used: searchesUsed,
    log,
  });
}
