// {firm_id, docs?: [{url, markdown}]} -> {marks, provider, model}. No writes. Admin only.
// Cross-document check (engine/crossref.py review(), ported in shared/crossref_core.js): every absolute
// claim and checkable fact on the firm's latest pages, checked against the firm's other pages plus any
// documents the officer attaches (Form ADV, old posts). Each claim costs one LLM call, so it stays
// admin-only while quota is scarce. No retries: the first LLM failure ends the run with no marks.
import { createClientFromRequest } from "npm:@base44/sdk";
import { review } from "../../shared/crossref_core.js";
import { ABSOLUTES_PROMPT, CONTRADICT_PROMPT } from "../../shared/prompts.ts";
import { callLLM, LLMUnavailable } from "../../shared/llm.ts";

const MAX_DOC_CHARS = 60_000;
const MAX_EXTRA_DOCS = 3;

// deno-lint-ignore no-explicit-any
function latestPerUrl(pages: any[]): any[] {
  // deno-lint-ignore no-explicit-any
  const best = new Map<string, any>();
  for (const p of pages) {
    const prev = best.get(p.url);
    if (!prev || String(p.fetched_at ?? "") > String(prev.fetched_at ?? "")) best.set(p.url, p);
  }
  return [...best.values()];
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") return Response.json({ error: "crossref is admin only" }, { status: 401 });
  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON body {firm_id, docs?} required" }, { status: 400 });
  }
  const firmId = typeof body?.firm_id === "string" ? body.firm_id : "";
  if (!firmId) return Response.json({ error: "firm_id required" }, { status: 400 });
  const extra = Array.isArray(body?.docs) ? body.docs : [];
  if (extra.length > MAX_EXTRA_DOCS) return Response.json({ error: `at most ${MAX_EXTRA_DOCS} documents` }, { status: 400 });
  for (const d of extra) {
    if (typeof d?.url !== "string" || !d.url || typeof d?.markdown !== "string")
      return Response.json({ error: "each document needs {url, markdown}" }, { status: 400 });
    if (d.markdown.length > MAX_DOC_CHARS) return Response.json({ error: `document over ${MAX_DOC_CHARS} chars` }, { status: 400 });
  }

  const pages = latestPerUrl(await base44.asServiceRole.entities.Page.filter({ firm_id: firmId }));
  const docs = [
    // deno-lint-ignore no-explicit-any
    ...pages.map((p: any) => ({ url: p.url, markdown: String(p.markdown ?? "").slice(0, MAX_DOC_CHARS) })),
    // deno-lint-ignore no-explicit-any
    ...extra.map((d: any) => ({ url: d.url, markdown: d.markdown })),
  ];

  let provider = "";
  let model = "";
  const ask = async (system: string, user: string, schema: object) => {
    const r = await callLLM(base44, system, user, schema);
    provider = provider && provider !== r.provider ? `${provider}+${r.provider}` : r.provider;
    model = r.model;
    return r.output;
  };
  try {
    const marks = await review(docs, { absolutes: ABSOLUTES_PROMPT, contradict: CONTRADICT_PROMPT }, ask);
    return Response.json({ marks, provider, model, docs: docs.map((d) => d.url) });
  } catch (e) {
    if (e instanceof LLMUnavailable) return Response.json({ error: "llm_unavailable", marks: [] }, { status: 503 });
    console.log(`crossref: ${(e as Error)?.message ?? e}`);
    return Response.json({ error: "llm_error", marks: [] }, { status: 502 });
  }
}
