// Eval contract: POST {text, channel} -> {flags: [...]}. Anonymous, no writes.
// Used by: python3 eval/compliance_eval.py --detector https://<domain>/functions/detect-text
import { createClientFromRequest } from "npm:@base44/sdk";
import { detectText, MODE } from "../../shared/detect-core.ts";

const MAX_CHARS = 20_000; // anonymous endpoint: cap LLM spend per call

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON body {text, channel} required" }, { status: 400 });
  }
  const text = typeof body?.text === "string" ? body.text : "";
  const channel = typeof body?.channel === "string" ? body.channel : "";
  if (!text) return Response.json({ error: "text required" }, { status: 400 });
  if (text.length > MAX_CHARS) return Response.json({ error: `text over ${MAX_CHARS} chars` }, { status: 400 });

  const flags = await detectText(base44, text, channel);
  return Response.json({ flags, mode: MODE });
}
