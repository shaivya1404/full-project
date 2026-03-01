"""HTTP client to emotion-service on :8003."""
from __future__ import annotations

import base64

import httpx
from loguru import logger

from agent.config import settings


class EmotionClient:
    def __init__(self) -> None:
        self._base = settings.emotion_service_url
        self._client = httpx.AsyncClient(timeout=5.0)

    async def analyze(self, audio_bytes: bytes, sample_rate: int = 16000) -> dict:
        """Returns {"label": str, "score": float, "all_scores": dict}."""
        try:
            audio_b64 = base64.b64encode(audio_bytes).decode()
            resp = await self._client.post(
                f"{self._base}/emotion/analyze",
                json={"audio_b64": audio_b64, "sample_rate": sample_rate},
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.error("Emotion request failed: {}", exc)
            return {"label": "neutral", "score": 1.0, "all_scores": {"neutral": 1.0}}

    async def close(self) -> None:
        await self._client.aclose()
