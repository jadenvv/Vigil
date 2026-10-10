// 1:30 probe: can backend functions make outbound HTTPS calls? Needs no secrets.
// Any HTTP status (401 included) means outbound works. A thrown error means it doesn't.
// Delete after the Plan A/B decision.
import { createClientFromRequest } from "npm:@base44/sdk";

const TARGETS = ["https://api.brightdata.com", "https://api.anthropic.com"];

async function probe(url: string) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    await res.body?.cancel();
    return { url, ok: true, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return { url, ok: false, error: (err as Error)?.name ?? "Error", message: String((err as Error)?.message ?? err).slice(0, 200), ms: Date.now() - started };
  }
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }
  const results = [];
  for (const url of TARGETS) results.push(await probe(url));
  return Response.json({ outbound: results.every((r) => r.ok), results });
}
