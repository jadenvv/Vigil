// {flag_id} -> {original_text, suggested_text, suggested_page, flags_cleared, flags_total, placeholders}.
// Anonymous on the demo firm (testers use the drawer), admin only elsewhere. Writes nothing:
// the drawer records the human's choice as a Decision.
//
// Spending guard (isolate-scoped, best-effort on top of the auth rule — isolates share no rate
// limiter): a 10-minute in-memory result cache keyed by flag_id; an identical repeat is served
// with cached: true and no LLM calls (each uncached run is 2). Plus a ~5s cooldown between
// uncached calls in this isolate; inside it a call gets 429 {error:"cooldown", retry_after}.
import { createClientFromRequest } from "npm:@base44/sdk";
import { LLMUnavailable } from "../../shared/llm.ts";
import { rewriteFlag } from "../../shared/rewrite-core.ts";

const CACHE_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 5_000;

// deno-lint-ignore no-explicit-any
type CacheEntry = { at: number; result: any };
const cache = new Map<string, CacheEntry>(); // dies with the isolate — see header
let lastCall = 0;

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

  const now = Date.now();
  const hit = cache.get(flag_id);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    console.log(`rewrite ${flag_id}: cache hit`);
    return Response.json({ ...hit.result, cached: true });
  }
  const wait = COOLDOWN_MS - (now - lastCall);
  if (lastCall !== 0 && wait > 0) {
    return Response.json(
      { error: "cooldown", retry_after: Math.ceil(wait / 1000) },
      { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } },
    );
  }
  lastCall = now; // one LLM run at a time; a failed run still holds the window

  try {
    const result = await rewriteFlag(base44, String(page.markdown ?? ""), flag, page.channel ?? "");
    cache.set(flag_id, { at: now, result });
    return Response.json(result);
  } catch (e) {
    // 503 = the model never ran (quota/plan): the drawer switches to manual edit mode.
    if (e instanceof LLMUnavailable) return Response.json({ error: "llm_unavailable" }, { status: 503 });
    console.log(`rewrite failed for flag ${flag_id}: ${(e as Error).message}`);
    return Response.json({ error: "No suggestion this time. Edit the text by hand." }, { status: 502 });
  }
}
