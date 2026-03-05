"""Voice pipeline: STT (IndicConformer) → LLM (Groq) → TTS (Cartesia).

Flow:
  1. Upload audio → POST /ml/stt/transcribe (IndicConformer service)
  2. Transcript + detected language → Groq LLM → reply text
  3. Reply text → Cartesia TTS → WAV bytes
  4. Return transcript, reply text, audio (base64 + raw), and metadata
"""
from __future__ import annotations

import base64
import os
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger
from pydantic import BaseModel, Field

from .llm import generate_response
from .tts_cartesia import synthesize as tts_synthesize

STT_SERVICE_URL = os.getenv("STT_SERVICE_URL", "http://localhost:8001")
STT_TRANSCRIBE_PATH = "/ml/stt/transcribe"


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class PipelineRequest(BaseModel):
    language_hint: Optional[str] = Field(
        default=None,
        description="ISO 639-1 hint ('hi', 'en', …). Auto-detected if omitted.",
    )
    system_prompt: Optional[str] = Field(
        default=None,
        description="Custom LLM system prompt. Uses Oolix default if omitted.",
    )
    voice_id: Optional[str] = Field(
        default=None,
        description="Cartesia voice UUID. Falls back to language default.",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for multi-turn conversation history.",
    )


class PipelineResult(BaseModel):
    transcript: str = Field(description="What the user said (STT output).")
    llm_response: str = Field(description="What the AI replied (LLM output).")
    audio_base64: str = Field(description="Base64-encoded WAV audio (TTS output).")
    language: str = Field(description="Detected/used language code.")
    stt_confidence: float
    tts_language: str = Field(description="Language code used for TTS (may differ for unsupported Indic langs).")
    session_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# In-memory conversation history (session_id → message list)
# ---------------------------------------------------------------------------
_sessions: Dict[str, List[dict]] = {}


def _get_history(session_id: str | None) -> List[dict]:
    if session_id and session_id in _sessions:
        return list(_sessions[session_id])  # return copy to prevent external mutation
    return []


def _save_history(session_id: str | None, user_text: str, assistant_text: str) -> None:
    if not session_id:
        return
    history = _sessions.setdefault(session_id, [])
    history.append({"role": "user", "content": user_text})
    history.append({"role": "assistant", "content": assistant_text})
    # Cap at 20 messages (10 turns)
    _sessions[session_id] = history[-20:]


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------

class VoicePipeline:
    """Stateless orchestrator — call `run()` with audio bytes and options."""

    async def _call_stt(self, audio_bytes: bytes, language_hint: str | None) -> dict:
        """POST audio to the IndicConformer STT service."""
        url = STT_SERVICE_URL.rstrip("/") + STT_TRANSCRIBE_PATH
        files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
        data = {}
        if language_hint:
            data["language_hint"] = language_hint

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, files=files, data=data)

        if resp.status_code != 200:
            logger.error("STT service error {}: {}", resp.status_code, resp.text)
            raise RuntimeError(f"STT service error {resp.status_code}: {resp.text}")

        result = resp.json()
        logger.info(
            "STT: {!r} (lang={}, confidence={:.2f}, model={})",
            result["text"][:80],
            result["language"],
            result["confidence"],
            result.get("modelUsed", "?"),
        )
        return result

    async def run(
        self,
        audio_bytes: bytes,
        request: PipelineRequest,
    ) -> PipelineResult:
        """Execute the full STT → LLM → TTS pipeline.

        Args:
            audio_bytes: Raw audio bytes (WAV, MP3, etc.)
            request:     Pipeline options (hint, prompt, voice, session).

        Returns:
            PipelineResult with transcript, reply, audio, and metadata.
        """
        # ── Step 1: STT ──────────────────────────────────────────────────────
        stt = await self._call_stt(audio_bytes, request.language_hint)
        transcript: str = stt["text"]
        language: str = stt["language"]
        stt_confidence: float = stt["confidence"]
        stt_model: str = stt.get("modelUsed") or "indicconformer"

        if not transcript.strip():
            logger.warning("STT returned empty transcript")
            return PipelineResult(
                transcript="",
                llm_response="",
                audio_base64="",
                language=language,
                stt_confidence=0.0,
                tts_language=language,
                session_id=request.session_id,
                meta={"warning": "no_speech_detected"},
            )

        # ── Step 2: LLM ──────────────────────────────────────────────────────
        history = _get_history(request.session_id)
        llm_reply = await generate_response(
            user_text=transcript,
            language=language,
            system_prompt=request.system_prompt,
            history=history,
        )
        _save_history(request.session_id, transcript, llm_reply)

        # ── Step 3: TTS ──────────────────────────────────────────────────────
        audio_bytes_out, tts_lang = await tts_synthesize(
            text=llm_reply,
            language=language,
            voice_id=request.voice_id,
        )
        audio_b64 = base64.b64encode(audio_bytes_out).decode("utf-8")

        meta = {
            "stt_model": stt_model,
            "stt_meta": stt.get("meta", {}),
            "language_hint": request.language_hint,
            "audio_size_bytes": len(audio_bytes_out),
        }

        logger.info(
            "Pipeline complete: transcript={!r} → reply={!r} → {} bytes audio",
            transcript[:60],
            llm_reply[:60],
            len(audio_bytes_out),
        )

        return PipelineResult(
            transcript=transcript,
            llm_response=llm_reply,
            audio_base64=audio_b64,
            language=language,
            stt_confidence=round(stt_confidence, 3),
            tts_language=tts_lang,
            session_id=request.session_id,
            meta=meta,
        )
