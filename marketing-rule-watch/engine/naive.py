"""Naive wrapper: the detector someone builds in an afternoon. A comparison baseline, not a product path.

Same LLM, model and temperature as engine.detect (engine.llm.complete), but none of our pipeline:
one call for the whole page, a short prompt (category list only: no examples, hints, channel or
untrusted-data delimiters), and the model's flags returned as-is: no grounding, suppression,
dedupe or confidence threshold. `python3 eval/suite.py versus` scores it against engine.detect.
"""
from __future__ import annotations

from engine import llm
from engine.detect import parse_flags
from engine.taxonomy import TAXONOMY

SYSTEM = ("You are a compliance assistant. Find statements in this investment adviser's marketing text that may "
          "break the SEC Marketing Rule (Rule 206(4)-1). Use these categories:\n"
          + "\n".join(f"- {k}: {v['desc']}" for k, v in TAXONOMY.items())
          + '\nReply with JSON only: {"flags": [{"category": "...", "span": "exact quote from the text", '
            '"confidence": 0.0-1.0}]}. Return {"flags": []} if there are none.')


def detect(text: str, channel: str = "") -> list[dict]:
    if not text or not text.strip():
        return []
    flags = parse_flags(llm.complete(SYSTEM, text))
    for f in flags:
        f.setdefault("rule", TAXONOMY.get(f.get("category"), {}).get("rule"))
    return flags
