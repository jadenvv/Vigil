"""Provider-agnostic LLM call, stdlib only (no SDK installs needed).

Configure in .env (repo root) or the environment:
  LLM_PROVIDER = groq | anthropic | openai | none   (openai = any OpenAI-compatible chat API)
  LLM_MODEL    = model id for that provider
  LLM_API_KEY  = key (falls back to GROQ_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY)
  LLM_BASE_URL = optional override (defaults: groq https://api.groq.com/openai/v1, openai https://api.openai.com/v1)

One request per call. No retry loops: credits are finite.
"""
from __future__ import annotations

import json
import os
import ssl
import time
import urllib.error
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
        if os.environ.get("GROQ_API_KEY"):
            provider = "groq"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        elif os.environ.get("OPENAI_API_KEY"):
            provider = "openai"
        else:
            provider = "none"
    if not key:
        key = os.environ.get({"groq": "GROQ_API_KEY", "anthropic": "ANTHROPIC_API_KEY"}.get(provider, "OPENAI_API_KEY"), "")
    default_model = {"groq": "openai/gpt-oss-120b", "anthropic": "claude-sonnet-5-5",
                     "openai": "gpt-4o-mini"}.get(provider, "")
    default_base = "https://api.groq.com/openai/v1" if provider == "groq" else "https://api.openai.com/v1"
    return {
        "provider": provider if key or provider == "none" else "none",
        "model": os.environ.get("LLM_MODEL", default_model),
        "key": key,
        "base_url": os.environ.get("LLM_BASE_URL", default_base).rstrip("/"),
    }


def available() -> bool:
    return config()["provider"] != "none"


def _ssl_context() -> ssl.SSLContext:
    """Use certifi's CA bundle when installed: python.org builds on macOS ship without one."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def _post(url: str, headers: dict, body: dict, timeout: int = 90) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "User-Agent": "marketing-rule-watch/1.0", **headers})
    # Groq's free tier is 8k tokens/min: on 429 wait out retry-after (at least 15s, since a short retry-after
    # often isn't enough for a ~5k-token request), at most 5 tries, then raise. A retry-after over 60s or
    # x-should-retry: false is the daily token cap (200k/model): raise at once instead of waiting it out
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            wait = float(e.headers.get("retry-after") or 20)
            if (e.code != 429 or attempt == 4 or wait > 60
                    or str(e.headers.get("x-should-retry", "")).lower() == "false"):
                raise
            time.sleep(max(wait, 15) + 1)


def complete(system: str, user: str, max_tokens: int = 2000, reasoning_effort: str | None = None) -> str:
    """Return the model's text reply. Raises if no provider is configured.
    reasoning_effort (low|medium|high) is sent only to reasoning models that take it (gpt-oss, o-series)."""
    cfg = config()
    if cfg["provider"] == "anthropic":
        out = _post("https://api.anthropic.com/v1/messages",
                    {"x-api-key": cfg["key"], "anthropic-version": "2023-06-01"},
                    {"model": cfg["model"], "max_tokens": max_tokens, "temperature": 0,
                     "system": system, "messages": [{"role": "user", "content": user}]})
        return "".join(b.get("text", "") for b in out.get("content", []) if b.get("type") == "text")
    if cfg["provider"] in ("openai", "groq"):
        body = {"model": cfg["model"], "max_tokens": max_tokens, "temperature": 0,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        if reasoning_effort and ("gpt-oss" in cfg["model"] or cfg["model"].startswith("o")):
            body["reasoning_effort"] = reasoning_effort
        out = _post(f"{cfg['base_url']}/chat/completions", {"Authorization": f"Bearer {cfg['key']}"}, body)
        return out["choices"][0]["message"]["content"] or ""
    raise RuntimeError("No LLM configured (set LLM_PROVIDER + key in .env). Use DETECT_MODE=rules.")
