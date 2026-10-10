// {flag_id} -> {quote_present, unchanged, live_sha256, stored_sha256, url, checked_at}
// "Re-check now" (feedback B2): one Bright Data markdown fetch of the flagged page, no screenshot, no retry.
// Admin only, like `scan`: every click spends a credit. Nothing is stored; the capture stays the record.
// Secrets: BRIGHTDATA_TOKEN, BRIGHTDATA_ZONE (same as scan).
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { fetchPage } from "../../shared/brightdata.ts";
import { compareLive } from "../../shared/recheck.ts";

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "admin_only" }, { status: 401 }); // credits are finite
  }
  const { flag_id } = await req.json().catch(() => ({}));
  if (!flag_id) return Response.json({ error: "flag_id required" }, { status: 400 });

  const flag = await base44.asServiceRole.entities.Flag.get(flag_id).catch(() => null);
  if (!flag) return Response.json({ error: "Flag not found" }, { status: 404 });
  const page = await base44.asServiceRole.entities.Page.get(flag.page_id).catch(() => null);
  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });

  const token = secrets.get("BRIGHTDATA_TOKEN");
  const zone = secrets.get("BRIGHTDATA_ZONE");
  if (!token || !zone) return Response.json({ error: "BRIGHTDATA_TOKEN / BRIGHTDATA_ZONE not set" }, { status: 500 });

  try {
    const r = await fetchPage(page.url, { token, zone, screenshot: false });
    console.log(r.log.join("\n"));
    const result = await compareLive(page, flag.span, r.page.markdown);
    return Response.json({ ...result, url: page.url, checked_at: r.page.fetched_at });
  } catch (e) {
    console.log(`recheck ${flag_id}: ${(e as Error).message}`);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
