"""Steps applied to every candidate flag, whatever produced it (LLM or rules).

1. validate   - known category, non-empty span, confidence clamped to [0, 1]
2. ground     - span must be an EXACT substring of the text; small quote/whitespace/case
                drift is repaired to the original substring, anything else is dropped
3. suppress   - drop flags whose required disclosure is already in the same chunk,
                and anything inside a standard risk disclaimer
4. dedupe     - overlapping flags: keep the higher-confidence one
5. threshold  - drop below min_conf

Mirror of this logic for Base44 lives in engine/port/postprocess.js. Keep them in sync.
"""
from __future__ import annotations

import re

from engine.taxonomy import TAXONOMY

# ---------------------------------------------------------------- grounding
_TRANS = str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'",
                        "–": "-", "—": "-", " ": " "})


def _normalize_with_map(s: str) -> tuple[str, list[int]]:
    """Lowercase, straighten quotes, collapse whitespace; keep a map back to original indices."""
    out, idx, prev_space = [], [], False
    for i, ch in enumerate(s.translate(_TRANS)):
        if ch.isspace():
            if prev_space:
                continue
            ch, prev_space = " ", True
        else:
            prev_space = False
        out.append(ch.lower())
        idx.append(i)
    return "".join(out), idx


# Last-resort normalization: drop every non-letter/digit, so a span that omits the page's
# markdown syntax (> ** _ ` #) or adds separators still grounds on the same word sequence.
def _word_map(s: str) -> tuple[str, list[int]]:
    out, idx, prev_space = [], [], True  # leading syntax emits no leading space
    for i, ch in enumerate(s.translate(_TRANS)):
        if ch.isalnum():
            out.append(ch.lower())
            idx.append(i)
            prev_space = False
        elif not prev_space:
            out.append(" ")
            idx.append(i)  # boundary position; only mid-match use
            prev_space = True
    return "".join(out), idx


# A word-matched slice may absorb markdown/quotes glued to its edges ("> ", "**", an opening
# quote) so the raw find covers the decorated region. Sentence punctuation is right-only:
# expanding left over '.' would eat a previous sentence's full stop. Newlines always bound.
_EDGE_LEFT = set(" \t>#*_`\"'“”‘’([{")
_EDGE_RIGHT = set(".!?\"'”’)]}*_`")


def ground(text: str, span: str) -> str | None:
    """Return the exact substring of `text` that `span` refers to, or None."""
    if not span or not span.strip():
        return None
    if span in text:
        return span
    span = span.strip().strip(".")
    if span and span in text:
        return span
    nt, idx = _normalize_with_map(text)
    ns, _ = _normalize_with_map(span)
    ns = ns.strip()
    i = nt.find(ns) if ns else -1
    if i >= 0:
        return text[idx[i]: idx[i + len(ns) - 1] + 1]
    wt, wi = _word_map(text)
    ws, _ = _word_map(span)
    ws = ws.strip()
    k = wt.find(ws) if ws else -1
    if k < 0:
        return None
    a, b = wi[k], wi[k + len(ws) - 1] + 1
    while a > 0 and text[a - 1] in _EDGE_LEFT:
        a -= 1
    while a < b and text[a] in " \t":
        a += 1
    while b < len(text) and text[b] in _EDGE_RIGHT:
        b += 1
    return text[a:b]


# ---------------------------------------------------------------- suppression
_SENT_END = re.compile(r"[.!?]+(?=\s|$)|\n+")


def sentence_around(text: str, start: int, end: int) -> str:
    s = 0
    for m in _SENT_END.finditer(text):
        if m.end() <= start:
            s = m.end()
        elif m.start() >= end:
            return text[s:m.end()]
    return text[s:]


RX = {
    "client_status": re.compile(r"current client|former client|not a client|is a client|a client of|non-client|clients? since", re.I),
    "compensation": re.compile(r"compensat|\bpaid\b|\bunpaid\b|received no|did not receive|no payment", re.I),
    "rating_method": re.compile(r"methodolog|based on|survey|criteria", re.I),
    "rating_date": re.compile(r"rating date|as of|dated|\((?:19|20)\d\d\)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (?:19|20)\d\d", re.I),
    "rating_paid": re.compile(r"\bpaid\b|compensat|licensing fee|fee to use", re.I),
    "net": re.compile(r"\bnet\b", re.I),
    "neg_guarantee": re.compile(r"\b(?:not|no|cannot|can't|never|nor|nothing)\b[^.!?]{0,30}\b(?:guarantee|risk[- ]free)", re.I),
    "neg_hypo": re.compile(r"\b(?:do not|don't|does not|never|no)\b[^.!?]{0,25}\b(?:publish|show|present|provide|use|offer)|\b(?:upon|on) request\b", re.I),
    "advice_balanced": re.compile(r"including (?:those|ones|picks|recommendations|positions) that (?:lost|declined|fell|underperformed)|full list of (?:our |all )?(?:recommendations|picks)", re.I),
    "disclaimer": re.compile(r"past performance (?:does not|is not|cannot|may not|is no)|involves? risk|possible loss of principal|risk of loss", re.I),
    # language shown as an example of what not to say, or quoted regulation (Tester B, Check 1:
    # "verify that it was, in fact, legitimately an advertisement")
    "example_frame": re.compile(
        r"\b(?:a|an|another|some|other|many) (?:firm|adviser|advisor|manager|ad|advertisement)s? "
        r"(?:might|may|could|would|that|who|which) (?:say|claim|promise|write|advertise|tout|call)"
        r"|\b(?:firms|advisers|advisors|managers|ads) (?:that|who|which) (?:say|claim|promise|advertise|tout)"
        r"|\b(?:phrases|claims|language|wording|words|statements|promises) (?:like|such as)\b"
        r"|\bwatch (?:out )?for\b|\bred flags?\b|\b(?:avoid|never|don't|do not) (?:say|saying|use|using)\b"
        r"|\b(?:the )?(?:SEC|Marketing Rule|Rule 206\(4\)-1|rule) (?:prohibits|bans|forbids|says|states|requires)\b"
        r"|\bmay not include\b|\bexamples? of (?:misleading|prohibited|non-compliant|problematic)", re.I),
    "first_person": re.compile(r"\b(?:we|our|us|I|my)\b", re.I),
    # a hand-picked start/window: standard periods elsewhere on the page don't excuse it
    "cherry_window": re.compile(r"\b(?:since|from|off) the [^.,;]{0,25}?\b(?:low|lows|bottom|trough)\b"
                                r"|\bbest (?:\d+|two|three|four|five|six|seven|eight|nine|ten) (?:years|quarters|months)\b"
                                r"|\bbest (?:year|quarter|month|day|trade)s?\b", re.I),
}


def _periods_1_5_10(chunk: str) -> bool:
    return all(re.search(rf"\b{n}[- ]?(?:year|yr)s?\b|\b{n} years?\b|\b{w}[- ]year", chunk, re.I)
               for n, w in (("1", "one"), ("5", "five"), ("10", "ten")))


_OPEN_QUOTE = re.compile(r'(?:^|(?<=[\s\u2605]))"|\u201c', re.M)


def testimonial_unit(chunk: str, start: int, end: int) -> str:
    """The text that belongs to one testimonial: its line up to the span, then on to the next
    opening quote or paragraph break. A neighbour's disclosure must not clear this one."""
    a = chunk.rfind("\n", 0, start) + 1
    pb = chunk.find("\n\n", end)
    q = _OPEN_QUOTE.search(chunk, end)
    b = min([x for x in (pb, q.start() if q else -1) if x >= 0], default=len(chunk))
    return chunk[a:b]


def blanket_testimonial_disclosure(chunk: str) -> bool:
    """One sentence that covers all testimonials/reviews on the page."""
    for m in re.finditer(r"[^.!?\n]*(?:testimonials|reviews|endorsements)\b[^.!?\n]*[.!?]?", chunk, re.I):
        if RX["client_status"].search(m.group(0)) and RX["compensation"].search(m.group(0)):
            return True
    return False


_QUOTED = re.compile(r'"[^"]*"|\u201c[^\u201d]*\u201d')


def _quoted_in(sent: str, span: str) -> bool:
    return any(span in q.group(0) for q in _QUOTED.finditer(sent))


def presented_as_example(sent: str, span: str) -> bool:
    """Example/education framing, and the span is quoted or isn't the firm speaking (we/our)."""
    if not RX["example_frame"].search(sent):
        return False
    return _quoted_in(sent, span) or not RX["first_person"].search(_QUOTED.sub("", span))


def suppressed(chunk: str, flag: dict) -> str | None:
    """Return a reason string if the flag should be dropped, else None."""
    cat, span = flag["category"], flag["span"]
    i = chunk.find(span)
    sent = sentence_around(chunk, i, i + len(span)) if i >= 0 else span
    # disclosures must sit near the claim, not anywhere on the page
    near = chunk[max(0, i - 150): i + len(span) + 350] if i >= 0 else chunk
    if RX["disclaimer"].search(sent) and not re.search(r"\bwe guarantee|\bguaranteed (?:returns?|income)", sent, re.I):
        return "inside a standard risk disclaimer"
    if presented_as_example(sent, span):
        return "example or quoted rule, not the firm's own claim"
    if cat == "TESTIMONIAL_NO_DISCLOSURE":
        unit = testimonial_unit(chunk, i, i + len(span)) if i >= 0 else span
        if (RX["client_status"].search(unit) and RX["compensation"].search(unit)) or blanket_testimonial_disclosure(chunk):
            return "client status and compensation disclosed"
    if cat == "RATING_NO_DISCLOSURE" and RX["rating_method"].search(near) and (
            RX["rating_date"].search(near) or RX["rating_paid"].search(near)):
        return "rating methodology and date/payment disclosed"
    if cat == "GROSS_WITHOUT_NET" and RX["net"].search(near):
        return "net performance shown"
    if cat == "UNFAIR_PERFORMANCE_PRESENTATION" and _periods_1_5_10(near) and not RX["cherry_window"].search(sent):
        return "1/5/10-year periods shown"
    if cat == "BENEFITS_WITHOUT_RISK" and RX["neg_guarantee"].search(sent) and not re.search(r"\bwe guarantee", sent, re.I):
        return "negated guarantee (disclaimer)"
    if cat == "HYPOTHETICAL_PERFORMANCE" and RX["neg_hypo"].search(sent):
        return "hypothetical not presented / only on request"
    if cat == "UNBALANCED_SPECIFIC_ADVICE" and RX["advice_balanced"].search(near):
        return "balanced list of recommendations offered"
    return None


# ---------------------------------------------------------------- pipeline
def _overlap(a: tuple[int, int], b: tuple[int, int]) -> float:
    inter = max(0, min(a[1], b[1]) - max(a[0], b[0]))
    return inter / max(1, min(a[1] - a[0], b[1] - b[0]))


def postprocess(chunk: str, candidates: list[dict], min_conf: float = 0.5,
                debug: list | None = None) -> list[dict]:
    kept: list[tuple[tuple[int, int], dict]] = []
    for c in candidates:
        cat = str(c.get("category", "")).strip().upper()
        if cat not in TAXONOMY:
            _log(debug, c, "unknown category")
            continue
        span = ground(chunk, str(c.get("span") or ""))
        if span is None:
            _log(debug, c, "ungrounded span")
            continue
        try:
            conf = min(1.0, max(0.0, float(c.get("confidence", 0.5))))
        except (TypeError, ValueError):
            conf = 0.5
        f = {"category": cat, "span": span, "rule": TAXONOMY[cat]["rule"], "confidence": conf,
             "why": str(c.get("why") or TAXONOMY[cat]["desc"]).strip()}
        if conf < min_conf:
            _log(debug, f, f"below threshold {min_conf}")
            continue
        reason = suppressed(chunk, f)
        if reason:
            _log(debug, f, reason)
            continue
        i = chunk.find(span)
        loc = (i, i + len(span))
        clash = next((k for k in kept if _overlap(k[0], loc) > 0.5), None)
        if clash:
            if clash[1]["confidence"] >= conf:
                _log(debug, f, f"overlaps {clash[1]['category']}")
                continue
            kept.remove(clash)
            _log(debug, clash[1], f"overlaps {cat}")
        kept.append((loc, f))
    return [f for _, f in sorted(kept, key=lambda k: k[0][0])]


def _log(debug, flag, reason):
    if debug is not None:
        debug.append({"dropped": {"category": flag.get("category"), "span": flag.get("span")}, "reason": reason})
