import os
import io
import time
import tempfile
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="STT Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model config
MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "large-v3")
DEVICE = os.getenv("DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("COMPUTE_TYPE", "int8")  # int8 for CPU, float16 for GPU

model = None


def get_model():
    global model
    if model is None:
        logger.info(f"Loading Whisper model: {MODEL_SIZE} on {DEVICE} ({COMPUTE_TYPE})")
        model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        logger.info("Whisper model loaded successfully")
    return model


@app.on_event("startup")
async def startup():
    logger.info("STT Service starting, pre-loading model...")
    get_model()
    logger.info("STT Service ready")


@app.get("/ml/stt/health")
async def health():
    m = get_model()
    return {
        "status": "healthy",
        "models": [
            {
                "type": "stt",
                "name": f"whisper_{MODEL_SIZE}",
                "version": "v1",
                "status": "ready",
            }
        ],
        "device": DEVICE,
    }


@app.post("/ml/stt/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language_hint: str = Form(None),
):
    start_time = time.time()

    # Read audio file
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(audio_bytes) > 30 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 30MB)")

    # Write to temp file (faster-whisper needs a file path)
    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        m = get_model()
        segments, info = m.transcribe(
            tmp_path,
            language=language_hint if language_hint else None,
            word_timestamps=True,
            beam_size=5,
        )

        # Collect results
        full_text = ""
        timestamps = []
        for segment in segments:
            full_text += segment.text
            if segment.words:
                for word in segment.words:
                    timestamps.append(
                        {
                            "start": round(word.start, 2),
                            "end": round(word.end, 2),
                            "word": word.word.strip(),
                        }
                    )

        duration = time.time() - start_time

        return {
            "text": full_text.strip(),
            "language": info.language,
            "confidence": round(info.language_probability, 2),
            "timestamps": timestamps,
            "meta": {
                "duration_seconds": round(info.duration, 2),
                "quality_score": round(info.language_probability, 2),
                "language_detected": info.language,
                "model_name": f"whisper_{MODEL_SIZE}",
                "processing_time": round(duration, 2),
            },
            "modelUsed": f"whisper_{MODEL_SIZE}:faster-whisper",
            "status": "success",
        }
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)
