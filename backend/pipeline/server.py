"""
Custom Voice AI Pipeline Server
================================
WebSocket server that handles the full voice AI pipeline:
  Silero-VAD v5 → Whisper Small+LoRA → emotion2vec+ → Qwen → Cartesia Sonic 3

Protocol (JSON over WebSocket):
  Node.js → Python:
    { "type": "config",  "session": { callId, teamId, campaignId, callType, caller } }
    { "type": "audio",   "payload": "<base64 mulaw 8kHz>" }
    { "type": "text",    "text": "..." }   // inject text as user utterance
    { "type": "close" }

  Python → Node.js:
    { "type": "ready" }
    { "type": "audio",      "payload": "<base64 mulaw 8kHz>" }  // TTS output
    { "type": "transcript", "role": "user"|"assistant", "text": "..." }
    { "type": "emotion",    "emotion": "...", "score": 0.0-1.0 }
    { "type": "error",      "message": "..." }

Usage:
  pip install -r pipeline/requirements.txt
  python pipeline/server.py

Environment variables:
  PIPELINE_HOST            = 0.0.0.0  (default)
  PIPELINE_PORT            = 8765     (default)
  WHISPER_MODEL            = small    (default, or path to fine-tuned model)
  QWEN_BASE_URL            = http://localhost:11434/v1  (Ollama or compatible)
  QWEN_MODEL               = qwen2.5:7b
  CARTESIA_API_KEY         = <required>
  CARTESIA_VOICE_ID        = <required>
  CARTESIA_MODEL           = sonic-2024-10-19  (default)
"""

import asyncio
import base64
import json
import logging
import os
import struct
import tempfile
import wave
from typing import Optional

import numpy as np
import websockets
import websockets.server

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("pipeline")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
HOST = os.getenv("PIPELINE_HOST", "0.0.0.0")
PORT = int(os.getenv("PIPELINE_PORT", "8765"))
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", "http://localhost:11434/v1")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen2.5:7b")
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "")
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID", "")
CARTESIA_MODEL = os.getenv("CARTESIA_MODEL", "sonic-2024-10-19")

# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------
MULAW_BIAS = 33
MULAW_CLIP = 32635

def mulaw_decode(mulaw_bytes: bytes) -> np.ndarray:
    """Decode 8-bit μ-law to 16-bit signed PCM samples (numpy int16 array)."""
    samples = np.frombuffer(mulaw_bytes, dtype=np.uint8).astype(np.int32)
    samples = ~samples
    sign = samples & 0x80
    exponent = (samples >> 4) & 0x07
    mantissa = samples & 0x0F
    magnitude = ((mantissa << 1) + 33) << exponent
    pcm = np.where(sign != 0, -magnitude, magnitude).astype(np.int16)
    return pcm


def mulaw_encode(pcm: np.ndarray) -> bytes:
    """Encode 16-bit PCM samples to 8-bit μ-law bytes."""
    pcm = pcm.astype(np.int32)
    sign = np.where(pcm < 0, 0x80, 0x00)
    pcm = np.abs(pcm)
    pcm = np.clip(pcm, 0, MULAW_CLIP)
    pcm += MULAW_BIAS
    exp = np.floor(np.log2(np.maximum(pcm, 1))).astype(np.int32)
    exp = np.clip(exp - 5, 0, 7)
    mantissa = (pcm >> (exp + 1)) & 0x0F
    ulaw = ~(sign | (exp << 4) | mantissa)
    return ulaw.astype(np.uint8).tobytes()


def resample_8k_to_16k(pcm8k: np.ndarray) -> np.ndarray:
    """Naive 2× upsample from 8kHz to 16kHz (linear interpolation)."""
    out = np.empty(len(pcm8k) * 2, dtype=np.float32)
    out[0::2] = pcm8k.astype(np.float32)
    out[1::2] = pcm8k.astype(np.float32)
    # Linear interpolate between samples
    out[1:-1:2] = (out[0:-2:2] + out[2::2]) / 2.0
    return out


def resample_16k_to_8k(pcm16k: np.ndarray) -> np.ndarray:
    """Naive 2× downsample from 16kHz to 8kHz (every other sample)."""
    return pcm16k[::2]


def pcm_to_wav_bytes(pcm: np.ndarray, sample_rate: int) -> bytes:
    """Convert PCM numpy array to WAV bytes in memory."""
    import io
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # int16
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.astype(np.int16).tobytes())
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Model loaders (lazy, loaded once at startup)
# ---------------------------------------------------------------------------
_silero_model = None
_silero_utils = None
_whisper_model = None
_emotion_pipeline = None


def load_models():
    global _silero_model, _silero_utils, _whisper_model, _emotion_pipeline

    log.info("Loading Silero-VAD v5...")
    import torch
    _silero_model, _silero_utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        onnx=False,
        trust_repo=True,
    )
    log.info("Silero-VAD loaded.")

    log.info(f"Loading Whisper model: {WHISPER_MODEL_NAME} ...")
    import whisper
    _whisper_model = whisper.load_model(WHISPER_MODEL_NAME)
    log.info("Whisper loaded.")

    log.info("Loading emotion2vec+ ...")
    try:
        from modelscope.pipelines import pipeline as ms_pipeline
        from modelscope.utils.constant import Tasks
        _emotion_pipeline = ms_pipeline(
            task=Tasks.emotion_recognition,
            model="iic/emotion2vec_plus_large",
        )
        log.info("emotion2vec+ loaded.")
    except Exception as e:
        log.warning(f"emotion2vec+ could not be loaded ({e}). Emotion detection disabled.")
        _emotion_pipeline = None


# ---------------------------------------------------------------------------
# Cartesia TTS
# ---------------------------------------------------------------------------
async def cartesia_tts(text: str) -> bytes:
    """Call Cartesia Sonic 3 API and return raw PCM audio bytes (16kHz, int16)."""
    import aiohttp

    url = "https://api.cartesia.ai/tts/bytes"
    headers = {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
    }
    payload = {
        "model_id": CARTESIA_MODEL,
        "transcript": text,
        "voice": {"mode": "id", "id": CARTESIA_VOICE_ID},
        "output_format": {
            "container": "raw",
            "encoding": "pcm_s16le",
            "sample_rate": 16000,
        },
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"Cartesia error {resp.status}: {body}")
            return await resp.read()


# ---------------------------------------------------------------------------
# Qwen LLM (via OpenAI-compatible API — Ollama or vLLM)
# ---------------------------------------------------------------------------
async def qwen_chat(messages: list[dict], system_prompt: str) -> str:
    """Call Qwen via OpenAI-compatible /chat/completions endpoint."""
    import aiohttp

    url = f"{QWEN_BASE_URL.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    payload = {
        "model": QWEN_MODEL,
        "messages": full_messages,
        "temperature": 0.7,
        "max_tokens": 200,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"Qwen error {resp.status}: {body}")
            data = await resp.json()
            return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Per-connection session
# ---------------------------------------------------------------------------
class PipelineSession:
    SAMPLE_RATE = 8000
    SILENCE_THRESHOLD_MS = 600   # ms of silence to trigger STT
    CHUNK_BYTES = 160             # 20ms of mulaw @ 8kHz

    def __init__(self, ws):
        self.ws = ws
        self.session_params: dict = {}
        self.system_prompt = "You are a helpful voice AI assistant. Be concise and natural."
        self.conversation: list[dict] = []

        # VAD state
        self._audio_pcm_buffer = np.array([], dtype=np.float32)
        self._speech_chunks: list[np.ndarray] = []
        self._in_speech = False
        self._silence_frames = 0
        self._silence_threshold_frames = int(self.SILENCE_THRESHOLD_MS / 20)  # 20ms per frame

    async def send(self, msg: dict):
        await self.ws.send(json.dumps(msg))

    async def handle_config(self, session: dict):
        self.session_params = session
        call_type = session.get("callType", "inbound")
        caller = session.get("caller", "caller")

        if call_type == "inbound":
            self.system_prompt = (
                f"You are a helpful voice AI assistant for Oolix. "
                f"The caller is {caller}. Be concise and natural. "
                "Answer questions and assist the caller professionally."
            )
        else:
            self.system_prompt = (
                f"You are an outbound sales AI assistant for Oolix. "
                f"You are calling {caller}. Be polite, professional, and helpful."
            )

        log.info(f"[Session] Configured for call {session.get('callId')} ({call_type})")
        await self.send({"type": "ready"})

    async def handle_audio(self, base64_payload: str):
        """Process incoming mulaw 8kHz audio through VAD → STT pipeline."""
        mulaw_bytes = base64.b64decode(base64_payload)
        pcm16 = mulaw_decode(mulaw_bytes)

        # Normalize to float32 in [-1, 1] for Silero
        pcm_float = pcm16.astype(np.float32) / 32768.0
        self._audio_pcm_buffer = np.concatenate([self._audio_pcm_buffer, pcm_float])

        # Silero-VAD runs on 512-sample chunks at 16kHz (or 256 at 8kHz)
        # We use 8kHz mode (chunk size 256 or 512)
        chunk_size = 256  # 32ms at 8kHz
        import torch
        while len(self._audio_pcm_buffer) >= chunk_size:
            chunk = self._audio_pcm_buffer[:chunk_size]
            self._audio_pcm_buffer = self._audio_pcm_buffer[chunk_size:]

            tensor = torch.from_numpy(chunk).unsqueeze(0)
            speech_prob = _silero_model(tensor, self.SAMPLE_RATE).item()

            if speech_prob > 0.5:
                self._in_speech = True
                self._silence_frames = 0
                self._speech_chunks.append(chunk)
            elif self._in_speech:
                self._silence_frames += 1
                self._speech_chunks.append(chunk)  # include trailing silence
                if self._silence_frames >= self._silence_threshold_frames:
                    # End of utterance — run STT
                    await self._process_utterance()
                    self._in_speech = False
                    self._speech_chunks = []
                    self._silence_frames = 0

    async def _process_utterance(self):
        """Run Whisper STT on buffered speech, then LLM → TTS."""
        if not self._speech_chunks:
            return

        pcm_8k = np.concatenate(self._speech_chunks)
        pcm_16k = resample_8k_to_16k(pcm_8k).astype(np.int16)
        wav_bytes = pcm_to_wav_bytes(pcm_16k, 16000)

        # Write to temp file for Whisper
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_bytes)
            tmp_path = f.name

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: _whisper_model.transcribe(tmp_path, language="en")
            )
            transcript = result["text"].strip()
        finally:
            os.unlink(tmp_path)

        if not transcript:
            return

        log.info(f"[STT] User: {transcript}")
        await self.send({"type": "transcript", "role": "user", "text": transcript})

        # Emotion detection (non-blocking)
        if _emotion_pipeline:
            try:
                loop = asyncio.get_event_loop()
                emo_result = await loop.run_in_executor(
                    None, lambda: _emotion_pipeline(wav_bytes, granularity="utterance")
                )
                if emo_result and len(emo_result) > 0:
                    top = emo_result[0]
                    emotion = top.get("labels", ["neutral"])[0]
                    score = top.get("scores", [0.0])[0]
                    await self.send({"type": "emotion", "emotion": emotion, "score": round(score, 3)})
            except Exception as e:
                log.warning(f"Emotion detection failed: {e}")

        # LLM → TTS
        await self._llm_and_tts(transcript)

    async def handle_text(self, text: str):
        """Inject a user text utterance directly (for testing/transfer)."""
        log.info(f"[Text inject] User: {text}")
        await self.send({"type": "transcript", "role": "user", "text": text})
        await self._llm_and_tts(text)

    async def _llm_and_tts(self, user_text: str):
        """Send user text to Qwen, then pipe response through Cartesia TTS."""
        self.conversation.append({"role": "user", "content": user_text})

        try:
            reply = await qwen_chat(self.conversation, self.system_prompt)
        except Exception as e:
            log.error(f"LLM error: {e}")
            await self.send({"type": "error", "message": f"LLM error: {e}"})
            return

        self.conversation.append({"role": "assistant", "content": reply})
        log.info(f"[LLM] Assistant: {reply}")
        await self.send({"type": "transcript", "role": "assistant", "text": reply})

        # TTS
        if not CARTESIA_API_KEY or not CARTESIA_VOICE_ID:
            log.warning("Cartesia credentials missing — skipping TTS")
            return

        try:
            pcm_16k_bytes = await cartesia_tts(reply)
            pcm_16k = np.frombuffer(pcm_16k_bytes, dtype=np.int16)
            pcm_8k = resample_16k_to_8k(pcm_16k)
            mulaw = mulaw_encode(pcm_8k)

            # Send in 160-byte frames (20ms @ 8kHz)
            for i in range(0, len(mulaw), 160):
                frame = mulaw[i:i + 160]
                payload = base64.b64encode(frame).decode()
                await self.send({"type": "audio", "payload": payload})
        except Exception as e:
            log.error(f"TTS error: {e}")
            await self.send({"type": "error", "message": f"TTS error: {e}"})


# ---------------------------------------------------------------------------
# WebSocket handler
# ---------------------------------------------------------------------------
async def handle_connection(ws):
    log.info(f"New connection from {ws.remote_address}")
    session = PipelineSession(ws)

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                log.warning("Received non-JSON message")
                continue

            msg_type = msg.get("type")

            if msg_type == "config":
                await session.handle_config(msg.get("session", {}))
            elif msg_type == "audio":
                await session.handle_audio(msg["payload"])
            elif msg_type == "text":
                await session.handle_text(msg.get("text", ""))
            elif msg_type == "close":
                log.info("Client sent close")
                break
            else:
                log.warning(f"Unknown message type: {msg_type}")

    except websockets.exceptions.ConnectionClosedOK:
        pass
    except websockets.exceptions.ConnectionClosedError as e:
        log.warning(f"Connection closed with error: {e}")
    except Exception as e:
        log.error(f"Session error: {e}", exc_info=True)
    finally:
        log.info(f"Connection closed: {ws.remote_address}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main():
    log.info("Loading models...")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, load_models)
    log.info("Models loaded. Starting WebSocket server...")

    async with websockets.serve(handle_connection, HOST, PORT):
        log.info(f"Pipeline server listening on ws://{HOST}:{PORT}")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
