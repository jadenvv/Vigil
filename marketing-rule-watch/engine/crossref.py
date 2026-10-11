"""review(docs) -> list[Mark]           every absolute claim and checkable fact, rated by what the other docs say
crossref(docs) -> list[ContradictionFlag]   contradictions only (the eval contract)

Two passes over a firm's documents (site pages, old blog posts, its Form ADV):
  1. extract_absolutes: per doc, the LLM lists absolute / checkable claims (prompts/absolutes.md).
     Each span is grounded in the doc; ungrounded claims are dropped.
  2. find_contradictions: per claim, cheap keyword retrieval picks passages from the OTHER docs;
     one LLM call (prompts/contradict.md) says whether any passage contradicts the claim.
     The evidence span is grounded in its doc; generic risk boilerplate never counts.

doc  = {"url": str, "markdown": str}
flag = {"claim_span", "claim_url", "evidence_span", "evidence_url", "topic", "confidence", "why"}
mark = flag + {"status": "contradicted" | "unverified", "severity": "high" | "review" | "info", "absolute": bool}
  contradicted: another doc says otherwise (any claim, absolute or a checkable fact) -> high
  unverified:   an absolute / guarantee nothing contradicts; the firm must still substantiate it -> review
  unverified:   a plain checkable fact (number, date, fee, count) nothing contradicts; keep records -> info
Both spans are exact substrings of their doc's markdown. No passages retrieved -> no LLM call.

CROSSREF_MIN_CONF (default 0.6), CROSSREF_MAX_CLAIMS (default 40), CROSSREF_K (passages, default 6),
CROSSREF_MAX_TOKENS (per call, default 4000), CROSSREF_REASONING (gpt-oss effort, default low).
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from engine import llm
from engine.detect import _first_json, chunks, load_prompt
from engine.postprocess import RX, ground

PROMPTS = Path(__file__).resolve().parent / "prompts"
TOPICS = ("losses", "returns", "guarantees", "conflicts", "fees", "size", "credentials", "regulatory", "other")

# words another document would use when saying the opposite; added to the model's own terms
TOPIC_TERMS = {
    "losses": ["loss", "lost", "declin", "negative", "drawdown", "fell", "down"],
    "returns": ["benchmark", "underperform", "lagged", "trailed", "index", "return"],
    "guarantees": ["guarantee", "insur", "lose value", "principal", "not protected"],
    "conflicts": ["conflict", "12b-1", "revenue shar", "commission", "affiliat", "compensat"],
    "fees": ["fee", "commission", "charge", "%"],
    "size": ["assets under management", "regulatory assets", "million", "billion", "clients", "households"],
    "credentials": ["cfp", "certified", "candidate", "license", "designation"],
    "regulatory": ["disciplinary", "sanction", "finra", "censure", "fine", "order", "settle"],
    "other": [],
}

# backstop for pass 1's `absolute` field: words that make a claim absolute on their own
ABSOLUTE_RX = re.compile(
    r"\b(?:never|always|guarantee[ds]?|guaranteeing|risk[- ]free|no risk|without (?:any )?risk|"
    r"can(?:not|'t) lose|conflict[- ]free|free of (?:any )?conflicts|zero|every|100\s?%|"
    r"consistently|most trusted)\b", re.I)


def _min_conf() -> float:
    return float(os.environ.get("CROSSREF_MIN_CONF", "0.6"))


def _require_llm() -> None:
    llm._load_env()
    if os.environ.get("DETECT_MODE", "auto").lower() == "rules" or not llm.available():
        raise RuntimeError("crossref needs an LLM (DETECT_MODE=rules or no provider configured)")


def _neutralise(text: str, tag: str) -> str:
    return re.sub(rf"<\/?\s*{tag}\s*>", lambda m: m.group(0).replace(tag, tag + "_"), text, flags=re.I)


def _parse(raw: str) -> dict:
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    for cand in (raw, _first_json(raw)):
        if not cand:
            continue
        try:
            data = json.loads(cand)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
        if isinstance(data, list):
            return {"claims": data}
    raise ValueError(f"LLM did not return a JSON object: {raw[:200]!r}")


def _ask(system: str, user: str) -> dict:
    # one retry on a non-JSON reply, then raise (never treated as "no contradiction").
    # reasoning models (gpt-oss) can spend the whole budget thinking and return "": allow more, think less
    kw = {"max_tokens": int(os.environ.get("CROSSREF_MAX_TOKENS", "4000")),
          "reasoning_effort": os.environ.get("CROSSREF_REASONING", "low")}
    try:
        return _parse(llm.complete(system, user, **kw))
    except ValueError:
        return _parse(llm.complete(system, user, **kw))


# ---------------------------------------------------------------- pass 1
def extract_absolutes(docs: list[dict]) -> list[dict]:
    system, user_t = load_prompt(PROMPTS / "absolutes.md")
    claims, seen = [], set()
    for d in docs:
        text = d.get("markdown") or ""
        for ch in chunks(text):
            if not ch.strip():
                continue
            user = user_t.replace("{{url}}", d["url"]).replace("{{page}}", _neutralise(ch, "page_content"))
            for c in _ask(system, user).get("claims", []) or []:
                if not isinstance(c, dict):
                    continue
                span = ground(text, str(c.get("span", "")))
                if not span or (d["url"], span) in seen:
                    continue
                seen.add((d["url"], span))
                topic = c.get("topic") if c.get("topic") in TOPICS else "other"
                terms = [str(t).lower() for t in (c.get("terms") or []) if str(t).strip()][:8]
                absolute = c.get("absolute") is True or bool(ABSOLUTE_RX.search(span))
                claims.append({"span": span, "url": d["url"], "topic": topic, "absolute": absolute,
                               "assertion": str(c.get("assertion") or span)[:300], "terms": terms})
    return claims[: int(os.environ.get("CROSSREF_MAX_CLAIMS", "40"))]


# ---------------------------------------------------------------- retrieval
_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])")


def passages(doc: dict, max_chars: int = 500) -> list[str]:
    """Paragraphs, long ones split into sentence groups. Each is an exact substring of the doc."""
    out = []
    for para in re.split(r"\n\s*\n", doc.get("markdown") or ""):
        para = para.strip()
        if not para:
            continue
        if len(para) <= max_chars:
            out.append(para)
            continue
        buf = ""
        for s in _SENT.split(para):
            if buf and len(buf) + len(s) + 1 > max_chars:
                out.append(buf)
                buf = s
            else:
                buf = f"{buf} {s}" if buf else s
        if buf:
            out.append(buf)
    # sentence regrouping can join on a different whitespace than the source; keep only exact substrings
    text = doc.get("markdown") or ""
    return [p if p in text else (ground(text, p) or p) for p in out]


def _terms(claim: dict) -> list[str]:
    base = list(claim.get("terms") or []) + TOPIC_TERMS.get(claim.get("topic", "other"), [])
    # proper nouns / numbers from the claim itself ("Income Shield", "2022", "$480")
    base += [w.lower() for w in re.findall(r"\b(?:[A-Z][a-z]{3,}|\d[\d,.]*)\b", claim["span"])]
    return sorted({t for t in base if len(t) >= 2})


def retrieve(claim: dict, docs: list[dict], k: int | None = None) -> list[dict]:
    k = k or int(os.environ.get("CROSSREF_K", "6"))
    terms = _terms(claim)
    scored = []
    for d in docs:
        if d["url"] == claim["url"]:
            continue
        for p in passages(d):
            low = p.lower()
            score = sum(1 for t in terms if t in low)
            if score:
                scored.append((score, len(scored), {"url": d["url"], "text": p}))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [s[2] for s in scored[:k]]


# ---------------------------------------------------------------- pass 2
def _boilerplate(evidence: str, claim_span: str) -> bool:
    """A generic risk disclaimer that names nothing specific from the claim never counts."""
    if not RX["disclaimer"].search(evidence):
        return False
    specific = {w.lower() for w in re.findall(r"\b(?:[A-Z][a-z]{3,}|\d{2,}[\d,.]*)\b", claim_span)}
    specific -= {"past", "performance", "investing", "quarrywick", "wealth", "clients", "client", "our"}
    low = evidence.lower()
    return not any(w in low for w in specific) and not re.search(r"\b(?:19|20)\d{2}\b|\d+(?:\.\d+)?%", evidence)


def check(claim: dict, found: list[dict], docs: list[dict], debug: list | None = None) -> dict | None:
    if not found:
        return None
    system, user_t = load_prompt(PROMPTS / "contradict.md")
    block = "\n\n".join(f"[{i}] (from {p['url']})\n{_neutralise(p['text'], 'passages')}"
                        for i, p in enumerate(found, 1))
    user = (user_t.replace("{{claim_url}}", claim["url"]).replace("{{claim_span}}", claim["span"])
                  .replace("{{assertion}}", claim["assertion"]).replace("{{passages}}", block))
    r = _ask(system, user)
    why_drop = None
    try:
        idx, conf = int(r.get("passage") or 0), float(r.get("confidence") or 0)
    except (TypeError, ValueError):
        idx, conf = 0, 0.0
    if not r.get("contradicts"):
        return None
    if not 1 <= idx <= len(found):
        why_drop = "passage number out of range"
    else:
        p = found[idx - 1]
        doc_text = next(d["markdown"] for d in docs if d["url"] == p["url"])
        # the quote must come from the passage the model named, and exist verbatim in that doc
        ev = ground(p["text"], str(r.get("evidence_span", "")))
        ev = ev if ev and ev in doc_text else (ev and ground(doc_text, ev))
        if not ev:
            why_drop = "evidence not an exact quote"
        elif conf < _min_conf():
            why_drop = f"confidence {conf} below threshold"
        elif _boilerplate(ev, claim["span"]):
            why_drop = "generic risk disclaimer"
        else:
            return {"claim_span": claim["span"], "claim_url": claim["url"], "evidence_span": ev,
                    "evidence_url": p["url"], "topic": claim["topic"], "confidence": round(conf, 2),
                    "why": str(r.get("why") or "")[:400], "absolute": bool(claim.get("absolute"))}
    if debug is not None:
        debug.append({"claim": claim["span"], "reason": why_drop, "reply": r})
    return None


def find_contradictions(claims: list[dict], docs: list[dict], debug: list | None = None) -> list[dict]:
    flags: dict[frozenset, dict] = {}
    for c in claims:
        f = check(c, retrieve(c, docs), docs, debug)
        if not f:
            continue
        # A vs B and B vs A are one finding: keep the direction whose claim is the absolute, then the more confident
        key = frozenset({(f["claim_url"], f["claim_span"]), (f["evidence_url"], f["evidence_span"])})
        rank = (f["absolute"], f["confidence"])
        if key not in flags or rank > (flags[key]["absolute"], flags[key]["confidence"]):
            flags[key] = f
    return list(flags.values())


def _overlaps(claim: dict, url: str, span: str) -> bool:
    return claim["url"] == url and (claim["span"] in span or span in claim["span"])


UNVERIFIED_WHY = {
    True: "This is an absolute claim. No other document we checked contradicts it, but the firm "
          "may need to be able to substantiate it.",
    False: "This is a specific checkable fact. No other document we checked contradicts it; the firm "
           "should keep records that support it.",
}


def mark(claims: list[dict], flags: list[dict]) -> list[dict]:
    """Every contradiction (high), plus every claim that took part in none of them:
    absolutes -> review, plain checkable facts -> info."""
    out = [{**f, "status": "contradicted", "severity": "high"} for f in flags]
    for c in claims:
        if any(_overlaps(c, f["claim_url"], f["claim_span"]) or _overlaps(c, f["evidence_url"], f["evidence_span"])
               for f in flags):
            continue
        absolute = bool(c.get("absolute"))
        out.append({"claim_span": c["span"], "claim_url": c["url"], "evidence_span": "", "evidence_url": "",
                    "topic": c["topic"], "confidence": None, "absolute": absolute,
                    "status": "unverified", "severity": "review" if absolute else "info",
                    "why": UNVERIFIED_WHY[absolute]})
    return out


def review(docs: list[dict], debug: list | None = None) -> list[dict]:
    docs = [d for d in docs if (d.get("markdown") or "").strip()]
    if not docs:
        return []
    _require_llm()
    claims = extract_absolutes(docs)
    if debug is not None:
        debug.append({"pass1_claims": [{"url": c["url"], "span": c["span"], "topic": c["topic"],
                                        "absolute": c["absolute"]} for c in claims]})
    # one doc: nothing to cross-reference, but its absolutes are still marked
    flags = find_contradictions(claims, docs, debug) if len(docs) > 1 else []
    return mark(claims, flags)


def crossref(docs: list[dict], debug: list | None = None) -> list[dict]:
    if len([d for d in docs if (d.get("markdown") or "").strip()]) < 2:
        return []
    return [m for m in review(docs, debug) if m["status"] == "contradicted"]


if __name__ == "__main__":
    # python3 -m engine.crossref --demo        (fictional Quarrywick site + docs)
    # python3 -m engine.crossref a.md b.md ...  (url = file name)
    import sys
    args = sys.argv[1:]
    if args == ["--demo"] or not args:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "demo-site" / "docs"))
        from load import load_demo_docs  # type: ignore
        docs = load_demo_docs()
    else:
        docs = [{"url": Path(a).name, "markdown": Path(a).read_text()} for a in args]
    dbg: list = []
    out = review(docs, dbg)
    print(json.dumps({"provider": llm.config()["provider"], "model": llm.config()["model"],
                      "docs": [d["url"] for d in docs], "marks": out, "debug": dbg}, indent=2))
