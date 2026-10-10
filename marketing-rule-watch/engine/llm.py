"""Provider-agnostic LLM call, stdlib only (no SDK installs needed).

Configure in .env (repo root) or the environment:
  LLM_PROVIDER = anthropic | openai | none      (openai = any OpenAI-compatible chat API)
  LLM_MODEL    = model id for that provider
  LLM_API_KEY  = key (falls back to ANTHROPIC_API_KEY / OPENAI_API_KEY)
  LLM_BASE_URL = optional, for OpenAI-compatible hosts (default https://api.openai.com/v1)

One request per call. No retry loops: credits are finite.
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

_ENV_LOADED = False


def _load_env() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def config() -> dict:
    _load_env()
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    key = os.environ.get("LLM_API_KEY", "")
    if not provider:
        if os.environ.get("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        elif os.environ.get("OPENAI_API_KEY"):
            provider = "openai"
        else:
            provider = "none"
    if not key:
        key = os.environ.get("ANTHROPIC_API_KEY" if provider == "anthropic" else "OPENAI_API_KEY", "")
    default_model = {"anthropic": "claude-sonnet-5-5", "openai": "gpt-4o-mini"}.get(provider, "")
    return {
        "provider": provider if key or provider == "none" else "none",
        "model": os.environ.get("LLM_MODEL", default_model),
        "key": key,
        "base_url": os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
    }


def available() -> bool:
    return config()["provider"] != "none"


def _post(url: str, headers: dict, body: dict, timeout: int = 90) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def complete(system: str, user: str, max_tokens: int = 2000) -> str:
    """Return the model's text reply. Raises if no provider is configured."""
    cfg = config()
    if cfg["provider"] == "anthropic":
        out = _post("https://api.anthropic.com/v1/messages",
                    {"x-api-key": cfg["key"], "anthropic-version": "2023-06-01"},
                    {"model": cfg["model"], "max_tokens": max_tokens, "temperature": 0,
                     "system": system, "messages": [{"role": "user", "content": user}]})
        return "".join(b.get("text", "") for b in out.get("content", []) if b.get("type") == "text")
    if cfg["provider"] == "openai":
        out = _post(f"{cfg['base_url']}/chat/completions",
                    {"Authorization": f"Bearer {cfg['key']}"},
                    {"model": cfg["model"], "max_tokens": max_tokens, "temperature": 0,
                     "messages": [{"role": "system", "content": system},
                                  {"role": "user", "content": user}]})
        return out["choices"][0]["message"]["content"] or ""
    raise RuntimeError("No LLM configured (set LLM_PROVIDER + key in .env). Use DETECT_MODE=rules.")
