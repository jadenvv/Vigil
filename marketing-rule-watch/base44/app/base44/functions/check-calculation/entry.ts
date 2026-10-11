// "Check the calculation" — recompute the arithmetic behind a stated return claim in a Daytona
// Python sandbox and report match/mismatch. ARITHMETIC ONLY: a match says the math is consistent
// with the inputs, never that the performance was real or the claim compliant. Admin only.
//
// POST {check_type: "cumulative"|"compounded", inputs: {...}, stated_pct, assumption_confirmed?}
//   (flag_id optional — logged only, so a check can be attributed in the function log)
// 200 {ok:true, stated_pct, calculated_pct, difference_pp, match, formula, explanation,
//      tolerance_pp, checked_at, cached?}
// 400 {error:"invalid_input", missing, details} — validated before any sandbox is created
// 401 non-admin | 429 {error:"cooldown", retry_after}
// 502 {error:"calc_check_failed"} — sandbox ran but the run failed (timeout, nonzero exit, bad output)
// 503 {error:"calc_service_unavailable"} — no DAYTONA_API_KEY / sandbox could not be created
//
// Spending guard (isolate-scoped, best-effort on top of admin-only — there is no shared rate
// limiter between isolates): a 10-minute in-memory result cache keyed by the canonical JSON of
// (check_type, inputs, stated_pct); an identical repeat is served with cached: true and no sandbox.
// Plus a ~5s cooldown between sandbox launches in this isolate; within it, new (uncached) checks
// get 429. No retries, one sandbox per check, always destroyed.
//
// Secret: DAYTONA_API_KEY (npx base44 secrets set --env-file ../../.env). The shared module and the
// Daytona SDK are lazy-imported AFTER the admin check, so an unauthorized call loads neither.
import { createClientFromRequest } from "npm:@base44/sdk";

const CACHE_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 5_000;

// deno-lint-ignore no-explicit-any
type CacheEntry = { at: number; result: any };
const cache = new Map<string, CacheEntry>(); // dies with the isolate — see header
let lastLaunch = 0;

/** Stable key: same inputs in any key order are the same check. */
function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Check-calculation is admin only" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { check_type, inputs, stated_pct, flag_id } = body ?? {};

  // Lazy: nothing below this line loads until the caller is authorized.
  const { validateCheck, runCheck, DaytonaUnavailable, CalcRunFailed } = await import("../../shared/calc-check.ts");

  const v = validateCheck(body);
  if (!v.ok) {
    return Response.json({ error: "invalid_input", missing: v.missing, details: v.errors }, { status: 400 });
  }

  const key = canonical({ check_type, inputs, stated_pct });
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    console.log(`check-calculation ${flag_id ?? ""}: cache hit`);
    return Response.json({ ...hit.result, cached: true });
  }

  const wait = COOLDOWN_MS - (now - lastLaunch);
  if (lastLaunch !== 0 && wait > 0) {
    return Response.json(
      { error: "cooldown", retry_after: Math.ceil(wait / 1000) },
      { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } },
    );
  }
  lastLaunch = now; // one launch at a time; a failed run still holds the window

  try {
    const result = await runCheck(body);
    cache.set(key, { at: now, result });
    console.log(`check-calculation ${flag_id ?? ""}: ${check_type} match=${result.match} calc=${result.calculated_pct} stated=${result.stated_pct}`);
    return Response.json(result);
  } catch (e) {
    console.log(`check-calculation ${flag_id ?? ""}: ${(e as Error).message}`);
    if ((e as { missing?: string[] }).missing) { // validation inside runCheck (defense)
      const d = e as { missing: string[]; details?: string[] };
      return Response.json({ error: "invalid_input", missing: d.missing, details: d.details ?? [] }, { status: 400 });
    }
    if (e instanceof DaytonaUnavailable) {
      return Response.json({ error: "calc_service_unavailable" }, { status: 503 });
    }
    if (e instanceof CalcRunFailed || e instanceof Error) {
      return Response.json({ error: "calc_check_failed" }, { status: 502 });
    }
    return Response.json({ error: "calc_check_failed" }, { status: 502 });
  }
}
