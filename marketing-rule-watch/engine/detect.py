"""detect(text, channel="") -> list[Flag]

Pipeline per chunk: regex hints -> LLM (prompts/detect.md) -> postprocess
(validate, ground, suppress, dedupe, threshold).

DETECT_MODE (env / .env):
  auto  (default) LLM if one is configured, else rules
  llm   LLM only; raises if none is configured
  rules regex fallback only, no LLM call
DETECT_MIN_CONF: confidence threshold (default 0.5; pick it from eval results)
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from engine import llm
from engine.postprocess import postprocess
from engine.rules import hints, rule_candidates

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "detect.md"
CHUNK_CHARS = 6000


def load_prompt(path: Path = PROMPT_PATH) -> tuple[str, str]:
    raw = re.sub(r"<!--.*?-->", "", path.read_text(), flags=re.S)
    _, _, rest = raw.partition("=== SYSTEM ===")
    system, _, user = rest.partition("=== USER ===")
    return system.strip(), user.strip()


def chunks(text: str, size: int = CHUNK_CHARS) -> list[str]:
    """Split on paragraph boundaries; each chunk is an exact substring of text."""
    if len(text) <= size:
        return [text]
    out, start = [], 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):
            cut = text.rfind("\n\n", start, end)
            if cut <= start:
                cut = text.rfind("\n", start, end)
            if cut > start:
                end = cut
        out.append(text[start:end])
        start = end
    return out


def build_messages(chunk: str, channel: str) -> tuple[str, str]:
    system, user_t = load_prompt()
    h = hints(chunk)
    # page text is data: neutralise any attempt to close our delimiter early
    page = chunk.replace("</page_content>", "</page_content_>")
    user = (user_t.replace("{{channel}}", channel or "unknown")
                  .replace("{{hints}}", "\n".join(f"- {x}" for x in h) or "- none")
                  .replace("{{page}}", page))
    return system, user


def parse_flags(raw: str) -> list[dict]:
    """Accept {"flags": [...]}, a bare list, or either wrapped in prose / code fences."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    for cand in (raw, _first_json(raw)):
        if not cand:
            continue
        try:
            data = json.loads(cand)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            data = data.get("flags", [])
        if isinstance(data, list):
            return [d for d in data if isinstance(d, dict)]
    raise ValueError(f"LLM did not return JSON flags: {raw[:200]!r}")


def _first_json(s: str) -> str | None:
    m = re.search(r"[\[{]", s)
    if not m:
        return None
    opener = s[m.start()]
    closer = "}" if opener == "{" else "]"
    end = s.rfind(closer)
    return s[m.start(): end + 1] if end > m.start() else None


def _mode() -> str:
    llm._load_env()
    mode = os.environ.get("DETECT_MODE", "auto").lower()
    if mode == "auto":
        return "llm" if llm.available() else "rules"
    return mode


def detect(text: str, channel: str = "", debug: list | None = None) -> list[dict]:
    if not text or not text.strip():
        return []
    min_conf = float(os.environ.get("DETECT_MIN_CONF", "0.5"))
    mode = _mode()
    flags: list[dict] = []
    for ch in chunks(text):
        if mode == "rules":
            cands = rule_candidates(ch)
        else:
            system, user = build_messages(ch, channel)
            cands = parse_flags(llm.complete(system, user))
        flags.extend(postprocess(ch, cands, min_conf=min_conf, debug=debug))
    return flags



# the eval harness looks for rewrite() in the detector's module
from engine.rewrite import rewrite  # noqa: E402,F401


if __name__ == "__main__":
    import sys
    txt = sys.stdin.read()
    dbg: list = []
    print(json.dumps({"mode": _mode(), "flags": detect(txt, sys.argv[1] if len(sys.argv) > 1 else "", dbg),
                      "dropped": dbg}, indent=2))

