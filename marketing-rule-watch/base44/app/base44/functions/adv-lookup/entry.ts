// {firm_id} -> {candidates: [{url, crd, pdf_url}], searches_used, demo?, log}.
// Finds the firm's Form ADV on the SEC's adviser site with one Bright Data SERP call. Writes nothing.
// Who: admin only (SERP credits). The demo firm is fictional and has no Form ADV, so it returns
// no candidates without searching. One call, no retries. Candidates are unconfirmed matches.
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { API_URL } from "../../shared/brightdata.ts";
import { parseSerp } from "../../shared/discover.ts";
import { ADV_QUERY, advCandidates } from "../../shared/adv.ts";

const SERP_TIMEOUT_MS = 45_000; // same cap as discover: SERP has taken ~50 s

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

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
    if (r.status !== 200 || !body.trim()) return []; // not retried
    return parseSerp(body);
  } catch (e) {
    log.push(`serp ERR:${(e as Error).name} ${Date.now() - t0}ms ${query}`);
    return [];
  }
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const firmId = typeof body?.firm_id === "string" ? body.firm_id : "";
  if (!firmId) return json({ error: "firm_id required" }, 400);

  const firm = await base44.asServiceRole.entities.Firm.get(firmId).catch(() => null);
  if (!firm) return json({ error: "not_found" }, 404);
  if (firm.is_demo) return json({ candidates: [], searches_used: 0, demo: true, log: [] });

  const user = await base44.auth.me().catch(() => null);
  if (!user) return json({ error: "sign_in_required" }, 401);
  if (user.role !== "admin") return json({ error: "admin_only" }, 403);

  const token = secrets.get("BRIGHTDATA_TOKEN");
  const zone = secrets.get("BRIGHTDATA_SERP_ZONE");
  if (!token || !zone) return json({ error: "search_not_configured" }, 503);

  const log: string[] = [];
  const urls = await serp(ADV_QUERY(String(firm.name ?? "")), token, zone, log);
  return json({ candidates: advCandidates(urls), searches_used: 1, log });
}
