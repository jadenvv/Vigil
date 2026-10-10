// {page_id} -> {html, url, fetched_at}: the page as captured at scan time, for the in-place highlight view.
// Served from the app's own origin so the client can read the DOM. Anonymous only for demo-firm pages,
// admin otherwise. The stored HTML already had scripts stripped at scan time; we strip again here
// (in case the capture predates that), add <base href> for the site's CSS, and the client sanitizes too.
import { createClientFromRequest } from "npm:@base44/sdk";
import { MAX_HTML_BYTES, stripActiveContent, withBase } from "../../shared/page-html.ts";

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const { page_id } = await req.json().catch(() => ({}));
  if (!page_id) return Response.json({ error: "page_id required" }, { status: 400 });

  const page = await base44.asServiceRole.entities.Page.get(page_id).catch(() => null);
  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });
  const firm = await base44.asServiceRole.entities.Firm.get(page.firm_id).catch(() => null);
  if (!firm?.is_demo) {
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Page capture is admin only outside the demo firm" }, { status: 401 });
    }
  }
  if (!page.html_ref) return Response.json({ error: "no_capture" }, { status: 404 });

  try {
    const r = await fetch(page.html_ref, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`capture fetch HTTP ${r.status}`);
    const declared = Number(r.headers.get("content-length") ?? 0);
    if (declared > MAX_HTML_BYTES) return Response.json({ error: "capture_too_large" }, { status: 413 });
    const html = await r.text();
    if (html.length > MAX_HTML_BYTES) return Response.json({ error: "capture_too_large" }, { status: 413 });
    return Response.json({ html: withBase(stripActiveContent(html), page.url), url: page.url, fetched_at: page.fetched_at });
  } catch (e) {
    console.log(`page-html ${page_id}: ${(e as Error).message}`);
    return Response.json({ error: "capture_unavailable" }, { status: 502 });
  }
}
