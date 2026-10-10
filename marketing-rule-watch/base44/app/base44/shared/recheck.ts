// "Re-check now" (feedback B2): fetch a flagged page again and say whether the flagged quote is still
// there and whether the stored text changed since capture. Pure logic here; the fetch is in
// functions/recheck. Self-check: deno run base44/shared/recheck.ts
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

if (import.meta.main) {
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
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
