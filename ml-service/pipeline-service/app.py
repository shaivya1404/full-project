"""FastAPI application — Voice pipeline service (STT → LLM → TTS)."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from loguru import logger
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from common import configure_logging, settings  # noqa: E402
from core import PipelineRequest, PipelineResult, VoicePipeline  # noqa: E402

app = FastAPI(
    title="Voice Pipeline Service — IndicConformer + Groq + Cartesia",
    version="1.0.0",
    description=(
        "End-to-end voice pipeline: audio → IndicConformer STT → Groq LLM → Cartesia TTS → audio"
    ),
)

_pipeline = VoicePipeline()


class HealthResponse(BaseModel):
    status: str
    detail: str
    services: Dict[str, str] = Field(default_factory=dict)


@app.on_event("startup")
async def startup_event() -> None:
    configure_logging(settings.log_level)
    logger.info("Voice pipeline service started")


@app.get("/ml/pipeline/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    import os
    services = {
        "stt": os.getenv("STT_SERVICE_URL", "http://localhost:8001"),
        "llm": f"{os.getenv('LLM_BASE_URL', 'https://api.groq.com/openai/v1')} / {os.getenv('LLM_MODEL', 'llama-3.3-70b-versatile')}",
        "tts": f"cartesia/{os.getenv('CARTESIA_MODEL', 'sonic-3')}",
    }
    return HealthResponse(status="ok", detail="pipeline-service healthy", services=services)


@app.post("/ml/pipeline/voice", response_model=PipelineResult)
async def voice_pipeline(
    file: UploadFile = File(..., description="Audio file (WAV, MP3, FLAC, etc.)"),
    language_hint: str | None = Form(default=None, description="ISO 639-1 language hint"),
    system_prompt: str | None = Form(default=None, description="Custom LLM system prompt"),
    voice_id: str | None = Form(default=None, description="Cartesia voice UUID"),
    session_id: str | None = Form(default=None, description="Session ID for conversation history"),
) -> PipelineResult:
    """Run the full voice pipeline on an uploaded audio file.

    Steps:
    1. IndicConformer STT — transcribes audio, auto-detects language
    2. Groq LLM — generates a conversational reply
    3. Cartesia TTS — synthesizes the reply into speech

    Returns transcript, LLM reply, base64 WAV audio, and metadata.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty")

    request = PipelineRequest(
        language_hint=language_hint,
        system_prompt=system_prompt,
        voice_id=voice_id,
        session_id=session_id,
    )

    try:
        result = await _pipeline.run(audio_bytes, request)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return result


@app.delete("/ml/pipeline/session/{session_id}")
async def clear_session(session_id: str) -> Dict[str, Any]:
    """Clear conversation history for a session."""
    from core.pipeline import _sessions
    existed = session_id in _sessions
    _sessions.pop(session_id, None)
    return {"session_id": session_id, "cleared": existed}


@app.get("/ml/pipeline/session/{session_id}")
async def get_session(session_id: str) -> Dict[str, Any]:
    """Retrieve conversation history for a session."""
    from core.pipeline import _sessions
    history = _sessions.get(session_id, [])
    return {"session_id": session_id, "turns": len(history) // 2, "history": history}
