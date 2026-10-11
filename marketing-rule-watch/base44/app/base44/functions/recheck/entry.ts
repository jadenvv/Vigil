// {flag_id} -> {quote_present, unchanged, live_sha256, stored_sha256, url, checked_at, cached}
// "Re-check now" (feedback B2): one Bright Data markdown fetch of the STORED Page.url, no screenshot, no retry.
// Never fetches a URL from the request body.
// Who: admin, anyone on the demo firm (signed out included), or the signed-in user who created the firm.
// Credit cap: at most one live fetch per page per 10 minutes. Each fetch writes one Recheck row per flag on
// the page (shared hashes, per-flag quote_present); a fresh row is returned with cached: true and no fetch.
// The Recheck rows double as the audit trail of when a page was re-verified. The capture stays the record.
// Secrets: BRIGHTDATA_TOKEN, BRIGHTDATA_ZONE (same as scan).
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { fetchPage } from "../../shared/brightdata.ts";
import { canRecheck, compareLive, isFresh } from "../../shared/recheck.ts";

const MAX_ROWS_PER_CHECK = 100; // flags on one page; keeps the audit write bounded

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function toResponse(row: Row, url: string, cached: boolean): Response {
  if (row.error) {
    return Response.json({ error: "fetch_failed", url, checked_at: row.checked_at, cached }, { status: 502 });
  }
  return Response.json({
    quote_present: Boolean(row.quote_present),
    unchanged: Boolean(row.unchanged),
    live_sha256: row.live_sha256 ?? "",
    stored_sha256: row.stored_sha256 ?? "",
    url,
    checked_at: row.checked_at,
    cached,
  });
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const { flag_id } = await req.json().catch(() => ({}));
  if (!flag_id) return Response.json({ error: "flag_id required" }, { status: 400 });

  const db = base44.asServiceRole.entities;
  const flag = await db.Flag.get(flag_id).catch(() => null);
  if (!flag) return Response.json({ error: "Flag not found" }, { status: 404 });
  const page = await db.Page.get(flag.page_id).catch(() => null);
  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });
  const firm = await db.Firm.get(page.firm_id).catch(() => null);

  // Signed-out callers get null here; that is fine on the demo firm.
  const user = await base44.auth.me().catch(() => null);
  if (!canRecheck(user, firm)) {
    return Response.json(
      { error: "Re-check is open to admins, the firm's owner, and anyone on the demo firm." },
      { status: 403 },
    );
  }

  // Fail closed: if the cache can't be read (e.g. the Recheck entity isn't pushed), spend nothing.
  const now = Date.now();
  try {
    const [latest] = await db.Recheck.filter({ page_id: page.id }, "-checked_at", 1);
    if (latest && isFresh(latest.checked_at, now)) {
      const [mine] = latest.flag_id === flag.id
        ? [latest]
        : await db.Recheck.filter({ page_id: page.id, flag_id: flag.id }, "-checked_at", 1);
      if (mine && isFresh(mine.checked_at, now)) return toResponse(mine, page.url, true);
      // No fresh row for this flag means it was created after the last check (an admin re-ran detect).
      // Fall through to one fetch; it writes rows for every current flag, so this cannot repeat in the window.
    }
  } catch (e) {
    console.log(`recheck ${flag_id}: Recheck lookup failed: ${(e as Error).message}`);
    return Response.json({ error: "recheck_unavailable" }, { status: 503 });
  }

  const token = secrets.get("BRIGHTDATA_TOKEN");
  const zone = secrets.get("BRIGHTDATA_ZONE");
  if (!token || !zone) return Response.json({ error: "BRIGHTDATA_TOKEN / BRIGHTDATA_ZONE not set" }, { status: 500 });

  const pageFlags: Row[] = await db.Flag.filter({ page_id: page.id }).catch(() => []);
  const flags = [flag, ...pageFlags.filter((f) => f.id !== flag.id)].slice(0, MAX_ROWS_PER_CHECK);

  let rows: Row[];
  try {
    const r = await fetchPage(page.url, { token, zone, screenshot: false });
    console.log(r.log.join("\n"));
    rows = await Promise.all(flags.map(async (f) => ({
      flag_id: f.id,
      page_id: page.id,
      checked_at: r.page.fetched_at,
      ...(await compareLive(page, String(f.span ?? ""), r.page.markdown)),
      error: "",
    })));
  } catch (e) {
    const full = (e as Error).message;
    console.log(`recheck ${flag_id}: ${full}`);
    const message = full.slice(0, 160); // the row is publicly readable; keep it short
    // Stored too: a failed fetch may still cost a credit, so it also holds the window.
    const checked_at = new Date().toISOString();
    rows = flags.map((f) => ({ flag_id: f.id, page_id: page.id, checked_at, error: message }));
  }

  // Fail closed like the read path above: if the audit rows can't be written, the 10-minute
  // credit cap can't hold for the next caller — report failure rather than silently returning.
  const wrote = await db.Recheck.bulkCreate(rows).then(() => true).catch((e: Error) => {
    console.log(`recheck ${flag_id}: Recheck write failed: ${e.message}`);
    return false;
  });
  if (!wrote) return Response.json({ error: "recheck_unavailable" }, { status: 503 });
  return toResponse(rows[0], page.url, false);
}
