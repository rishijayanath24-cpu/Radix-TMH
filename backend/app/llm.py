"""
Provider-agnostic LLM adapter.

One function — `complete_json(system, user)` — returns a parsed JSON dict from
whichever provider is configured via LLM_PROVIDER:

    groq   -> Groq cloud (OpenAI-compatible)   [default, free & fast]
    openai -> OpenAI
    grok   -> xAI / Grok (OpenAI-compatible)
    anthropic -> Claude
    local  -> returns None  (caller then uses the offline heuristic extractor)

If a key is missing or a call fails, we return None instead of raising, so the
app degrades gracefully to the local extractor and the demo never hard-crashes.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env regardless of the current working directory.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PROVIDER = os.getenv("LLM_PROVIDER", "groq").strip().lower()

# OpenAI-compatible providers: (env key name, default model, base_url)
_OPENAI_COMPATIBLE = {
    "groq":   ("GROQ_API_KEY",   "llama-3.3-70b-versatile", "https://api.groq.com/openai/v1"),
    "openai": ("OPENAI_API_KEY", "gpt-4o-mini",             None),
    "grok":   ("XAI_API_KEY",    "grok-3",                  "https://api.x.ai/v1"),
}


def provider_status() -> dict:
    """Small diagnostic used by the /health endpoint."""
    if PROVIDER == "local":
        return {"provider": "local", "ready": True, "model": "heuristic"}
    if PROVIDER == "anthropic":
        return {
            "provider": "anthropic",
            "ready": bool(os.getenv("ANTHROPIC_API_KEY")),
            "model": os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
        }
    if PROVIDER in _OPENAI_COMPATIBLE:
        key_env, default_model, _ = _OPENAI_COMPATIBLE[PROVIDER]
        model_env = f"{PROVIDER.upper()}_MODEL" if PROVIDER != "grok" else "XAI_MODEL"
        return {
            "provider": PROVIDER,
            "ready": bool(os.getenv(key_env)),
            "model": os.getenv(model_env, default_model),
        }
    return {"provider": PROVIDER, "ready": False, "model": None}


@lru_cache(maxsize=1)
def _openai_client():
    from openai import OpenAI
    key_env, _, base_url = _OPENAI_COMPATIBLE[PROVIDER]
    api_key = os.getenv(key_env)
    if not api_key:
        return None
    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)


@lru_cache(maxsize=1)
def _anthropic_client():
    from anthropic import Anthropic
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return Anthropic(api_key=api_key)


def _extract_json(text: str) -> dict | None:
    """Best-effort: parse a JSON object out of a model response."""
    if not text:
        return None
    text = text.strip()
    # strip ```json fences if present
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # fall back to the first {...} block
    start, depth = text.find("{"), 0
    if start == -1:
        return None
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def complete_json(system: str, user: str, *, max_tokens: int = 2048) -> dict | None:
    """
    Ask the configured LLM to reply with a single JSON object and return it
    parsed. Returns None on any failure (missing key, network error, bad JSON)
    so callers can fall back to the local heuristic extractor.
    """
    if PROVIDER == "local":
        return None

    try:
        if PROVIDER in _OPENAI_COMPATIBLE:
            client = _openai_client()
            if client is None:
                return None
            _, default_model, _ = _OPENAI_COMPATIBLE[PROVIDER]
            model_env = "XAI_MODEL" if PROVIDER == "grok" else f"{PROVIDER.upper()}_MODEL"
            model = os.getenv(model_env, default_model)
            resp = client.chat.completions.create(
                model=model,
                temperature=0,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            return _extract_json(resp.choices[0].message.content or "")

        if PROVIDER == "anthropic":
            client = _anthropic_client()
            if client is None:
                return None
            model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            resp = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=0,
                system=system + "\n\nReply with ONLY a single valid JSON object, no prose.",
                messages=[{"role": "user", "content": user}],
            )
            parts = [b.text for b in resp.content if getattr(b, "type", None) == "text"]
            return _extract_json("".join(parts))

    except Exception as exc:  # noqa: BLE001 — degrade gracefully, never crash the request
        print(f"[llm] {PROVIDER} call failed, falling back to local: {exc}")
        return None

    return None
