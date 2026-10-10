"""rewrite(text, flags) -> str, and rewrite_report() for the app's "flags cleared n/m".

The LLM (prompts/rewrite.md) returns span-level edits {find, replace}; this code applies them, so
nothing outside the edited spans can change. Without an LLM, per-category templates are used.
Unknown facts are [BRACKETED PLACEHOLDERS] for a human to fill; the app should block "Approve"
while any remain (has_placeholders()).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from engine import llm
from engine.postprocess import ground, sentence_around, testimonial_unit

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "rewrite.md"
PLACEHOLDER = re.compile(r"\[[A-Z][A-Z0-9 /_,.'-]*\]")

# no-LLM fallback: (where, text). where: "span" replace it, "after" append to it, "sentence" replace
# its sentence, "unit_end" append after the testimonial and its attribution
TEMPLATES = {
    "UNSUBSTANTIATED_CLAIM": ("span", "[REVISE: a claim the firm can support, or remove]"),
    "BENEFITS_WITHOUT_RISK": ("span", "[REVISE: state the goal, not a promise]; returns are not guaranteed and you can lose money"),
    "UNBALANCED_SPECIFIC_ADVICE": ("after", ". A list of all our recommendations from [PERIOD], including those that lost value, is available at [LINK]"),
    "UNFAIR_PERFORMANCE_PRESENTATION": ("span", "Returns were [X]% (1 year), [Y]% (5 years) and [Z]% (10 years), net of fees, as of [DATE]"),
    "GROSS_WITHOUT_NET": ("after", " ([NET]% net of fees)"),
    "HYPOTHETICAL_PERFORMANCE": ("sentence", "Hypothetical results are available on request to investors for whom they are relevant, with their assumptions and risks."),
    "TESTIMONIAL_NO_DISCLOSURE": ("unit_end", " [NAME] is a [CURRENT CLIENT / NOT A CLIENT] and [WAS NOT COMPENSATED / RECEIVED COMPENSATION] for this statement."),
    "RATING_NO_DISCLOSURE": ("after", " (rating date: [DATE]; based on [METHODOLOGY]; the firm [DID / DID NOT] pay to be considered)"),
}


def has_placeholders(text: str) -> bool:
    return bool(PLACEHOLDER.search(text))


def apply_edits(text: str, edits: list[dict]) -> tuple[str, list[dict]]:
    """Apply non-overlapping {find, replace} edits whose `find` grounds in text. Returns (new, applied)."""
    located = []
    for e in edits:
        find = ground(text, str(e.get("find") or ""))
        if find is None:
            continue
        i = text.find(find)
        located.append((i, i + len(find), str(e.get("replace", "")), e))
    located.sort(key=lambda x: x[0])
    applied, last_end = [], -1
    for a, b, rep, e in located:
        if a < last_end:
            continue  # overlaps an earlier edit
        applied.append((a, b, rep, e))
        last_end = b
    out = text
    for a, b, rep, _ in reversed(applied):
        out = out[:a] + rep + out[b:]
    return out, [e for *_, e in applied]


def template_edits(text: str, flags: list[dict]) -> list[dict]:
    edits = []
    for k, f in enumerate(flags):
        span = ground(text, f.get("span", ""))
        where, tpl = TEMPLATES.get(f.get("category"), (None, None))
        if span is None or where is None:
            continue
        i = text.find(span)
        if where == "span":
            edits.append({"flag": k, "find": span, "replace": tpl})
        elif where == "after":
            edits.append({"flag": k, "find": span, "replace": span + tpl})
        elif where == "unit_end":
            unit = testimonial_unit(text, i, i + len(span)).rstrip()
            tail = text[i: text.find(unit) + len(unit)] if text.find(unit) >= 0 else span
            edits.append({"flag": k, "find": tail, "replace": tail + tpl})
        else:
            sent = sentence_around(text, i, i + len(span)).strip()
            edits.append({"flag": k, "find": sent, "replace": tpl})
    return edits


def _load_prompt() -> tuple[str, str]:
    raw = re.sub(r"<!--.*?-->", "", PROMPT_PATH.read_text(), flags=re.S)
    system, _, user = raw.partition("=== SYSTEM ===")[2].partition("=== USER ===")
    return system.strip(), user.strip()


def llm_edits(text: str, flags: list[dict]) -> list[dict]:
    system, user_t = _load_prompt()
    listing = "\n".join(f'{k}: {f.get("category")} | "{f.get("span")}" | {f.get("why", "")}' for k, f in enumerate(flags))
    user = (user_t.replace("{{flags}}", listing)
                  .replace("{{page}}", text.replace("</page_content>", "</page_content_>")))
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", llm.complete(system, user).strip())
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
    edits = data.get("edits", []) if isinstance(data, dict) else data
    return [e for e in edits if isinstance(e, dict)]


def rewrite(text: str, flags: list[dict]) -> str:
    if not flags:
        return text
    edits = llm_edits(text, flags) if llm.available() else template_edits(text, flags)
    return apply_edits(text, edits)[0]


def rewrite_report(text: str, flags: list[dict], channel: str = "") -> dict:
    """What the rewrite drawer shows: suggested text, flags cleared n/m, open placeholders."""
    from engine.detect import detect  # local import: detect.py re-exports rewrite
    new = rewrite(text, flags)
    again = detect(new, channel)
    before = {(f["category"], f["span"]) for f in flags}
    still = sum(1 for f in again if f["category"] in {c for c, _ in before})
    return {"suggested_text": new, "flags_total": len(flags), "flags_cleared": max(0, len(flags) - still),
            "placeholders": PLACEHOLDER.findall(new), "new_flags": again}
