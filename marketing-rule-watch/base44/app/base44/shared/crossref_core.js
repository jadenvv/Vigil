// Cross-document check: a JS port of engine/crossref.py review() (owner: P4). Keep the two in step.
// Pass 1 lists each doc's absolute claims and checkable facts; pass 2 asks, per claim, whether a
// keyword-retrieved passage from ANOTHER doc contradicts it. Every claim ends up as a mark:
//   contradicted -> high | uncontradicted absolute -> review | uncontradicted checkable fact -> info
// The LLM is injected as ask(system, user, schema) -> object, so this file runs in vitest and Deno.
// No retries: an ask() that throws ends the run (a partial list is never passed off as the full one).
import { chunks, ground, splitPrompt } from "./detect_core.js";

export const TOPICS = ["losses", "returns", "guarantees", "conflicts", "fees", "size", "credentials", "regulatory", "other"];
export const MIN_CONF = 0.6;
export const MAX_CLAIMS = 25; // engine default is 40; fewer here because every claim costs one call
export const K = 6;

const TOPIC_TERMS = {
  losses: ["loss", "lost", "declin", "negative", "drawdown", "fell", "down"],
  returns: ["benchmark", "underperform", "lagged", "trailed", "index", "return"],
  guarantees: ["guarantee", "insur", "lose value", "principal", "not protected"],
  conflicts: ["conflict", "12b-1", "revenue shar", "commission", "affiliat", "compensat"],
  fees: ["fee", "commission", "charge", "%"],
  size: ["assets under management", "regulatory assets", "million", "billion", "clients", "households"],
  credentials: ["cfp", "certified", "candidate", "license", "designation"],
  regulatory: ["disciplinary", "sanction", "finra", "censure", "fine", "order", "settle"],
  other: [],
};

export const ABSOLUTE_RX =
  /\b(?:never|always|guarantee[ds]?|guaranteeing|risk[- ]free|no risk|without (?:any )?risk|can(?:not|'t) lose|conflict[- ]free|free of (?:any )?conflicts|zero|every|100\s?%|consistently|most trusted)\b/i;

// same as detect_core RX.disclaimer / engine/postprocess.py RX["disclaimer"]
const DISCLAIMER_RX = /past performance (?:does not|is not|cannot|may not|is no)|involves? risk|possible loss of principal|risk of loss/i;

export const ABSOLUTES_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          span: { type: "string" },
          topic: { type: "string" },
          absolute: { type: "boolean" },
          assertion: { type: "string" },
          terms: { type: "array", items: { type: "string" } },
        },
        required: ["span", "topic", "absolute", "assertion", "terms"],
      },
    },
  },
  required: ["claims"],
};

export const CONTRADICT_SCHEMA = {
  type: "object",
  properties: {
    contradicts: { type: "boolean" },
    passage: { type: "integer" },
    evidence_span: { type: "string" },
    confidence: { type: "number" },
    why: { type: "string" },
  },
  required: ["contradicts", "passage", "evidence_span", "confidence", "why"],
};

export const UNVERIFIED_WHY = {
  true: "This is an absolute claim. No other document we checked contradicts it, but the firm may need to be able to substantiate it.",
  false: "This is a specific checkable fact. No other document we checked contradicts it; the firm should keep records that support it.",
};

function neutralise(text, tag) {
  return text.replace(new RegExp(`<\\/?\\s*${tag}\\s*>`, "gi"), (m) => m.replace(new RegExp(tag, "i"), `${tag}_`));
}

// ---------------------------------------------------------------- pass 1
export async function extractAbsolutes(docs, promptMd, ask, maxClaims = MAX_CLAIMS) {
  const { system, user: userT } = splitPrompt(promptMd);
  const claims = [];
  const seen = new Set();
  for (const d of docs) {
    const text = d.markdown ?? "";
    for (const ch of chunks(text)) {
      if (!ch.trim()) continue;
      const user = userT.replace("{{url}}", () => d.url).replace("{{page}}", () => neutralise(ch, "page_content"));
      const out = await ask(system, user, ABSOLUTES_SCHEMA);
      for (const c of Array.isArray(out?.claims) ? out.claims : []) {
        if (!c || typeof c !== "object") continue;
        const span = ground(text, String(c.span ?? ""));
        const key = `${d.url}\u0000${span}`;
        if (!span || seen.has(key)) continue;
        seen.add(key);
        claims.push({
          span,
          url: d.url,
          topic: TOPICS.includes(c.topic) ? c.topic : "other",
          absolute: c.absolute === true || ABSOLUTE_RX.test(span),
          assertion: String(c.assertion || span).slice(0, 300),
          terms: (Array.isArray(c.terms) ? c.terms : []).map((t) => String(t).toLowerCase()).filter((t) => t.trim()).slice(0, 8),
        });
      }
    }
  }
  return claims.slice(0, maxClaims);
}

// ---------------------------------------------------------------- retrieval
const SENT = /(?<=[.!?])\s+(?=[A-Z0-9"“(])/;

/** Paragraphs, long ones split into sentence groups. Each is an exact substring of the doc. */
export function passages(doc, maxChars = 500) {
  const text = doc.markdown ?? "";
  const out = [];
  for (let para of text.split(/\n\s*\n/)) {
    para = para.trim();
    if (!para) continue;
    if (para.length <= maxChars) {
      out.push(para);
      continue;
    }
    let buf = "";
    for (const s of para.split(SENT)) {
      if (buf && buf.length + s.length + 1 > maxChars) {
        out.push(buf);
        buf = s;
      } else buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) out.push(buf);
  }
  return out.map((p) => (text.includes(p) ? p : ground(text, p) ?? p));
}

function terms(claim) {
  const base = [...(claim.terms ?? []), ...(TOPIC_TERMS[claim.topic] ?? [])];
  for (const w of claim.span.match(/\b(?:[A-Z][a-z]{3,}|\d[\d,.]*)\b/g) ?? []) base.push(w.toLowerCase());
  return [...new Set(base.filter((t) => t.length >= 2))].sort();
}

export function retrieve(claim, docs, k = K) {
  const ts = terms(claim);
  const scored = [];
  for (const d of docs) {
    if (d.url === claim.url) continue;
    for (const p of passages(d)) {
      const low = p.toLowerCase();
      const score = ts.filter((t) => low.includes(t)).length;
      if (score) scored.push([score, scored.length, { url: d.url, text: p }]);
    }
  }
  scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return scored.slice(0, k).map((s) => s[2]);
}

// ---------------------------------------------------------------- pass 2
/** A generic risk disclaimer that names nothing specific from the claim never counts. */
export function boilerplate(evidence, claimSpan) {
  if (!DISCLAIMER_RX.test(evidence)) return false;
  const skip = new Set(["past", "performance", "investing", "quarrywick", "wealth", "clients", "client", "our"]);
  const specific = (claimSpan.match(/\b(?:[A-Z][a-z]{3,}|\d{2,}[\d,.]*)\b/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !skip.has(w));
  const low = evidence.toLowerCase();
  return !specific.some((w) => low.includes(w)) && !/\b(?:19|20)\d{2}\b|\d+(?:\.\d+)?%/.test(evidence);
}

export async function check(claim, found, docs, promptMd, ask, minConf = MIN_CONF) {
  if (!found.length) return null;
  const { system, user: userT } = splitPrompt(promptMd);
  const block = found.map((p, i) => `[${i + 1}] (from ${p.url})\n${neutralise(p.text, "passages")}`).join("\n\n");
  const user = userT
    .replace("{{claim_url}}", () => claim.url)
    .replace("{{claim_span}}", () => claim.span)
    .replace("{{assertion}}", () => claim.assertion)
    .replace("{{passages}}", () => block);
  const r = (await ask(system, user, CONTRADICT_SCHEMA)) ?? {};
  if (!r.contradicts) return null;
  const idx = Number.parseInt(r.passage ?? 0, 10) || 0;
  const conf = Number(r.confidence) || 0;
  if (idx < 1 || idx > found.length) return null;
  const p = found[idx - 1];
  const docText = docs.find((d) => d.url === p.url)?.markdown ?? "";
  // the quote must come from the passage the model named, and exist verbatim in that doc
  let ev = ground(p.text, String(r.evidence_span ?? ""));
  if (ev && !docText.includes(ev)) ev = ground(docText, ev);
  if (!ev || conf < minConf || boilerplate(ev, claim.span)) return null;
  return {
    claim_span: claim.span,
    claim_url: claim.url,
    evidence_span: ev,
    evidence_url: p.url,
    topic: claim.topic,
    confidence: Math.round(conf * 100) / 100,
    why: String(r.why ?? "").slice(0, 400),
    absolute: Boolean(claim.absolute),
  };
}

export async function findContradictions(claims, docs, promptMd, ask) {
  const flags = new Map();
  for (const c of claims) {
    const f = await check(c, retrieve(c, docs), docs, promptMd, ask);
    if (!f) continue;
    // A vs B and B vs A are one finding: keep the direction whose claim is the absolute, then the more confident
    const key = [`${f.claim_url}\u0000${f.claim_span}`, `${f.evidence_url}\u0000${f.evidence_span}`].sort().join("\u0001");
    const prev = flags.get(key);
    const better = !prev || f.absolute > prev.absolute || (f.absolute === prev.absolute && f.confidence > prev.confidence);
    if (better) flags.set(key, f);
  }
  return [...flags.values()];
}

const overlaps = (claim, url, span) => claim.url === url && (span.includes(claim.span) || claim.span.includes(span));

/** Every contradiction (high), plus every claim that took part in none: absolutes -> review, facts -> info. */
export function mark(claims, flags) {
  const out = flags.map((f) => ({ ...f, status: "contradicted", severity: "high" }));
  for (const c of claims) {
    if (flags.some((f) => overlaps(c, f.claim_url, f.claim_span) || (f.evidence_url && overlaps(c, f.evidence_url, f.evidence_span)))) continue;
    const absolute = Boolean(c.absolute);
    out.push({
      claim_span: c.span,
      claim_url: c.url,
      evidence_span: "",
      evidence_url: "",
      topic: c.topic,
      confidence: null,
      absolute,
      status: "unverified",
      severity: absolute ? "review" : "info",
      why: UNVERIFIED_WHY[absolute],
    });
  }
  return out;
}

/** docs: [{url, markdown}]. prompts: {absolutes, contradict} (markdown). Returns marks. */
export async function review(docs, prompts, ask) {
  docs = docs.filter((d) => (d.markdown ?? "").trim());
  if (!docs.length) return [];
  const claims = await extractAbsolutes(docs, prompts.absolutes, ask);
  // one doc: nothing to cross-reference, but its claims are still marked
  const flags = docs.length > 1 ? await findContradictions(claims, docs, prompts.contradict, ask) : [];
  return mark(claims, flags);
}
