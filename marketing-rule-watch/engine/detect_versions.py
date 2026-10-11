"""engine.detect with the prompt pinned to a frozen version, so a v3-vs-v4 eval stays comparable after detect.md moves on.

    python3 eval/compliance_eval.py --detector engine.detect_versions:detect_v3
    python3 eval/compliance_eval.py --detector engine.detect_versions:detect_v4

Same pipeline (chunking, hints, grounding, suppression, threshold) as engine.detect; only the prompt file differs.
prompts/detect_v3.md is detect.md before 851f64e; prompts/detect_v4.md is detect.md at 851f64e. Never edit them:
add detect_v5.md and a detect_v5 here instead. Not thread-safe (swaps engine.detect.load_prompt per call).
"""
from __future__ import annotations

from pathlib import Path

from engine import detect as D

PROMPTS = Path(__file__).resolve().parent / "prompts"
_load = D.load_prompt


def _pinned(version: str):
    path = PROMPTS / f"detect_{version}.md"
    if not path.is_file():
        raise FileNotFoundError(path)

    def detect(text: str, channel: str = "", debug: list | None = None) -> list[dict]:
        D.load_prompt = lambda p=None: _load(path)
        try:
            return D.detect(text, channel, debug)
        finally:
            D.load_prompt = _load
    detect.__name__ = f"detect_{version}"
    detect.prompt_path = path
    return detect


detect_v3 = _pinned("v3")
detect_v4 = _pinned("v4")
# No rewrite on purpose: the harness's rewrite check costs 2 more detect calls + 1 rewrite per caught case.
# Rewrites are scored separately (eval/suite.py rewrite).
rewrite = None
