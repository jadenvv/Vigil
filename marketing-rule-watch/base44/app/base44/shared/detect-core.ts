// Detection pipeline shared by `detect` and `detect-text`. Logic lives in P4's detect_core.js
// (do not edit it here); this file only wires the prompt, the LLM call and page-level grounding.
import { buildMessages, chunks, parseFlags, postprocess, ruleCandidates } from "./detect_core.js";
import { DETECT_PROMPT, DETECT_SCHEMA } from "./prompts.ts";
import { callLLM, LLMUnavailable } from "./llm.ts";

// "llm"   = DETECT_PROMPT through Base44 InvokeLLM (shared/llm.ts).
// "rules" = P4's keyword fallback: free, deterministic, NOT AI. Don't call it AI in UI or pitch.
// An LLM failure never falls back to rules silently: those chunks yield zero flags and the
// result reports mode "llm_error", so a partial answer is never passed off as a full one.
// "llm_unavailable" = InvokeLLM refused (quota/plan): no chunk was analyzed, so no flags at all.
export const MODE: "llm" | "rules" = "llm";
export const MIN_CONF = 0.5; // from P4's eval
export const MAX_TEXT = 200_000; // guard for a single page

// Rules mode has no model to explain itself, and the TAXONOMY desc is jargon. Testers read this.
export const PLAIN_WHY: Record<string, string> = {
  UNSUBSTANTIATED_CLAIM: "States something as fact that the firm may not be able to prove.",
  BENEFITS_WITHOUT_RISK: "Promises a benefit without saying what could go wrong.",
  UNBALANCED_SPECIFIC_ADVICE: "Highlights a past winning pick without showing the full record, losers included.",
  UNFAIR_PERFORMANCE_PRESENTATION: "Shows a hand-picked time period that makes results look better than usual.",
  GROSS_WITHOUT_NET: "Shows returns before fees without the after-fee returns next to them.",
  HYPOTHETICAL_PERFORMANCE: "Shows model or backtested results, not real client results, to a general audience.",
  TESTIMONIAL_NO_DISCLOSURE: "Quotes a client or endorser without saying whether they were paid or are a current client.",
  RATING_NO_DISCLOSURE: "Cites a rating or award without its date, who gave it, or whether the firm paid for it.",
};

export interface Flag {
  category: string;
  span: string;
  rule: string;
  confidence: number;
  why: string;
}

export interface DetectResult {
  flags: Flag[];
  mode: "llm" | "rules" | "llm_error" | "llm_unavailable";
}

// deno-lint-ignore no-explicit-any
export async function detectText(base44: any, text: string, channel = "", mode = MODE): Promise<DetectResult> {
  const flags: Flag[] = [];
  let failedChunks = 0;
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
        if (e instanceof LLMUnavailable) {
          console.log(`detect: LLM unavailable (${e.message})`);
          return { flags: [], mode: "llm_unavailable" }; // later chunks would be refused too
        }
        console.log(`detect: chunk dropped (${(e as Error).message})`); // malformed or failed -> zero flags
        failedChunks++;
        cands = [];
      }
    }
    const kept: Flag[] = postprocess(chunk, cands, MIN_CONF);
    if (mode === "rules") for (const f of kept) f.why = PLAIN_WHY[f.category] ?? f.why;
    flags.push(...kept);
  }
  return {
    flags: flags.filter((f) => text.includes(f.span)), // grounding: span must be an exact page substring
    mode: failedChunks ? "llm_error" : mode,
  };
}
