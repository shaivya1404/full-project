"""FastAPI application for the IndicConformer STT service."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from loguru import logger
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from common import (  # noqa: E402
    ModelInfo,
    configure_logging,
    get_active_models,
    register_model,
    set_model_status,
    settings,
)

from core import STTPipeline
from core.finetuned_pipeline import IndicConformerFineTunedPipeline


class TimestampSegment(BaseModel):
    start: float
    end: float
    word: str | None = None


class SttTranscribeResponse(BaseModel):
    text: str
    language: str
    confidence: float
    timestamps: List[TimestampSegment]
    meta: Dict[str, Any] = Field(default_factory=dict)
    modelUsed: str | None = None
    status: str = "success"


class StatusResponse(BaseModel):
    status: str
    detail: str
    models: List[Dict[str, Any]] = Field(default_factory=list)


MODEL_NAME = "indicconformer"
MODEL_VERSION = "v1"
pipeline: STTPipeline | None = None

# Fine-tuned IndicConformer checkpoint (.nemo file)
# Set FINETUNED_MODEL_PATH env var to the .nemo checkpoint path
FINETUNED_MODEL_PATH = os.getenv(
    "FINETUNED_MODEL_PATH", "/models/stt/indicconformer-finetuned.nemo"
)
finetuned_pipeline: IndicConformerFineTunedPipeline | None = None

app = FastAPI(title="STT Service — IndicConformer", version="1.0.0")


def _model_path() -> str:
    return f"{settings.model_base_path}/stt/{MODEL_NAME}/{MODEL_VERSION}"


def _register_default_model(
    status: Literal["loading", "ready", "error"] = "ready",
) -> ModelInfo:
    model_info = ModelInfo(
        name=MODEL_NAME,
        type="stt",
        version=MODEL_VERSION,
        status=status,
        path=_model_path(),
        config={"device": settings.device, "provider": "AI4Bharat"},
    )
    return register_model(model_info)


async def _initialize_pipeline() -> None:
    global pipeline
    pipeline = STTPipeline(
        settings=settings, model_name=MODEL_NAME, model_version=MODEL_VERSION
    )
    # Pre-warm NeMo model so first real call doesn't pay the load penalty
    try:
        import asyncio, numpy as np
        dummy = np.zeros(16000, dtype=np.float32)
        loop = asyncio.get_event_loop()
        from core.asr_indic_conformer import transcribe as _warmup
        await loop.run_in_executor(None, _warmup, dummy, "hi")
        logger.info("NeMo model pre-warmed successfully")
    except Exception as e:
        logger.warning("NeMo warmup failed ({}), will load on first request", e)


@app.on_event("startup")
async def startup_event() -> None:
    global finetuned_pipeline
    configure_logging(settings.log_level)
    _register_default_model(status="loading")
    await _initialize_pipeline()
    set_model_status("stt", MODEL_NAME, MODEL_VERSION, "ready", path=_model_path())
    # Load fine-tuned checkpoint if available
    finetuned_pipeline = IndicConformerFineTunedPipeline(
        model_path=FINETUNED_MODEL_PATH, device=settings.device
    )
    if finetuned_pipeline.is_ready:
        logger.info("Fine-tuned IndicConformer loaded from {}", FINETUNED_MODEL_PATH)
    else:
        logger.warning(
            "Fine-tuned model not loaded — /ml/stt/transcribe/finetuned will return 503. "
            "Set FINETUNED_MODEL_PATH to your .nemo checkpoint."
        )
    logger.info("STT service (IndicConformer) started in {} mode", settings.environment)


@app.get("/ml/stt/health", response_model=StatusResponse)
async def health_check() -> StatusResponse:
    models = [model.model_dump() for model in get_active_models("stt")]
    return StatusResponse(status="ok", detail="stt-service healthy (IndicConformer)", models=models)


@app.get("/ml/stt/models")
async def list_models() -> Dict[str, Any]:
    from core.asr_indic_conformer import get_model_info

    return {
        "models": [model.model_dump() for model in get_active_models("stt")],
        "indicconformer": get_model_info(),
    }


@app.post("/ml/stt/initialize", response_model=StatusResponse)
async def initialize_models() -> StatusResponse:
    set_model_status("stt", MODEL_NAME, MODEL_VERSION, "loading")
    await _initialize_pipeline()
    set_model_status("stt", MODEL_NAME, MODEL_VERSION, "ready", path=_model_path())
    models = [model.model_dump() for model in get_active_models("stt")]
    return StatusResponse(status="ok", detail="STT pipeline reinitialized", models=models)


@app.post("/ml/stt/reload", response_model=StatusResponse)
async def reload_models() -> StatusResponse:
    set_model_status("stt", MODEL_NAME, MODEL_VERSION, "loading")
    await asyncio.sleep(0.1)
    await _initialize_pipeline()
    set_model_status("stt", MODEL_NAME, MODEL_VERSION, "ready", path=_model_path())
    models = [model.model_dump() for model in get_active_models("stt")]
    return StatusResponse(status="ok", detail="STT models reloaded", models=models)


@app.post("/ml/stt/transcribe", response_model=SttTranscribeResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language_hint: str | None = Form(default=None),
) -> SttTranscribeResponse:
    """Transcribe using AI4Bharat IndicConformer.

    language_hint: ISO 639-1 code (hi, en, ta, te, bn, mr, gu, kn, ml, pa, or, ur).
    If omitted, MMS LID auto-detects the language from audio.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="STT pipeline not initialized")
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    result = pipeline.transcribe(payload, language_hint)
    timestamps = [TimestampSegment(**segment) for segment in result.timestamps]
    return SttTranscribeResponse(
        text=result.text,
        language=result.language,
        confidence=result.confidence,
        timestamps=timestamps,
        meta=result.meta,
        modelUsed=result.modelUsed,
    )


@app.post("/ml/stt/transcribe/finetuned", response_model=SttTranscribeResponse)
async def transcribe_finetuned(
    file: UploadFile = File(...),
    language_hint: str | None = Form(default=None),
) -> SttTranscribeResponse:
    """Transcribe using your fine-tuned IndicConformer .nemo checkpoint.

    Set FINETUNED_MODEL_PATH env var to the path of your .nemo file.
    Fine-tune using NeMo's speech_to_text_rnnt_bpe.py with
    +init_from_pretrained_model=ai4bharat/indicconformer_stt_hi_hybrid_rnnt_large.
    """
    if finetuned_pipeline is None or not finetuned_pipeline.is_ready:
        raise HTTPException(
            status_code=503,
            detail=(
                "Fine-tuned IndicConformer not loaded. "
                f"Set FINETUNED_MODEL_PATH to a valid .nemo checkpoint. "
                f"Current path: {FINETUNED_MODEL_PATH}"
            ),
        )
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    text, confidence, _ = finetuned_pipeline.transcribe(payload, language_hint)
    return SttTranscribeResponse(
        text=text,
        language=language_hint or "hi",
        confidence=confidence,
        timestamps=[],
        meta={"model": "indicconformer-finetuned", "checkpoint": FINETUNED_MODEL_PATH},
        modelUsed="indicconformer-finetuned",
    )


@app.post("/ml/stt/stream", status_code=501)
async def stream_stub() -> Dict[str, Any]:
    return {
        "status": "not_implemented",
        "detail": "Real-time streaming will be delivered via WebSockets/GRPC in a future phase",
    }
