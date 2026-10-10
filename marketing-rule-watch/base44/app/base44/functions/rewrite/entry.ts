// {flag_id} -> {original_text, suggested_text, suggested_page, flags_cleared, flags_total, placeholders}.
// Anonymous on the demo firm (testers use the drawer), admin only elsewhere. Writes nothing:
// the drawer records the human's choice as a Decision.
import { createClientFromRequest } from "npm:@base44/sdk";
import { LLMUnavailable } from "../../shared/llm.ts";
import { rewriteFlag } from "../../shared/rewrite-core.ts";

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const { flag_id } = await req.json().catch(() => ({}));
  if (!flag_id) return Response.json({ error: "flag_id required" }, { status: 400 });

  const flag = await base44.asServiceRole.entities.Flag.get(flag_id).catch(() => null);
  if (!flag) return Response.json({ error: "Flag not found" }, { status: 404 });
  const page = await base44.asServiceRole.entities.Page.get(flag.page_id).catch(() => null);
  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });
  const firm = await base44.asServiceRole.entities.Firm.get(page.firm_id).catch(() => null);

  if (!firm?.is_demo) {
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Rewrite is admin only outside the demo firm" }, { status: 401 });
    }
  }
  try {
    const result = await rewriteFlag(base44, String(page.markdown ?? ""), flag, page.channel ?? "");
    return Response.json(result);
  } catch (e) {
    // 503 = the model never ran (quota/plan): the drawer switches to manual edit mode.
    if (e instanceof LLMUnavailable) return Response.json({ error: "llm_unavailable" }, { status: 503 });
    console.log(`rewrite failed for flag ${flag_id}: ${(e as Error).message}`);
    return Response.json({ error: "No suggestion this time. Edit the text by hand." }, { status: 502 });
  }
}
