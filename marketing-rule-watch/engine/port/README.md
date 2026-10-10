# Detector hand-off to P2 (Base44)

Copy these into `base44/shared/` (P2 owns that folder; P4 doesn't edit it):

| From `engine/` | What |
|---|---|
| `prompts/detect.md` | The prompt, verbatim. `splitPrompt()` reads the `=== SYSTEM ===` / `=== USER ===` sections and strips the comment header |
| `prompts/detect.schema.json` | `response_json_schema` for `InvokeLLM`, or a JSON-mode schema for any API |
| `port/detect_core.js` | Dependency-free ES module: post-processing, hints, rules fallback, prompt build, parser. Deno imports it as-is |

`node engine/port/parity.mjs` checks the JS port gives the same output as the Python engine on every eval case. It currently passes with 0 mismatches.

## detect-core.ts (sketch)

```ts
import { buildMessages, parseFlags, postprocess, ruleCandidates, chunks } from "./detect_core.js";
import { DETECT_PROMPT } from "./prompts.ts";   // = engine/prompts/detect.md verbatim

const MIN_CONF = 0.5; // from eval; P4 will tell you if it changes

export async function detectText(text: string, channel = "", mode: "llm" | "rules" = "llm") {
  const flags = [];
  for (const chunk of chunks(text, 6000)) {
    let cands = [];
    if (mode === "rules") {
      cands = ruleCandidates(chunk);
    } else {
      const { system, user } = buildMessages(DETECT_PROMPT, chunk, channel);
      try {
        cands = parseFlags(await callLLM(system, user));   // one call, no retry
      } catch { cands = []; }                              // malformed -> zero flags for this chunk
    }
    flags.push(...postprocess(chunk, cands, MIN_CONF));
  }
  return flags.filter((f) => text.includes(f.span));       // page-level grounding check
}
```

**`callLLM` options**
- **API via fetch** (Anthropic, OpenAI or any compatible provider): send `system` as the system prompt and `user` as the user message, with temperature 0. Use the same provider and model as `engine/llm.py` so our local eval numbers apply to the live app.
- **`InvokeLLM`** takes a single prompt, so pass `` `${system}\n\n${user}` `` and `response_json_schema` from `detect.schema.json`. `parseFlags()` accepts the parsed object it returns. It's a different model, so P4 re-runs the eval against `detect-text`.
- **No LLM yet:** `mode = "rules"` runs the keyword fallback. It's free and deterministic, but it only knows the patterns it was written for, so don't call it "AI" in the UI or pitch.

## Guarantees from `postprocess`
- Every `span` is an exact substring of the chunk. Drifted quotes, whitespace or case are repaired to the original text, and anything else is dropped. `markdown.indexOf(span)` is safe.
- `rule` and the default `why` come from TAXONOMY, never from the LLM.
- Unknown categories, standard disclaimers and claims with their disclosure nearby are dropped.
- Overlapping flags are deduped (the higher-confidence one is kept).
