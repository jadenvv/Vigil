// One LLM call, no retries. Mirrors engine/llm.py so P4's local eval numbers apply to the live app.
// PROVIDER "anthropic": Messages API via fetch, needs the ANTHROPIC_API_KEY secret.
// PROVIDER "invokellm": Base44 built-in InvokeLLM (Plan B). Different model, so re-run the eval.
import { secrets } from "base44:runtime";

export const PROVIDER: "anthropic" | "invokellm" = "anthropic";
export const MODEL = "claude-sonnet-5-5"; // engine/llm.py default
const TIMEOUT_MS = 60_000;

/** True when callLLM can run: InvokeLLM needs no key, Anthropic needs the secret. */
export function llmAvailable(): boolean {
  return PROVIDER === "invokellm" || Boolean(secrets.get("ANTHROPIC_API_KEY"));
}

/** Returns raw model text (anthropic) or a parsed object (invokellm). Throws on any failure. */
// deno-lint-ignore no-explicit-any
export async function callLLM(base44: any, system: string, user: string, schema: object, maxTokens = 2000): Promise<unknown> {
  if (PROVIDER === "invokellm") {
    return await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${system}\n\n${user}`,
      response_json_schema: schema,
    });
  }
  const key = secrets.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`anthropic HTTP ${res.status}`); // body not logged: may echo input
  const data = await res.json();
  return (data?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
}
