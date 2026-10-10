// One LLM call, no retries, through Base44's built-in InvokeLLM (sponsor-covered, no API key).
// This app sends nothing to any other LLM provider. InvokeLLM takes one prompt, so system and user
// are joined (engine/port/README.md). It is a different model from P4's local engine, so the eval
// must be run against the live detect-text endpoint, not quoted from local runs.
// InvokeLLM is blocked from app-runtime calls: it must go through asServiceRole in a backend function.

/** InvokeLLM refused for quota/plan reasons: the model never ran, so nothing about the text is known. */
export class LLMUnavailable extends Error {}

// Seen 2026-10-10: "You have reached the limit of integrations for this month. Please upgrade your plan"
const QUOTA_ERROR = /limit of integrations|upgrade your plan/i;

/** Returns the parsed object InvokeLLM produces for `schema`. Throws on any failure. */
// deno-lint-ignore no-explicit-any
export async function callLLM(base44: any, system: string, user: string, schema: object): Promise<unknown> {
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
