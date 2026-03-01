"""Cartesia TTS streaming client.

Model : sonic-2 (Cartesia's latest, low-latency)
Output: raw PCM, 16kHz, 16-bit signed, mono
Docs  : https://docs.cartesia.ai/api-reference/tts/sse
"""
from __future__ import annotations

from typing import AsyncGenerator

from loguru import logger

from agent.config import settings


class TTSClient:
    def __init__(self) -> None:
        self._api_key = settings.cartesia_api_key
        self._model_id = settings.cartesia_model_id
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        try:
            from cartesia import AsyncCartesia  # type: ignore
            self._client = AsyncCartesia(api_key=self._api_key)
            logger.info("Cartesia client ready (model={})", self._model_id)
        except ImportError:
            logger.warning("cartesia package not installed — TTS unavailable")
            self._client = None

    async def synthesize_stream(
        self,
        text: str,
        voice_id: str,
        language: str = "en",
    ) -> AsyncGenerator[bytes, None]:
        """Stream raw PCM audio from Cartesia.

        Args:
            text     : Text to speak.
            voice_id : Cartesia voice ID stored in Company.voice_id.
            language : 'en' or 'hi'.

        Yields:
            Raw PCM bytes — 16kHz, 16-bit signed, mono.
        """
        if self._client is None:
            logger.error("Cartesia client not initialized")
            return

        output_format = {
            "container": "raw",
            "encoding": "pcm_s16le",
            "sample_rate": 16000,
        }

        # voice must be {"mode": "id", "id": "<voice_id>"}
        voice = {"mode": "id", "id": voice_id}

        try:
            # .sse() is an async generator — do NOT await it
            async for chunk in self._client.tts.sse(
                model_id=self._model_id,
                transcript=text,
                voice=voice,
                output_format=output_format,
                language=language,
            ):
                if chunk.audio:
                    yield chunk.audio

        except Exception as exc:
            logger.error("Cartesia TTS error: {}", exc)

    async def close(self) -> None:
        if self._client:
            await self._client.close()
