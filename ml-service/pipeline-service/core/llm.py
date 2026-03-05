"""Qwen LLM client for the voice pipeline (via Groq or any OpenAI-compatible endpoint)."""
from __future__ import annotations

import os
import re
from typing import List

import httpx
from loguru import logger

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen/qwen3-32b")

# Keep voice responses short and speakable
MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "256"))

# Strip Qwen3 chain-of-thought blocks before returning the reply
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)

_DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful voice AI assistant for Oolix.in call centre. "
    "Give concise, conversational answers (1-3 sentences max). "
    "No markdown, no bullet points — plain spoken text only. "
    "CRITICAL: Respond ONLY in the same language the user spoke in. "
    "If the user spoke Hindi or Hinglish, reply in Hindi/Hinglish. "
    "If the user spoke English, reply in English."
)


async def generate_response(
    user_text: str,
    language: str,
    system_prompt: str | None = None,
    history: List[dict] | None = None,
) -> str:
    """Call Qwen (via Groq) and return the assistant reply.

    Args:
        user_text:     Transcribed user utterance.
        language:      Detected language code (e.g. "hi", "en").
        system_prompt: Optional override for the system prompt.
        history:       Prior turn messages [{role, content}, ...].

    Returns:
        Assistant reply as plain text (Qwen3 <think> blocks stripped).
    """
    if not LLM_API_KEY:
        raise RuntimeError(
            "LLM_API_KEY is not set. Export it before starting the pipeline service."
        )

    sys_prompt = system_prompt or _DEFAULT_SYSTEM_PROMPT
    messages: List[dict] = [{"role": "system", "content": sys_prompt}]
    if history:
        messages.extend(history[-10:])  # keep last 5 turns
    messages.append({"role": "user", "content": user_text})

    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "max_tokens": MAX_TOKENS,
        "temperature": 0.7,
    }
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    url = f"{LLM_BASE_URL.rstrip('/')}/chat/completions"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers=headers)

    if resp.status_code != 200:
        logger.error("LLM error {}: {}", resp.status_code, resp.text)
        raise RuntimeError(f"LLM API error {resp.status_code}: {resp.text}")

    data = resp.json()
    raw: str = data["choices"][0]["message"]["content"]
    # Strip Qwen3 chain-of-thought <think>…</think> blocks
    reply = _THINK_RE.sub("", raw).strip()
    usage = data.get("usage", {})
    logger.info(
        "LLM reply ({} tokens, model={}): {!r}",
        usage.get("completion_tokens", "?"),
        LLM_MODEL,
        reply[:120],
    )
    return reply
