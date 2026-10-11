// Port of engine/{postprocess,rules,detect}.py for Base44 backend functions (Deno).
// Dependency-free ES module: copy into base44/shared/ and import from detect-core.ts.
// Owner: P4. Source of truth is the Python; engine/port/parity.mjs checks they agree.
//
//   buildMessages(promptMd, chunk, channel) -> {system, user}   // promptMd = engine/prompts/detect.md
//   parseFlags(rawLlmText)                  -> candidate[]      // throws on non-JSON (caller: zero flags, no retry)
//   postprocess(chunk, candidates, minConf) -> Flag[]           // validate, ground, suppress, dedupe, threshold
//   ruleCandidates(chunk)                   -> candidate[]      // no-LLM fallback detector
//   chunks(text, size)                      -> string[]         // exact substrings of text
//
// Spans returned are exact substrings of the chunk passed in. If you chunk, map them back to the
// page and re-check page.indexOf(span) >= 0 before writing Flag rows.

// Copy of TAXONOMY in eval/compliance_eval.py (source of truth). Keep in sync.
export const TAXONOMY = {
  UNSUBSTANTIATED_CLAIM: { rule: "206(4)-1(a)(2)", desc: "Material claim with no reasonable basis to substantiate" },
  BENEFITS_WITHOUT_RISK: { rule: "206(4)-1(a)(4)", desc: "Benefits promoted without fair and balanced treatment of risks" },
  UNBALANCED_SPECIFIC_ADVICE: { rule: "206(4)-1(a)(5)", desc: "Specific past advice shown without balance" },
  UNFAIR_PERFORMANCE_PRESENTATION: { rule: "206(4)-1(a)(6)", desc: "Cherry-picked results or time periods" },
  GROSS_WITHOUT_NET: { rule: "206(4)-1(d)(1)", desc: "Gross performance without net of equal prominence" },
  HYPOTHETICAL_PERFORMANCE: { rule: "206(4)-1(d)(6)", desc: "Hypothetical / backtested performance shown broadly" },
  TESTIMONIAL_NO_DISCLOSURE: { rule: "206(4)-1(b)", desc: "Testimonial/endorsement missing required disclosures" },
  RATING_NO_DISCLOSURE: { rule: "206(4)-1(c)", desc: "Third-party rating missing required disclosures" },
};

// ------------------------------------------------------------------ regex helpers
// Python's rx.finditer(text, s, e) / rx.search(text, s, e), with absolute offsets.
function findAll(rx, text, s = 0, e = text.length) {
  const g = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
  // Search the real text up to e, not a slice: Python's pos bounds where matches START; it does
  // not hide earlier characters from ^ anchors, \b or lookbehind. Slicing did, and caused drift.
  const sub = text.slice(0, e);
  g.lastIndex = s;
  const out = [];
  let m;
  while ((m = g.exec(sub)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m[0].length === 0) g.lastIndex++;
  }
  return out;
}
function search(rx, text, s = 0, e = text.length) {
  return findAll(rx, text, s, e)[0] || null;
}

// ------------------------------------------------------------------ grounding
const TRANS = { "“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-", " ": " " };

function normalizeWithMap(s) {
  const out = [], idx = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    let ch = TRANS[s[i]] ?? s[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      ch = " ";
      prevSpace = true;
    } else prevSpace = false;
    out.push(ch.toLowerCase());
    idx.push(i);
  }
  return [out.join(""), idx];
}

export function ground(text, span) {
  if (!span || !span.trim()) return null;
  if (text.includes(span)) return span;
  span = span.trim().replace(/^\.+|\.+$/g, "");
  if (span && text.includes(span)) return span;
  const [nt, idx] = normalizeWithMap(text);
  const ns = normalizeWithMap(span)[0].trim();
  const i = ns ? nt.indexOf(ns) : -1;
  if (i < 0) return null;
  return text.slice(idx[i], idx[i + ns.length - 1] + 1);
}

// ------------------------------------------------------------------ suppression
const SENT_END = /[.!?]+(?=\s|$)|\n+/;

function sentenceAround(text, start, end) {
  let s = 0;
  for (const m of findAll(SENT_END, text)) {
    if (m.end <= start) s = m.end;
    else if (m.start >= end) return text.slice(s, m.end);
  }
  return text.slice(s);
}

const RX = {
  client_status: /current client|former client|not a client|is a client|a client of|non-client|clients? since/i,
  compensation: /compensat|\bpaid\b|\bunpaid\b|received no|did not receive|no payment/i,
  rating_method: /methodolog|based on|survey|criteria/i,
  rating_date: /rating date|as of|dated|\((?:19|20)\d\d\)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (?:19|20)\d\d/i,
  rating_paid: /\bpaid\b|compensat|licensing fee|fee to use/i,
  net: /\bnet\b/i,
  neg_guarantee: /\b(?:not|no|cannot|can't|never|nor|nothing)\b[^.!?]{0,30}\b(?:guarantee|risk[- ]free)/i,
  neg_hypo: /\b(?:do not|don't|does not|never|no)\b[^.!?]{0,25}\b(?:publish|show|present|provide|use|offer)|\b(?:upon|on) request\b/i,
  advice_balanced: /including (?:those|ones|picks|recommendations|positions) that (?:lost|declined|fell|underperformed)|full list of (?:our |all )?(?:recommendations|picks)/i,
  disclaimer: /past performance (?:does not|is not|cannot|may not|is no)|involves? risk|possible loss of principal|risk of loss/i,
  // language shown as an example of what not to say, or quoted regulation (Tester B, Check 1:
  // "verify that it was, in fact, legitimately an advertisement")
  example_frame: new RegExp(
    String.raw`\b(?:a|an|another|some|other|many) (?:firm|adviser|advisor|manager|ad|advertisement)s? ` +
    String.raw`(?:might|may|could|would|that|who|which) (?:say|claim|promise|write|advertise|tout|call)` +
    String.raw`|\b(?:firms|advisers|advisors|managers|ads) (?:that|who|which) (?:say|claim|promise|advertise|tout)` +
    String.raw`|\b(?:phrases|claims|language|wording|words|statements|promises) (?:like|such as)\b` +
    String.raw`|\bwatch (?:out )?for\b|\bred flags?\b|\b(?:avoid|never|don't|do not) (?:say|saying|use|using)\b` +
    String.raw`|\b(?:the )?(?:SEC|Marketing Rule|Rule 206\(4\)-1|rule) (?:prohibits|bans|forbids|says|states|requires)\b` +
    String.raw`|\bmay not include\b|\bexamples? of (?:misleading|prohibited|non-compliant|problematic)`, "i"),
  first_person: /\b(?:we|our|us|I|my)\b/i,
  // a hand-picked start/window: standard periods elsewhere on the page don't excuse it
  cherry_window: /\b(?:since|from|off) the [^.,;]{0,25}?\b(?:low|lows|bottom|trough)\b|\bbest (?:\d+|two|three|four|five|six|seven|eight|nine|ten) (?:years|quarters|months)\b|\bbest (?:year|quarter|month|day|trade)s?\b/i,
};

function periods1510(chunk) {
  return [["1", "one"], ["5", "five"], ["10", "ten"]].every(([n, w]) =>
    new RegExp(`\\b${n}[- ]?(?:year|yr)s?\\b|\\b${n} years?\\b|\\b${w}[- ]year`, "i").test(chunk));
}

const OPEN_QUOTE = /(?:^|(?<=[\s\u2605]))"|\u201c/m;

// The text that belongs to one testimonial: its line up to the span, then on to the next
// opening quote or paragraph break. A neighbour's disclosure must not clear this one.
function testimonialUnit(chunk, start, end) {
  const a = start > 0 ? chunk.lastIndexOf("\n", start - 1) + 1 : 0; // rfind("\n",0,0) is -1 in Python
  const pb = chunk.indexOf("\n\n", end);
  const q = search(OPEN_QUOTE, chunk, end);
  const stops = [pb, q ? q.start : -1].filter((x) => x >= 0);
  return chunk.slice(a, stops.length ? Math.min(...stops) : chunk.length);
}

// One sentence that covers all testimonials/reviews on the page.
function blanketTestimonialDisclosure(chunk) {
  return findAll(/[^.!?\n]*(?:testimonials|reviews|endorsements)\b[^.!?\n]*[.!?]?/i, chunk)
    .some((m) => RX.client_status.test(m.text) && RX.compensation.test(m.text));
}

const QUOTED = /"[^"]*"|\u201c[^\u201d]*\u201d/;
const quotedIn = (sent, span) => findAll(QUOTED, sent).some((q) => q.text.includes(span));

// Example/education framing, and the span is quoted or isn't the firm speaking (we/our).
export function presentedAsExample(sent, span) {
  if (!RX.example_frame.test(sent)) return false;
  return quotedIn(sent, span) || !RX.first_person.test(span.replace(new RegExp(QUOTED.source, "g"), ""));
}

export function suppressed(chunk, flag) {
  const { category: cat, span } = flag;
  const i = chunk.indexOf(span);
  const sent = i >= 0 ? sentenceAround(chunk, i, i + span.length) : span;
  // disclosures must sit near the claim, not anywhere on the page
  const near = i >= 0 ? chunk.slice(Math.max(0, i - 150), i + span.length + 350) : chunk;
  if (RX.disclaimer.test(sent) && !/\bwe guarantee|\bguaranteed (?:returns?|income)/i.test(sent))
    return "inside a standard risk disclaimer";
  if (presentedAsExample(sent, span)) return "example or quoted rule, not the firm's own claim";
  if (cat === "TESTIMONIAL_NO_DISCLOSURE") {
    const unit = i >= 0 ? testimonialUnit(chunk, i, i + span.length) : span;
    if ((RX.client_status.test(unit) && RX.compensation.test(unit)) || blanketTestimonialDisclosure(chunk))
      return "client status and compensation disclosed";
  }
  if (cat === "RATING_NO_DISCLOSURE" && RX.rating_method.test(near) && (RX.rating_date.test(near) || RX.rating_paid.test(near)))
    return "rating methodology and date/payment disclosed";
  if (cat === "GROSS_WITHOUT_NET" && RX.net.test(near)) return "net performance shown";
  if (cat === "UNFAIR_PERFORMANCE_PRESENTATION" && periods1510(near) && !RX.cherry_window.test(sent))
    return "1/5/10-year periods shown";
  if (cat === "BENEFITS_WITHOUT_RISK" && RX.neg_guarantee.test(sent) && !/\bwe guarantee/i.test(sent))
    return "negated guarantee (disclaimer)";
  if (cat === "HYPOTHETICAL_PERFORMANCE" && RX.neg_hypo.test(sent)) return "hypothetical not presented / only on request";
  if (cat === "UNBALANCED_SPECIFIC_ADVICE" && RX.advice_balanced.test(near)) return "balanced list of recommendations offered";
  return null;
}

// ------------------------------------------------------------------ pipeline
function overlap(a, b) {
  const inter = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
  return inter / Math.max(1, Math.min(a[1] - a[0], b[1] - b[0]));
}

export function postprocess(chunk, candidates, minConf = 0.5, debug = null) {
  const log = (f, reason) => debug && debug.push({ dropped: { category: f.category, span: f.span }, reason });
  let kept = [];
  for (const c of candidates || []) {
    const cat = String(c?.category ?? "").trim().toUpperCase();
    if (!(cat in TAXONOMY)) { log(c || {}, "unknown category"); continue; }
    const span = ground(chunk, String(c.span ?? ""));
    if (span === null) { log(c, "ungrounded span"); continue; }
    let conf = Number(c.confidence ?? 0.5);
    if (!Number.isFinite(conf)) conf = 0.5;
    conf = Math.min(1, Math.max(0, conf));
    const f = { category: cat, span, rule: TAXONOMY[cat].rule, confidence: conf,
                why: String(c.why || TAXONOMY[cat].desc).trim() };
    if (conf < minConf) { log(f, `below threshold ${minConf}`); continue; }
    const reason = suppressed(chunk, f);
    if (reason) { log(f, reason); continue; }
    const i = chunk.indexOf(span);
    const loc = [i, i + span.length];
    const clash = kept.find((k) => overlap(k.loc, loc) > 0.5);
    if (clash) {
      if (clash.f.confidence >= conf) { log(f, `overlaps ${clash.f.category}`); continue; }
      kept = kept.filter((k) => k !== clash);
      log(clash.f, `overlaps ${cat}`);
    }
    kept.push({ loc, f });
  }
  return kept.sort((a, b) => a.loc[0] - b.loc[0]).map((k) => k.f);
}

// ------------------------------------------------------------------ rules (hints + fallback)
const CLAUSE_SPLIT = /,\s+|;\s+|:\s+|\s+(?:--|-|—|–)\s+|\s+and\s+/i;
const FIGURE = /[+-]?\d+(?:\.\d+)?\s?%|\$\s?\d|\b\d+x\b|\breturn/i;

export function sentences(text) {
  const out = [];
  let s = 0;
  const ms = findAll(SENT_END, text);
  for (let k = 0; k <= ms.length; k++) {
    const m = ms[k];
    const e = m ? m.start : text.length;
    let a = s, b = e;
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    if (b > a) out.push([a, b]);
    if (!m) break;
    s = m.end;
  }
  return out;
}

function clauseAt(text, [s, e], pos) {
  let a = s;
  for (const m of findAll(CLAUSE_SPLIT, text, s, e)) {
    if (m.start >= pos) return [a, m.start];
    a = m.end;
  }
  return [a, e];
}

const CUES = {
  BENEFITS_WITHOUT_RISK: /\bguarantee[sd]?\b|\brisk[- ]free\b|\bno risk\b|\bwithout risk\b|\bnever (?:lost|lose[sd]?)\b|\bcan(?:'|no)?t lose\b|\bzero (?:worries|risk)\b|\bworry[- ]free\b|\bno downside\b|\bfully protected\b|\bsafe bet\b|\bnever (?:had|seen|posted|suffered) a (?:losing|down|negative)\b/i,
  UNSUBSTANTIATED_CLAIM: /#\s?1\b|\bnumber one\b|\bthe best (?:in|advisor|firm|financial|wealth|investment)\b|\boutperform\w*|\bbeat(?:s|en|ing)? the (?:market|s&p|index|benchmark)|\beliminat\w* (?:emotional|all risk|risk|errors|mistakes|losses)|\bpredicts? (?:the )?market|\bbefore they happen\b/i,
  HYPOTHETICAL_PERFORMANCE: /\bwould have (?:returned|grown|earned|made|gained|avoided|beaten|outperformed|delivered)\b|\bback-?test\w*|\bhypothetical\b|\bsimulated\b|\bmodel portfolio\b/i,
  UNFAIR_PERFORMANCE_PRESENTATION: /\b(?:since|from) the [^.,;]{0,25}?\b(?:low|lows|bottom|trough)\b|\bbest (?:year|quarter|month|day|trade)s?\b/i,
  RATING_NO_DISCLOSURE: /\bnamed (?:a |one of the |as a |as one of the )?(?:top|best)\b|\branked #?\d+|\btop[- ]rated\b|\baward[- ]winning\b|\bvoted (?:[\w']+ ){0,3}(?:best|top|#\s?1)\b|\brecognized (?:by|as) [^.]{0,40}\btop\b|\b(?:five|5)[- ]star (?:rated|advisor|firm|wealth|financial)/i,
  GROSS_WITHOUT_NET: /\bgross\b/i,
};
const ADVICE_ACT = /\b(?:we|i)\s+(?:put clients in(?:to)?|told clients to buy|recommended|bought|picked|added)\b/i;
const ADVICE_GAIN = /\b(?:doubled|tripled|quadrupled|soared|skyrocketed|surged)\b|\bup \d+%|\b\d+x\b/i;
const QUOTE = /["“][^"”]{15,300}["”]/;
const ATTRIB_AFTER = /^\s*,?\s*(?:says|said|wrote|writes|--|-|—|–)/i;
const REVIEW = /reposted from|from our (?:yelp|google|facebook)|\breviews? (?:on|from)\b|\b(?:five|5) stars?\b|★/i;
const ENDORSE = /\b(?:she|he|they) (?:says|said|swears|recommends)\b[^.!?]*/i;
const HINT_EXTRA = {
  "review / star language": REVIEW,
  "third-party endorsement": ENDORSE,
  "net figure present": /\bnet\b/i,
  "disclosure language present": /current client|compensat|methodolog|rating date|not representative|past performance/i,
};

// Per quote: does it carry its OWN client-status + compensation disclosure? A page-wide
// "disclosure present" cue made the model treat a neighbour's disclosure as covering every quote.
function quoteHints(text) {
  const blanket = blanketTestimonialDisclosure(text);
  return findAll(QUOTE, text).map((m) => {
    const unit = testimonialUnit(text, m.start, m.end);
    const label = RX.client_status.test(unit) && RX.compensation.test(unit)
      ? "quoted text with its own client/compensation disclosure"
      : blanket ? "quoted text covered by a page-wide testimonial disclosure"
      : "TESTIMONIAL_NO_DISCLOSURE? quoted text with NO disclosure of its own";
    return `${label}: "${m.text.slice(0, 80)}"`;
  });
}

export function hints(text, limit = 25) {
  const out = [];
  for (const [cat, rx] of Object.entries(CUES))
    for (const m of findAll(rx, text)) out.push(`${cat}? cue "${m.text}"`);
  out.push(...quoteHints(text));
  for (const [label, rx] of Object.entries(HINT_EXTRA))
    for (const m of findAll(rx, text)) out.push(`${label}: "${m.text.slice(0, 80)}"`);
  for (const [s, e] of sentences(text))
    if (search(ADVICE_ACT, text, s, e) && search(ADVICE_GAIN, text, s, e))
      out.push(`UNBALANCED_SPECIFIC_ADVICE? cue "${text.slice(s, e).slice(0, 80)}"`);
  return [...new Set(out)].slice(0, limit);
}

const mk = (category, text, a, b, confidence) => ({ category, span: text.slice(a, b).trim(), confidence, why: "" });

export function ruleCandidates(text) {
  const out = [];
  const sents = sentences(text);
  for (let k = 0; k < sents.length; k++) {
    const sent = sents[k];
    const [s, e] = sent;
    const hasFig = FIGURE.test(text.slice(s, e));

    const bwr = findAll(CUES.BENEFITS_WITHOUT_RISK, text, s, e);
    if (bwr.length) {
      const sp = bwr.map((m) => clauseAt(text, sent, m.start));
      out.push(mk("BENEFITS_WITHOUT_RISK", text, Math.min(...sp.map((x) => x[0])), Math.max(...sp.map((x) => x[1])), 0.7));
    }
    for (const m of findAll(CUES.UNSUBSTANTIATED_CLAIM, text, s, e)) {
      const [a, b] = clauseAt(text, sent, m.start);
      out.push(mk("UNSUBSTANTIATED_CLAIM", text, a, b, 0.6));
    }
    let m = search(CUES.HYPOTHETICAL_PERFORMANCE, text, s, e);
    if (m && hasFig) {
      const wh = search(/\bwould have\b/i, text, s, e);
      out.push(mk("HYPOTHETICAL_PERFORMANCE", text, (wh || m).start, e, 0.7));
    }
    m = search(CUES.UNFAIR_PERFORMANCE_PRESENTATION, text, s, e);
    if (m && hasFig) out.push(mk("UNFAIR_PERFORMANCE_PRESENTATION", text, m.text.toLowerCase().startsWith("best") ? m.start : s, e, 0.7));
    const rs = findAll(CUES.RATING_NO_DISCLOSURE, text, s, e).map((x) => clauseAt(text, sent, x.start));
    if (rs.length) out.push(mk("RATING_NO_DISCLOSURE", text, Math.min(...rs.map((r) => r[0])), Math.max(...rs.map((r) => r[1])), 0.7));
    // gross: union of the clauses that hold "gross" and a figure
    const gs = findAll(CUES.GROSS_WITHOUT_NET, text, s, e).map((x) => clauseAt(text, sent, x.start))
      .filter((g) => search(FIGURE, text, g[0], g[1]));
    if (gs.length) out.push(mk("GROSS_WITHOUT_NET", text, Math.min(...gs.map((g) => g[0])), Math.max(...gs.map((g) => g[1])), 0.8));
    // a specific pick, with the gain in the same or the next sentence
    if (search(ADVICE_ACT, text, s, e)) {
      const nxt = sents[k + 1];
      if (search(ADVICE_GAIN, text, s, e)) out.push(mk("UNBALANCED_SPECIFIC_ADVICE", text, s, e, 0.7));
      else if (nxt && search(ADVICE_GAIN, text, nxt[0], nxt[1])) out.push(mk("UNBALANCED_SPECIFIC_ADVICE", text, s, nxt[1], 0.7));
    }
    for (const en of findAll(ENDORSE, text, s, e)) out.push(mk("TESTIMONIAL_NO_DISCLOSURE", text, en.start, en.end, 0.8));
  }
  for (const q of findAll(QUOTE, text))
    if (ATTRIB_AFTER.test(text.slice(q.end))) out.push(mk("TESTIMONIAL_NO_DISCLOSURE", text, q.start, q.end, 0.8));
  for (const line of findAll(/[^\n]+/, text)) {
    if (!REVIEW.test(line.text)) continue;
    let a = line.start, b = line.end;
    const c = text.indexOf(": ", a);
    if (c >= 0 && c < b) a = c + 2;
    const cut = search(/\s+(?:--|-|—|–)\s+[A-Z]/, text, a, b);
    if (cut) b = cut.start;
    if (b - a >= 10 && !search(QUOTE, text, a, b)) out.push(mk("TESTIMONIAL_NO_DISCLOSURE", text, a, b, 0.8));
  }
  return out.filter((f) => f.span);
}

// ------------------------------------------------------------------ prompt + parsing
export function splitPrompt(promptMd) {
  const raw = promptMd.replace(/<!--[\s\S]*?-->/g, "");
  const rest = raw.split("=== SYSTEM ===")[1] ?? "";
  const [system, user = ""] = rest.split("=== USER ===");
  return { system: system.trim(), user: user.trim() };
}

export function buildMessages(promptMd, chunk, channel) {
  const { system, user } = splitPrompt(promptMd);
  const h = hints(chunk);
  // page can't close our delimiter — exact tag or case/spacing variants (Python parity below)
  const page = chunk.replace(/<\/?\s*page_content\s*>/gi, (m) => m.replace(/page_content/i, "page_content_"));
  const filled = user
    .replaceAll("{{channel}}", () => channel || "unknown")
    .replaceAll("{{hints}}", () => h.map((x) => `- ${x}`).join("\n") || "- none")
    .replaceAll("{{page}}", () => page); // replaceAll: a {{page}} inside untrusted hints must not win the slot
  return { system, user: filled };
}

export function parseFlags(raw) {
  if (raw && typeof raw === "object") { // InvokeLLM returns parsed JSON; {"flags": <non-array>} is malformed, not []
    const d = Array.isArray(raw) ? raw : ("flags" in raw ? raw.flags : []);
    if (Array.isArray(d)) return d.filter((x) => x && typeof x === "object");
    throw new Error("LLM did not return JSON flags");
  }
  let s = String(raw || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const tries = [s];
  const m = s.search(/[[{]/);
  if (m >= 0) {
    const closer = s[m] === "{" ? "}" : "]";
    const end = s.lastIndexOf(closer);
    if (end > m) tries.push(s.slice(m, end + 1));
  }
  for (const t of tries) {
    try {
      let d = JSON.parse(t);
      if (d && !Array.isArray(d) && typeof d === "object") d = d.flags || [];
      if (Array.isArray(d)) return d.filter((x) => x && typeof x === "object");
    } catch { /* try next */ }
  }
  throw new Error("LLM did not return JSON flags");
}

export function chunks(text, size = 6000) {
  if (text.length <= size) return [text];
  const out = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      let cut = text.lastIndexOf("\n\n", end - 2);
      if (cut <= start) cut = text.lastIndexOf("\n", end - 1);
      if (cut > start) end = cut;
    }
    out.push(text.slice(start, end));
    start = end;
  }
  return out;
}
