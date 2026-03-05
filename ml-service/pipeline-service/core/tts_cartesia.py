"""Cartesia TTS client for the voice pipeline.

Uses the same env vars as backend/pipeline/server.py:
  CARTESIA_API_KEY, CARTESIA_VOICE_ID, CARTESIA_MODEL
"""
from __future__ import annotations

import os
from typing import Tuple

import httpx
from loguru import logger

CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "")
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID", "")
CARTESIA_MODEL = os.getenv("CARTESIA_MODEL", "sonic-3")
CARTESIA_VERSION = "2025-04-16"
CARTESIA_TTS_URL = "https://api.cartesia.ai/tts/bytes"

# Languages Cartesia supports natively; everything else falls back to "hi"
_CARTESIA_SUPPORTED = {
    "en", "hi", "de", "fr", "es", "pt", "zh", "ja",
    "it", "ko", "nl", "pl", "ru", "sv", "tr",
}


def _cartesia_lang(lang: str) -> str:
    """Map IndicConformer language codes to Cartesia-supported codes.

    Indic languages not in Cartesia's list (ta, te, kn, ml, bn, gu…) fall
    back to Hindi so the voice sounds natural rather than garbled.
    """
    return lang if lang in _CARTESIA_SUPPORTED else "hi"


async def synthesize(
    text: str,
    language: str,
    voice_id: str | None = None,
    sample_rate: int = 16000,
) -> Tuple[bytes, str]:
    """Call Cartesia TTS and return (raw_pcm_bytes, cartesia_language).

    Returns raw PCM s16le at ``sample_rate`` Hz (same format as server.py).

    Args:
        text:        Text to synthesize.
        language:    ISO 639-1 language code from STT.
        voice_id:    Optional Cartesia voice UUID override.
        sample_rate: Output sample rate (default 16000).

    Returns:
        Tuple of (raw PCM bytes, resolved cartesia language code).
    """
    if not CARTESIA_API_KEY:
        raise RuntimeError(
            "CARTESIA_API_KEY is not set. Add it to your .env file."
        )
    if not CARTESIA_VOICE_ID and not voice_id:
        raise RuntimeError(
            "CARTESIA_VOICE_ID is not set. Add it to your .env file."
        )

    cartesia_lang = _cartesia_lang(language)
    resolved_voice = voice_id or CARTESIA_VOICE_ID

    payload = {
        "model_id": CARTESIA_MODEL,
        "transcript": text,
        "voice": {"mode": "id", "id": resolved_voice},
        "language": cartesia_lang,
        "output_format": {
            "container": "raw",
            "encoding": "pcm_s16le",
            "sample_rate": sample_rate,
        },
    }
    headers = {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": CARTESIA_VERSION,
        "Content-Type": "application/json",
    }

    logger.info(
        "Cartesia TTS: {} chars, lang={}->{}, voice={}, model={}",
        len(text), language, cartesia_lang, resolved_voice, CARTESIA_MODEL,
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(CARTESIA_TTS_URL, json=payload, headers=headers)

    if resp.status_code != 200:
        logger.error("Cartesia error {}: {}", resp.status_code, resp.text)
        raise RuntimeError(f"Cartesia API error {resp.status_code}: {resp.text}")

    audio_bytes = resp.content
    logger.info("Cartesia TTS: received {} bytes ({} Hz PCM s16le)", len(audio_bytes), sample_rate)
    return audio_bytes, cartesia_lang
