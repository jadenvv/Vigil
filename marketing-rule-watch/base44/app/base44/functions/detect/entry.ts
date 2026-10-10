// {page_id} -> runs detection on the stored Page and replaces its Flag rows. Admin only.
import { createClientFromRequest } from "npm:@base44/sdk";
import { detectText, MAX_TEXT } from "../../shared/detect-core.ts";

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Detect is admin only" }, { status: 401 });
  }

  const { page_id } = await req.json().catch(() => ({}));
  if (!page_id) return Response.json({ error: "page_id required" }, { status: 400 });

  const page = await base44.asServiceRole.entities.Page.get(page_id).catch(() => null);
  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });
  const markdown = String(page.markdown ?? "");
  if (markdown.length > MAX_TEXT) return Response.json({ error: `page over ${MAX_TEXT} chars` }, { status: 400 });

  const { flags, mode, provider, model } = await detectText(base44, markdown, page.channel ?? "");
  console.log(`detect page ${page_id}: mode=${mode} provider=${provider} model=${model} flags=${flags.length}`);
  // A failed LLM call must not wipe the page's existing flags and leave it looking clean.
  if (mode === "llm_unavailable") return Response.json({ error: "llm_unavailable", mode }, { status: 503 });
  if (mode === "llm_error") return Response.json({ error: "LLM call failed; flags unchanged", mode }, { status: 502 });

  const old = await base44.asServiceRole.entities.Flag.filter({ page_id });
  for (const f of old) await base44.asServiceRole.entities.Flag.delete(f.id);
  if (flags.length) {
    await base44.asServiceRole.entities.Flag.bulkCreate(flags.map((f) => ({ ...f, page_id, status: "open" })));
  }
  return Response.json({ created: flags.length, replaced: old.length, mode, provider, model });
}
