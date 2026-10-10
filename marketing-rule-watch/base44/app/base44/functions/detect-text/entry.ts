// Eval contract: POST {text, channel} -> {flags: [...], mode}. No writes.
// ADMIN ONLY while the InvokeLLM quota is scarce: anonymous callers could spend it all.
// Reopen (drop the auth check) only for a planned eval run.
// Used by: python3 eval/compliance_eval.py --detector https://<domain>/functions/detect-text
import { createClientFromRequest } from "npm:@base44/sdk";
import { detectText } from "../../shared/detect-core.ts";

const MAX_CHARS = 20_000; // anonymous endpoint: cap LLM spend per call

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") return Response.json({ error: "detect-text is admin only" }, { status: 401 });
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

  const { flags, mode } = await detectText(base44, text, channel);
  return Response.json({ flags, mode });
}
