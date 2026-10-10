"""Regex layer. Two uses:

  hints(text)       -> short cue list passed to the LLM (hints only, never flags on their own)
  rule_candidates() -> candidate flags for the no-LLM fallback detector (DETECT_MODE=rules)

The fallback exists so the pipeline and eval run without a key, and as a safety net in the
app. It was written with the seeded cases in view: trust its eval/cases_holdout.jsonl score
more than its eval/cases.jsonl score.
"""
from __future__ import annotations

import re

from engine.postprocess import RX, blanket_testimonial_disclosure, testimonial_unit

_SENT_END = re.compile(r"[.!?]+(?=\s|$)|\n+")
_CLAUSE_SPLIT = re.compile(r",\s+|;\s+|:\s+|\s+(?:--|-|—|–)\s+|\s+and\s+")
_FIGURE = re.compile(r"[+-]?\d+(?:\.\d+)?\s?%|\$\s?\d|\b\d+x\b|\breturn", re.I)


def sentences(text: str) -> list[tuple[int, int]]:
    """(start, end) of each sentence, trimmed of whitespace and terminal punctuation."""
    out, s = [], 0
    for m in list(_SENT_END.finditer(text)) + [None]:
        e = m.start() if m else len(text)
        a, b = s, e
        while a < b and text[a].isspace():
            a += 1
        while b > a and text[b - 1].isspace():
            b -= 1
        if b > a:
            out.append((a, b))
        if m is None:
            break
        s = m.end()
    return out


def clause_at(text: str, sent: tuple[int, int], pos: int) -> tuple[int, int]:
    s, e = sent
    a = s
    for m in _CLAUSE_SPLIT.finditer(text, s, e):
        if m.start() >= pos:
            return a, m.start()
        a = m.end()
    return a, e


CUES = {
    "BENEFITS_WITHOUT_RISK": re.compile(
        r"\bguarantee[sd]?\b|\brisk[- ]free\b|\bno risk\b|\bwithout risk\b|\bnever (?:lost|lose[sd]?)\b"
        r"|\bcan(?:'|no)?t lose\b|\bzero (?:worries|risk)\b|\bworry[- ]free\b|\bno downside\b"
        r"|\bfully protected\b|\bsafe bet\b"
        r"|\bnever (?:had|seen|posted|suffered) a (?:losing|down|negative)\b", re.I),
    "UNSUBSTANTIATED_CLAIM": re.compile(
        r"#\s?1\b|\bnumber one\b|\bthe best (?:in|advisor|firm|financial|wealth|investment)\b"
        r"|\boutperform\w*|\bbeat(?:s|en|ing)? the (?:market|s&p|index|benchmark)"
        r"|\beliminat\w* (?:emotional|all risk|risk|errors|mistakes|losses)|\bpredicts? (?:the )?market"
        r"|\bbefore they happen\b", re.I),
    "HYPOTHETICAL_PERFORMANCE": re.compile(
        r"\bwould have (?:returned|grown|earned|made|gained|avoided|beaten|outperformed|delivered)\b"
        r"|\bback-?test\w*|\bhypothetical\b|\bsimulated\b|\bmodel portfolio\b", re.I),
    "UNFAIR_PERFORMANCE_PRESENTATION": re.compile(
        r"\b(?:since|from) the [^.,;]{0,25}?\b(?:low|lows|bottom|trough)\b"
        r"|\bbest (?:year|quarter|month|day|trade)s?\b", re.I),
    "RATING_NO_DISCLOSURE": re.compile(
        r"\bnamed (?:a |one of the |as a |as one of the )?(?:top|best)\b|\branked #?\d+|\btop[- ]rated\b"
        r"|\baward[- ]winning\b|\bvoted (?:[\w']+ ){0,3}(?:best|top|#\s?1)\b|\brecognized (?:by|as) [^.]{0,40}\btop\b"
        r"|\b(?:five|5)[- ]star (?:rated|advisor|firm|wealth|financial)", re.I),
    "GROSS_WITHOUT_NET": re.compile(r"\bgross\b", re.I),
}
ADVICE_ACT = re.compile(r"\b(?:we|i)\s+(?:put clients in(?:to)?|told clients to buy|recommended|bought|picked|added)\b", re.I)
ADVICE_GAIN = re.compile(r"\b(?:doubled|tripled|quadrupled|soared|skyrocketed|surged)\b|\bup \d+%|\b\d+x\b", re.I)
QUOTE = re.compile(r"[\"“][^\"”]{15,300}[\"”]")
ATTRIB_AFTER = re.compile(r"\s*,?\s*(?:says|said|wrote|writes|--|-|—|–)", re.I)
REVIEW = re.compile(r"reposted from|from our (?:yelp|google|facebook)|\breviews? (?:on|from)\b|\b(?:five|5) stars?\b|★", re.I)
ENDORSE = re.compile(r"\b(?:she|he|they) (?:says|said|swears|recommends)\b[^.!?]*", re.I)
HINT_EXTRA = {
    "review / star language": REVIEW,
    "third-party endorsement": ENDORSE,
    "net figure present": re.compile(r"\bnet\b", re.I),
    "disclosure language present": re.compile(r"current client|compensat|methodolog|rating date|not representative|past performance", re.I),
}


def quote_hints(text: str) -> list[str]:
    """Per quote: does it carry its OWN client-status + compensation disclosure? A page-wide
    "disclosure present" cue made the model treat a neighbour's disclosure as covering every quote."""
    blanket = blanket_testimonial_disclosure(text)
    out = []
    for m in QUOTE.finditer(text):
        unit = testimonial_unit(text, m.start(), m.end())
        if RX["client_status"].search(unit) and RX["compensation"].search(unit):
            label = "quoted text with its own client/compensation disclosure"
        elif blanket:
            label = "quoted text covered by a page-wide testimonial disclosure"
        else:
            label = "TESTIMONIAL_NO_DISCLOSURE? quoted text with NO disclosure of its own"
        out.append(f'{label}: "{m.group(0)[:80]}"')
    return out


def hints(text: str, limit: int = 25) -> list[str]:
    out = []
    for cat, rx in CUES.items():
        for m in rx.finditer(text):
            out.append(f'{cat}? cue "{m.group(0)}"')
    out += quote_hints(text)
    for label, rx in HINT_EXTRA.items():
        for m in rx.finditer(text):
            out.append(f'{label}: "{m.group(0)[:80]}"')
    for s, e in sentences(text):
        if ADVICE_ACT.search(text, s, e) and ADVICE_GAIN.search(text, s, e):
            out.append(f'UNBALANCED_SPECIFIC_ADVICE? cue "{text[s:e][:80]}"')
    seen, uniq = set(), []
    for h in out:
        if h not in seen:
            seen.add(h)
            uniq.append(h)
    return uniq[:limit]


def _flag(cat, text, a, b, conf):
    return {"category": cat, "span": text[a:b].strip(), "confidence": conf, "why": ""}


def rule_candidates(text: str) -> list[dict]:
    out: list[dict] = []
    sents = sentences(text)
    for k, sent in enumerate(sents):
        s, e = sent
        st = text[s:e]
        has_fig = bool(_FIGURE.search(st))

        # promises without risk: union of the clauses holding a cue
        ms = list(CUES["BENEFITS_WITHOUT_RISK"].finditer(text, s, e))
        if ms:
            spans = [clause_at(text, sent, m.start()) for m in ms]
            out.append(_flag("BENEFITS_WITHOUT_RISK", text, min(x[0] for x in spans), max(x[1] for x in spans), 0.7))

        for m in CUES["UNSUBSTANTIATED_CLAIM"].finditer(text, s, e):
            a, b = clause_at(text, sent, m.start())
            out.append(_flag("UNSUBSTANTIATED_CLAIM", text, a, b, 0.6))

        m = CUES["HYPOTHETICAL_PERFORMANCE"].search(text, s, e)
        if m and has_fig:
            wh = re.compile(r"\bwould have\b", re.I).search(text, s, e)
            out.append(_flag("HYPOTHETICAL_PERFORMANCE", text, (wh or m).start(), e, 0.7))

        m = CUES["UNFAIR_PERFORMANCE_PRESENTATION"].search(text, s, e)
        if m and has_fig:
            start = m.start() if m.group(0).lower().startswith("best") else s
            out.append(_flag("UNFAIR_PERFORMANCE_PRESENTATION", text, start, e, 0.7))

        rs = [clause_at(text, sent, m.start()) for m in CUES["RATING_NO_DISCLOSURE"].finditer(text, s, e)]
        if rs:
            out.append(_flag("RATING_NO_DISCLOSURE", text, min(r[0] for r in rs), max(r[1] for r in rs), 0.7))

        # gross: union of the clauses that hold "gross" and a figure
        gs = [clause_at(text, sent, m.start()) for m in CUES["GROSS_WITHOUT_NET"].finditer(text, s, e)]
        gs = [g for g in gs if _FIGURE.search(text, g[0], g[1])]
        if gs:
            out.append(_flag("GROSS_WITHOUT_NET", text, min(g[0] for g in gs), max(g[1] for g in gs), 0.8))

        # a specific pick, with the gain in the same or the next sentence
        if ADVICE_ACT.search(text, s, e):
            nxt = sents[k + 1] if k + 1 < len(sents) else None
            if ADVICE_GAIN.search(text, s, e):
                out.append(_flag("UNBALANCED_SPECIFIC_ADVICE", text, s, e, 0.7))
            elif nxt and ADVICE_GAIN.search(text, nxt[0], nxt[1]):
                out.append(_flag("UNBALANCED_SPECIFIC_ADVICE", text, s, nxt[1], 0.7))

        for m in ENDORSE.finditer(text, s, e):
            out.append(_flag("TESTIMONIAL_NO_DISCLOSURE", text, m.start(), m.end(), 0.8))

    # testimonials: attributed quotes
    for m in QUOTE.finditer(text):
        if ATTRIB_AFTER.match(text, m.end()):
            out.append(_flag("TESTIMONIAL_NO_DISCLOSURE", text, m.start(), m.end(), 0.8))
    # testimonials: reposted reviews (line-level: text after "Source:" up to "-- Name")
    for line in re.finditer(r"[^\n]+", text):
        if not REVIEW.search(line.group(0)):
            continue
        a, b = line.start(), line.end()
        c = text.find(": ", a, b)
        if c >= 0:
            a = c + 2
        cut = re.compile(r"\s+(?:--|-|—|–)\s+[A-Z]").search(text, a, b)
        if cut:
            b = cut.start()
        if b - a >= 10 and not QUOTE.search(text, a, b):
            out.append(_flag("TESTIMONIAL_NO_DISCLOSURE", text, a, b, 0.8))
    return [f for f in out if f["span"]]
