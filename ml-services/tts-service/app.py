import os
import io
import time
import uuid
import base64
import logging
import soundfile as sf
import numpy as np
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="TTS Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
DEVICE = os.getenv("DEVICE", "cpu")
OUTPUT_DIR = os.getenv("TTS_OUTPUT_DIR", "/app/synthesized")
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"

tts_model = None
Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


class SynthesizeRequest(BaseModel):
    text: str
    language: str
    voice_id: Optional[str] = "default"
    speaker_wav: Optional[str] = None
    speed: Optional[float] = 1.0
    emotion: Optional[str] = None


def get_model():
    global tts_model
    if tts_model is None:
        from TTS.api import TTS

        logger.info(f"Loading XTTS v2 model on {DEVICE}...")
        tts_model = TTS(model_name=MODEL_NAME).to(DEVICE)
        logger.info("XTTS v2 model loaded successfully")
    return tts_model


@app.on_event("startup")
async def startup():
    logger.info("TTS Service starting, pre-loading model...")
    get_model()
    logger.info("TTS Service ready")


@app.get("/ml/tts/health")
async def health():
    get_model()
    return {
        "status": "healthy",
        "models": [
            {
                "type": "tts",
                "name": "xtts_v2",
                "version": "v1",
                "status": "ready",
            }
        ],
        "device": DEVICE,
    }


@app.post("/ml/tts/predict")
async def predict(req: SynthesizeRequest):
    start_time = time.time()

    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if not req.language:
        raise HTTPException(status_code=400, detail="language is required")

    try:
        m = get_model()

        # Map language codes
        lang_map = {
            "hi": "hi", "en": "en", "ta": "ta", "te": "te",
            "bn": "bn", "es": "es", "fr": "fr", "de": "de",
            "ar": "ar", "zh-cn": "zh-cn", "ja": "ja", "ko": "ko",
        }
        lang = lang_map.get(req.language, req.language)

        # Generate audio
        file_id = f"{req.voice_id or 'default'}_{uuid.uuid4().hex[:8]}"
        output_path = os.path.join(OUTPUT_DIR, f"{file_id}.wav")

        if req.speaker_wav and os.path.exists(req.speaker_wav):
            # Voice cloning mode
            m.tts_to_file(
                text=req.text,
                language=lang,
                speaker_wav=req.speaker_wav,
                file_path=output_path,
                speed=req.speed or 1.0,
            )
        else:
            # Default speaker mode
            m.tts_to_file(
                text=req.text,
                language=lang,
                file_path=output_path,
                speed=req.speed or 1.0,
            )

        # Read generated audio
        audio_data, sample_rate = sf.read(output_path)
        duration = len(audio_data) / sample_rate

        # Convert to base64
        wav_buffer = io.BytesIO()
        sf.write(wav_buffer, audio_data, sample_rate, format="WAV")
        wav_buffer.seek(0)
        audio_base64 = base64.b64encode(wav_buffer.read()).decode("utf-8")

        processing_time = time.time() - start_time

        return {
            "audio_path": output_path,
            "audio_url": f"/ml/tts/audio/{file_id}.wav",
            "audio_base64": audio_base64,
            "duration": round(duration, 2),
            "status": "success",
            "meta": {
                "language": req.language,
                "voice_id": req.voice_id or "default",
                "speed": req.speed or 1.0,
                "model": "xtts_v2",
                "version": "v1",
                "char_count": len(req.text),
                "processing_time": round(processing_time, 2),
            },
        }
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/tts/audio/{filename}")
async def get_audio(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/wav")
