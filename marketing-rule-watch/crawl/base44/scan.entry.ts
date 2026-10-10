// Reference `scan` backend function for Base44. P2: copy to base44/app/base44/functions/scan/entry.ts
// and brightdata.ts to base44/app/base44/shared/brightdata.ts.
// Input  {firm_id: string, urls: string[], screenshot?: boolean}
// Output {created: number, failed: [{url, error}], log: string[]}
// Secrets: BRIGHTDATA_TOKEN, BRIGHTDATA_ZONE (npx base44 secrets set --env-file ../../.env).
// VERIFY before demo: (1) UploadFile accepts a File built server-side, (2) Page RLS lets admin create.
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { fetchPage, MAX_URLS } from "../../shared/brightdata.ts";

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Scanning is admin only" }, { status: 401 }); // credits are finite
  }

  const { firm_id, urls, screenshot = true } = await req.json();
  const list = [...new Set((urls ?? []).map((u: string) => String(u).trim()).filter(Boolean))] as string[];
  if (!firm_id || list.length === 0) return Response.json({ error: "firm_id and urls[] required" }, { status: 400 });
  if (list.length > MAX_URLS) return Response.json({ error: `max ${MAX_URLS} URLs per scan` }, { status: 400 });

  const token = secrets.get("BRIGHTDATA_TOKEN");
  const zone = secrets.get("BRIGHTDATA_ZONE");
  if (!token || !zone) return Response.json({ error: "BRIGHTDATA_TOKEN / BRIGHTDATA_ZONE not set" }, { status: 500 });

  let created = 0;
  const failed: { url: string; error: string }[] = [];
  const log: string[] = [];
  for (const url of list) { // sequential, no retries
    try {
      const r = await fetchPage(url, { token, zone, screenshot });
      log.push(...r.log);
      if (r.screenshot) {
        try {
          const file = new File([r.screenshot], `${r.page.sha256.slice(0, 16)}.png`, { type: "image/png" });
          const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
          r.page.screenshot_ref = file_url;
        } catch (e) {
          log.push(`upload failed for ${url}: ${(e as Error).message}`);
        }
      }
      await base44.asServiceRole.entities.Page.create({ firm_id, ...r.page });
      created++;
    } catch (e) {
      failed.push({ url, error: (e as Error).message.slice(0, 200) });
    }
  }
  console.log(log.join("\n")); // shows in `npx base44 logs`
  return Response.json({ created, failed, log });
}
