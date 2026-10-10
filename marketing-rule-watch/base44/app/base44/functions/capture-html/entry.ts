// {page_id} -> {html_ref}: backfills the "page as captured" HTML for a Page that was scanned without it.
// One Bright Data raw-HTML call, no retry. Admin only (credits). Writes html_ref and nothing else:
// a re-scan would rewrite markdown and could shift the spans of the page's existing flags.
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { fetchRawHtml, stripActiveContent } from "../../shared/page-html.ts";

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") return Response.json({ error: "Capture is admin only" }, { status: 401 });

  const { page_id, force = false } = await req.json().catch(() => ({}));
  if (!page_id) return Response.json({ error: "page_id required" }, { status: 400 });
  const page = await base44.asServiceRole.entities.Page.get(page_id).catch(() => null);
  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });
  if (page.html_ref && !force) return Response.json({ html_ref: page.html_ref, skipped: "already captured" });

  const token = secrets.get("BRIGHTDATA_TOKEN");
  const zone = secrets.get("BRIGHTDATA_ZONE");
  if (!token || !zone) return Response.json({ error: "BRIGHTDATA_TOKEN / BRIGHTDATA_ZONE not set" }, { status: 500 });

  const log: string[] = [];
  const raw = await fetchRawHtml(page.url, token, zone, log);
  if (!raw) return Response.json({ error: "capture_unavailable", log }, { status: 502 });
  const file = new File([stripActiveContent(raw)], `${String(page.sha256 ?? page_id).slice(0, 16)}.html`, { type: "text/html" });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  await base44.asServiceRole.entities.Page.update(page_id, { html_ref: file_url });
  return Response.json({ html_ref: file_url, log });
}
