// Port of engine/rewrite.py (LLM path only). The model proposes span-level {find, replace} edits;
// this code applies them, so nothing outside the edited spans can change.
import { ground, splitPrompt } from "./detect_core.js";
import { REWRITE_PROMPT, REWRITE_SCHEMA } from "./prompts.ts";
import { callLLM } from "./llm.ts";
import { detectText, type Flag } from "./detect-core.ts";

const PLACEHOLDER = /\[[A-Z][A-Z0-9 /_,.'-]*\]/g;

interface Edit {
  flag?: number;
  find: string;
  replace: string;
}

/** An applied edit, with its range in the ORIGINAL text and its replacement's range in the NEW text. */
interface Applied {
  start: number;
  end: number;
  newStart: number;
  newEnd: number;
  find: string;
  replace: string;
}

function buildMessages(text: string, flags: Flag[]) {
  const { system, user } = splitPrompt(REWRITE_PROMPT);
  const listing = flags.map((f, k) => `${k}: ${f.category} | "${f.span}" | ${f.why ?? ""}`).join("\n");
  const page = text.split("</page_content>").join("</page_content_>"); // page can't close our delimiter
  return {
    system,
    user: user.replace("{{flags}}", () => listing).replace("{{page}}", () => page),
  };
}

export function parseEdits(raw: unknown): Edit[] {
  // deno-lint-ignore no-explicit-any
  let data: any = raw;
  if (typeof raw === "string") {
    const s = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    try {
      data = JSON.parse(s);
    } catch {
      const m = s.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("LLM did not return JSON edits");
      data = JSON.parse(m[0]);
    }
  }
  const edits = Array.isArray(data) ? data : data?.edits;
  if (!Array.isArray(edits)) throw new Error("LLM JSON has no edits array");
  return edits
    .filter((e) => e && typeof e === "object" && typeof e.find === "string")
    .map((e) => ({ flag: e.flag, find: e.find, replace: String(e.replace ?? "") }));
}

/** apply_edits() from rewrite.py: ground each `find`, drop overlaps, apply left to right. */
export function applyEdits(text: string, edits: Edit[]): { text: string; applied: Applied[] } {
  const located = [];
  for (const e of edits) {
    const find = ground(text, e.find);
    if (find === null) continue;
    const start = text.indexOf(find);
    located.push({ start, end: start + find.length, find, replace: e.replace });
  }
  located.sort((a, b) => a.start - b.start);
  const applied: Applied[] = [];
  let out = "";
  let cursor = 0;
  for (const l of located) {
    if (l.start < cursor) continue; // overlaps an earlier edit
    out += text.slice(cursor, l.start);
    applied.push({ ...l, newStart: out.length, newEnd: out.length + l.replace.length });
    out += l.replace;
    cursor = l.end;
  }
  return { text: out + text.slice(cursor), applied };
}

export interface RewriteResult {
  original_text: string;
  suggested_text: string;
  suggested_page: string;
  flags_total: number;
  flags_cleared: number;
  placeholders: string[];
}

/**
 * Rewrites the passage behind one flag. Throws if the LLM fails or proposes no usable edit:
 * the caller reports an error rather than showing a fake rewrite.
 */
// deno-lint-ignore no-explicit-any
export async function rewriteFlag(base44: any, page: string, flag: Flag, channel = ""): Promise<RewriteResult> {
  const { system, user } = buildMessages(page, [flag]);
  const edits = parseEdits(await callLLM(base44, system, user, REWRITE_SCHEMA)); // one call, no retry
  const { text: newPage, applied } = applyEdits(page, edits);
  if (!applied.length) throw new Error("no edit matched the page text");

  // "Cleared" = re-detection finds no flag of this category inside the rewritten passage.
  const again = await detectText(base44, newPage, channel);
  const stillFlagged = again.some((f) => {
    if (f.category !== flag.category) return false;
    const i = newPage.indexOf(f.span);
    return applied.some((a) => i < a.newEnd && i + f.span.length > a.newStart);
  });

  const suggested = applied.map((a) => a.replace).join("\n\n");
  return {
    original_text: applied.map((a) => a.find).join("\n\n"),
    suggested_text: suggested,
    suggested_page: newPage,
    flags_total: 1,
    flags_cleared: stillFlagged ? 0 : 1,
    placeholders: [...new Set(suggested.match(PLACEHOLDER) ?? [])],
  };
}
