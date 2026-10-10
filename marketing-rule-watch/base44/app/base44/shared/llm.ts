// One LLM call, no retries, through Base44's built-in InvokeLLM (sponsor-covered, no API key).
// This app sends nothing to any other LLM provider. InvokeLLM takes one prompt, so system and user
// are joined (engine/port/README.md). It is a different model from P4's local engine, so the eval
// must be run against the live detect-text endpoint, not quoted from local runs.
// InvokeLLM is blocked from app-runtime calls: it must go through asServiceRole in a backend function.

/** Returns the parsed object InvokeLLM produces for `schema`. Throws on any failure. */
// deno-lint-ignore no-explicit-any
export async function callLLM(base44: any, system: string, user: string, schema: object): Promise<unknown> {
  return await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `${system}\n\n${user}`,
    response_json_schema: schema,
  });
}
