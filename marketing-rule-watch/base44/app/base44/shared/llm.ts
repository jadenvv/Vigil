// One LLM call per request, no retries. Primary: Base44's built-in InvokeLLM (sponsor-covered, monthly
// quota), which must go through asServiceRole in a backend function and takes one prompt, so system and
// user are joined there (engine/port/README.md).
// Fallback, only when InvokeLLM refuses for quota: Groq's OpenAI-compatible API (same provider and model
// as the local engine, engine/llm.py), key from the GROQ_API_KEY Base44 secret
// (npx base44 secrets set GROQ_API_KEY=...). Optional secret LLM_MODEL overrides the model.
// No GROQ_API_KEY set: the quota refusal surfaces as LLMUnavailable, as before.
import { secrets } from "base44:runtime";

/** The provider refused (quota/rate/auth): the model never ran, so nothing about the text is known. */
export class LLMUnavailable extends Error {}

// Seen 2026-10-10: "You have reached the limit of integrations for this month. Please upgrade your plan"
const QUOTA_ERROR = /limit of integrations|upgrade your plan/i;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

function secret(name: string): string {
  try {
    return secrets.get(name) ?? "";
  } catch {
    return "";
  }
}

/** Who answered. Returned with every result so it is attributable (eval report, UI, pitch). */
export interface Answered {
  output: unknown;
  provider: "base44" | "groq";
  model: string;
}

// InvokeLLM does not report its model.
const BASE44_MODEL = "base44-invokellm";

/** The parsed JSON object the model produced for `schema`, and who produced it. Throws on any failure. */
// deno-lint-ignore no-explicit-any
export async function callLLM(base44: any, system: string, user: string, schema: object): Promise<Answered> {
  try {
    return { output: await callInvokeLLM(base44, system, user, schema), provider: "base44", model: BASE44_MODEL };
  } catch (e) {
    const key = secret("GROQ_API_KEY");
    if (!(e instanceof LLMUnavailable) || !key) throw e;
    console.log(`llm: InvokeLLM unavailable (${e.message}); falling back to Groq`);
    const model = secret("LLM_MODEL") || DEFAULT_MODEL;
    return { output: await callGroq(key, model, system, user), provider: "groq", model };
  }
}

async function callGroq(key: string, model: string, system: string, user: string): Promise<unknown> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    // Groq's Cloudflare rejects some default user agents (error 1010), so name ourselves.
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "User-Agent": "marketing-rule-watch/1.0",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_completion_tokens: 4000, // gpt-oss reasons before answering; leave room for both
      response_format: { type: "json_object" }, // prompts spell out the exact JSON shape
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.text();
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    throw new LLMUnavailable(`Groq ${res.status}: ${body.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  const content = JSON.parse(body)?.choices?.[0]?.message?.content ?? "";
  return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
}

// deno-lint-ignore no-explicit-any
async function callInvokeLLM(base44: any, system: string, user: string, schema: object): Promise<unknown> {
  try {
    return await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${system}\n\n${user}`,
      response_json_schema: schema,
    });
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const err = e as any;
    const text = `${err?.message ?? ""} ${JSON.stringify(err?.response?.data ?? err?.data ?? "")}`;
    if (QUOTA_ERROR.test(text)) throw new LLMUnavailable(err?.message ?? "InvokeLLM quota reached");
    throw e;
  }
}
