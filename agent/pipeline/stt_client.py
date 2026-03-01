"""HTTP client to the STT service on :8002.

Two endpoints available:
  /ml/stt/transcribe       — Faster-Whisper large-v3 (high accuracy, slower)
  /ml/stt/transcribe/lora  — Whisper Small + LoRA fine-tuned (Indian accent, faster)

The agent uses the LoRA endpoint by default since it was trained specifically
for Indian accent English + Hindi. Falls back to large-v3 if LoRA is unavailable.
"""
from __future__ import annotations

import io

import httpx
from loguru import logger

from agent.config import settings

_LORA_PATH = "/ml/stt/transcribe/lora"
_FALLBACK_PATH = "/ml/stt/transcribe"


class STTClient:
    def __init__(self) -> None:
        self._base = settings.stt_service_url
        self._client = httpx.AsyncClient(timeout=10.0)
        self._use_lora = True  # start with LoRA, auto-fallback if unavailable

    async def transcribe(self, audio_bytes: bytes, language_hint: str | None = None) -> dict:
        """Transcribe audio bytes. Uses LoRA model, falls back to large-v3.

        Returns:
            {"text": str, "confidence": float, "language": str}
        """
        path = _LORA_PATH if self._use_lora else _FALLBACK_PATH
        result = await self._call(path, audio_bytes, language_hint)

        # If LoRA returned empty (model not loaded), fall back to large-v3
        if self._use_lora and not result.get("text"):
            logger.warning("LoRA model unavailable, falling back to Faster-Whisper large-v3")
            self._use_lora = False
            result = await self._call(_FALLBACK_PATH, audio_bytes, language_hint)

        return result

    async def _call(self, path: str, audio_bytes: bytes, language_hint: str | None) -> dict:
        try:
            files = {"file": ("audio.wav", io.BytesIO(audio_bytes), "audio/wav")}
            data = {}
            if language_hint:
                data["language_hint"] = language_hint

            resp = await self._client.post(
                f"{self._base}{path}",
                files=files,
                data=data,
            )
            if resp.status_code == 503:
                return {"text": "", "confidence": 0.0, "language": "en"}
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.error("STT request to {} failed: {}", path, exc)
            return {"text": "", "confidence": 0.0, "language": "en"}

    async def close(self) -> None:
        await self._client.aclose()
