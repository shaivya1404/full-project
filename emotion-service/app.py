"""Emotion Service — FastAPI wrapper around emotion2vec+ (port 8003)."""
from __future__ import annotations

import base64
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from loguru import logger
from pydantic import BaseModel

from emotion_service.config import settings
from emotion_service.core.pipeline import EmotionPipeline

app = FastAPI(title="Emotion Service", version="1.0.0")
pipeline: Optional[EmotionPipeline] = None


class AnalyzeRequest(BaseModel):
    # Base64-encoded audio bytes (WAV or raw PCM int16 @ 16kHz)
    audio_b64: str
    sample_rate: int = 16000


class AnalyzeResponse(BaseModel):
    label: str
    score: float
    all_scores: Dict[str, float]


@app.on_event("startup")
async def startup() -> None:
    global pipeline
    logger.info("Loading emotion model ...")
    pipeline = EmotionPipeline(
        device=settings.device,
        model_cache_dir=settings.model_cache_dir,
    )
    logger.info("Emotion service ready")


@app.get("/emotion/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "emotion-service",
        "model_loaded": pipeline is not None and pipeline._model is not None,
    }


@app.post("/emotion/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Emotion pipeline not initialized")

    try:
        audio_bytes = base64.b64decode(req.audio_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio")

    result = pipeline.analyze(audio_bytes, sample_rate=req.sample_rate)
    return AnalyzeResponse(
        label=result.label,
        score=result.score,
        all_scores=result.all_scores,
    )
