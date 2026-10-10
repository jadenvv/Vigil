// Detection pipeline shared by `detect` and `detect-text`. Logic lives in P4's detect_core.js
// (do not edit it here); this file only wires the prompt, the LLM call and page-level grounding.
import { buildMessages, chunks, parseFlags, postprocess, ruleCandidates } from "./detect_core.js";
import { DETECT_PROMPT, DETECT_SCHEMA } from "./prompts.ts";
import { callLLM } from "./llm.ts";

// "rules" = P4's keyword fallback: free, deterministic, NOT AI. Don't call it AI in UI or pitch.
// "llm"   = DETECT_PROMPT through callLLM. Switch once ANTHROPIC_API_KEY is set.
export const MODE: "llm" | "rules" = "rules";
export const MIN_CONF = 0.5; // from P4's eval
export const MAX_TEXT = 200_000; // guard for a single page

export interface Flag {
  category: string;
  span: string;
  rule: string;
  confidence: number;
  why: string;
}

// deno-lint-ignore no-explicit-any
export async function detectText(base44: any, text: string, channel = "", mode = MODE): Promise<Flag[]> {
  const flags: Flag[] = [];
  for (const chunk of chunks(text, 6000)) {
    // deno-lint-ignore no-explicit-any
    let cands: any[] = [];
    if (mode === "rules") {
      cands = ruleCandidates(chunk);
    } else {
      const { system, user } = buildMessages(DETECT_PROMPT, chunk, channel);
      try {
        cands = parseFlags(await callLLM(base44, system, user, DETECT_SCHEMA)); // one call, no retry
      } catch (e) {
        console.log(`detect: chunk dropped (${(e as Error).message})`); // malformed or failed -> zero flags
        cands = [];
      }
    }
    flags.push(...postprocess(chunk, cands, MIN_CONF));
  }
  return flags.filter((f) => text.includes(f.span)); // grounding: span must be an exact page substring
}
