"""crossref(docs) -> list[ContradictionFlag]

Two passes over a firm's documents (site pages, old blog posts, its Form ADV):
  1. extract_absolutes: per doc, the LLM lists absolute / checkable claims (prompts/absolutes.md).
     Each span is grounded in the doc; ungrounded claims are dropped.
  2. find_contradictions: per claim, cheap keyword retrieval picks passages from the OTHER docs;
     one LLM call (prompts/contradict.md) says whether any passage contradicts the claim.
     The evidence span is grounded in its doc; generic risk boilerplate never counts.

doc  = {"url": str, "markdown": str}
flag = {"claim_span", "claim_url", "evidence_span", "evidence_url", "topic", "confidence", "why"}
Both spans are exact substrings of their doc's markdown. No passages retrieved -> no LLM call.

CROSSREF_MIN_CONF (default 0.6), CROSSREF_MAX_CLAIMS (default 40), CROSSREF_K (passages, default 6).
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
    # one retry on a non-JSON reply, then raise (never treated as "no contradiction")
    try:
        return _parse(llm.complete(system, user))
    except ValueError:
        return _parse(llm.complete(system, user))


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
                claims.append({"span": span, "url": d["url"], "topic": topic,
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
                    "why": str(r.get("why") or "")[:400]}
    if debug is not None:
        debug.append({"claim": claim["span"], "reason": why_drop, "reply": r})
    return None


def find_contradictions(claims: list[dict], docs: list[dict], debug: list | None = None) -> list[dict]:
    flags = []
    for c in claims:
        f = check(c, retrieve(c, docs), docs, debug)
        if f:
            flags.append(f)
    return flags


def crossref(docs: list[dict], debug: list | None = None) -> list[dict]:
    docs = [d for d in docs if (d.get("markdown") or "").strip()]
    if len(docs) < 2:
        return []
    _require_llm()
    claims = extract_absolutes(docs)
    if debug is not None:
        debug.append({"pass1_claims": [{"url": c["url"], "span": c["span"], "topic": c["topic"]} for c in claims]})
    return find_contradictions(claims, docs, debug)


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
    out = crossref(docs, dbg)
    print(json.dumps({"provider": llm.config()["provider"], "docs": [d["url"] for d in docs],
                      "flags": out, "debug": dbg}, indent=2))
