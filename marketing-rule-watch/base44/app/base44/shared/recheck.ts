// "Re-check now" (feedback B2): fetch a flagged page again and say whether the flagged quote is still
// there and whether the stored text changed since capture. Pure logic here; the fetch is in
// functions/recheck, along with who may run it and the credit-cap window. Self-check: deno run base44/shared/recheck.ts
// Live text is untrusted scraped data: it is only hashed and searched, never interpreted.
import { sha256Hex } from "./brightdata.ts";
import { capText, cleanMarkdown } from "./page-text.ts";

export interface RecheckResult {
  quote_present: boolean; // flagged quote found in today's page text (whitespace-insensitive)
  unchanged: boolean; // today's stored-form text hashes the same as the capture
  live_sha256: string;
  stored_sha256: string;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** `liveMarkdown` is raw Bright Data markdown; it goes through the same clean + cap as `scan` before hashing. */
export async function compareLive(stored: { sha256?: string }, span: string, liveMarkdown: string): Promise<RecheckResult> {
  const cleaned = cleanMarkdown(liveMarkdown);
  const live_sha256 = await sha256Hex(capText(cleaned));
  const stored_sha256 = stored.sha256 ?? "";
  return {
    quote_present: Boolean(squash(span)) && squash(cleaned).includes(squash(span)),
    unchanged: Boolean(stored_sha256) && stored_sha256 === live_sha256,
    live_sha256,
    stored_sha256,
  };
}

/** Credit cap: one live fetch per page per window. A newer check than this is served from the Recheck table. */
export const RECHECK_TTL_MS = 10 * 60 * 1000;

/** True when `checkedAt` (ISO-8601) is less than `ttlMs` old. Unparseable or future-dated times are never fresh. */
export function isFresh(checkedAt: string | undefined | null, nowMs: number, ttlMs = RECHECK_TTL_MS): boolean {
  const t = Date.parse(String(checkedAt ?? ""));
  if (!Number.isFinite(t)) return false;
  const age = nowMs - t;
  return age >= 0 && age < ttlMs;
}

type Caller = { id?: string; email?: string; role?: string } | null | undefined;
type FirmLike = { is_demo?: unknown; created_by?: string | null; created_by_id?: string | null } | null | undefined;

/**
 * Who may spend a re-check: an admin; anyone (signed out included) on the demo firm; or the signed-in
 * user who created the firm (Base44's built-in created_by_id / created_by email on the Firm row).
 */
export function canRecheck(user: Caller, firm: FirmLike): boolean {
  if (user?.role === "admin") return true;
  if (firm?.is_demo === true) return true;
  if (!user || !firm) return false;
  if (user.id && firm.created_by_id && user.id === firm.created_by_id) return true;
  const email = (user.email ?? "").trim().toLowerCase();
  return Boolean(email) && email === String(firm.created_by ?? "").trim().toLowerCase();
}

if (import.meta.main) {
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
  const now = Date.parse("2026-10-10T18:00:00Z");
  eq(isFresh("2026-10-10T17:51:00+00:00", now), true, "9 min old is fresh");
  eq(isFresh("2026-10-10T17:50:00+00:00", now), false, "10 min old is stale");
  eq(isFresh("2026-10-10T18:05:00Z", now), false, "future-dated is never fresh");
  eq(isFresh("", now) || isFresh(undefined, now) || isFresh("nonsense", now), false, "unparseable is never fresh");
  const firm = { is_demo: false, created_by: "Owner@Firm.com", created_by_id: "u1" };
  eq(canRecheck({ role: "admin" }, firm), true, "admin");
  eq(canRecheck(null, { is_demo: true }), true, "signed out on the demo firm");
  eq(canRecheck(null, { is_demo: "true" }), false, "is_demo must be boolean true");
  eq(canRecheck(null, firm), false, "signed out on a real firm");
  eq(canRecheck({ id: "u1", role: "user" }, firm), true, "owner by id");
  eq(canRecheck({ id: "u2", email: "owner@firm.com", role: "user" }, firm), true, "owner by email, case-insensitive");
  eq(canRecheck({ id: "u2", email: "other@firm.com", role: "user" }, firm), false, "someone else");
  eq(canRecheck({ id: "u2", email: "", role: "user" }, { is_demo: false, created_by: "" }), false, "empty email never matches");
  eq(canRecheck({ role: "user" }, null), false, "no firm");
  const page = "* [Home](/)\n\nOur clients have never lost money.\n\nInvesting involves risk.";
  const stored = { sha256: await sha256Hex(capText(cleanMarkdown(page))) };
  const same = await compareLive(stored, "never lost money", page);
  eq([same.quote_present, same.unchanged], [true, true], "same page");
  const wrapped = await compareLive(stored, "never lost\nmoney", page + "\n\nNew footer line.");
  eq([wrapped.quote_present, wrapped.unchanged], [true, false], "quote across a line break still found; text changed");
  const fixed = await compareLive(stored, "never lost money", page.replace("have never lost money", "aim to limit losses"));
  eq([fixed.quote_present, fixed.unchanged], [false, false], "quote removed");
  eq((await compareLive({}, "", page)).quote_present, false, "empty span never matches");
  eq((await compareLive({}, "x", page)).unchanged, false, "no stored hash is never 'unchanged'");
  console.log("recheck.ts self-check: ok");
}
