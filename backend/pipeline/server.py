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
  LLM_BASE_URL             = https://api.groq.com/openai/v1  (any OpenAI-compat endpoint)
  LLM_API_KEY              = <required>   (Groq / OpenAI / vLLM key)
  LLM_MODEL                = qwen-qwq-32b (model name on the provider)
  CARTESIA_API_KEY         = <required>
  CARTESIA_VOICE_ID        = <required>
  CARTESIA_MODEL           = sonic-3  (default)
"""

import asyncio
import base64
import json
import logging
import os
import re as _re
import tempfile
import wave
from pathlib import Path

# Load .env — search from script dir upward: pipeline/.env → backend/.env → root .env
def _load_env():
    search = [
        Path(__file__).parent / ".env",            # backend/pipeline/.env
        Path(__file__).parent.parent / ".env",     # backend/.env
        Path(__file__).parent.parent.parent / ".env",  # root .env
    ]
    for _env_file in search:
        if _env_file.exists():
            for _line in _env_file.read_text().splitlines():
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _, _v = _line.partition("=")
                    _v = _v.strip()
                    if len(_v) >= 2 and ((_v[0] == '"' and _v[-1] == '"') or (_v[0] == "'" and _v[-1] == "'")):
                        _v = _v[1:-1]
                    os.environ.setdefault(_k.strip(), _v)
            break  # stop at first found

_load_env()

import numpy as np
import websockets

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
# STT provider: "local" = local Whisper on GPU, "groq" = Groq Whisper API
# Uses PIPELINE_STT_PROVIDER env var (avoids clash with Node.js STT_PROVIDER which expects 'custom'|'openai')
STT_PROVIDER = os.getenv("PIPELINE_STT_PROVIDER", os.getenv("STT_PROVIDER", "local"))
STT_MODEL = os.getenv("STT_MODEL", "whisper-large-v3-turbo")
# Default language hint for STT — "hi" for Indian market prevents Groq from
# mishearing Hindi as Spanish/Italian on the first utterance.
# Set DEFAULT_STT_LANGUAGE=en in .env to disable for English-only deployments.
DEFAULT_STT_LANGUAGE = os.getenv("DEFAULT_STT_LANGUAGE", "hi")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen/qwen3-32b")
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "")
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID", "")
CARTESIA_MODEL = os.getenv("CARTESIA_MODEL", "sonic-3")

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
    f = pcm8k.astype(np.float32)
    out = np.empty(len(f) * 2, dtype=np.float32)
    out[0::2] = f
    # Interpolate between each pair of adjacent samples; last odd sample duplicates last input
    out[1:-1:2] = (f[:-1] + f[1:]) / 2.0
    out[-1] = f[-1]
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


def load_models():
    global _silero_model, _silero_utils, _whisper_model

    log.info("Loading Silero-VAD v5...")
    import torch
    _silero_model, _silero_utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        onnx=False,
        trust_repo=True,
    )
    log.info("Silero-VAD loaded.")

    if STT_PROVIDER == "groq":
        log.info(f"STT_PROVIDER=groq — skipping local Whisper load (using Groq {STT_MODEL})")
    else:
        log.info(f"STT_PROVIDER=local — Loading Whisper model: {WHISPER_MODEL_NAME} ...")
        import whisper
        _whisper_model = whisper.load_model(WHISPER_MODEL_NAME)
        log.info("Whisper loaded.")


# ---------------------------------------------------------------------------
# Cartesia TTS
# ---------------------------------------------------------------------------
# STT — Groq Whisper (fast, cloud) or local Whisper (slow, CPU)
# ---------------------------------------------------------------------------
def _detect_language_from_text(text: str, whisper_lang: str) -> str:
    """Determine language code.

    Groq large-v3-turbo: accurate language field, trust it directly.
    Local small: can hallucinate Devanagari from English noise, so require
    both Whisper saying 'hi' AND actual Devanagari in the transcript.
    Only allow 'en' and 'hi' — map all other detections to 'en' to prevent
    random Spanish/French responses from background noise.
    """
    lang = whisper_lang or "en"

    # Check Devanagari script regardless of provider — Groq often labels
    # Hindi speech as 'en' even when it transcribes it in Devanagari correctly
    has_devanagari = any('\u0900' <= ch <= '\u097F' for ch in text)

    if STT_PROVIDER == "groq":
        # Groq's language code is unreliable for Indian-accent Hindi —
        # trust Devanagari script presence as the primary signal
        return "hi" if (lang == "hi" or has_devanagari) else "en"
    else:
        # Local small — require both language field AND script confirmation
        if lang == "hi":
            return "hi" if has_devanagari else "en"
        return "en"  # map all non-Hindi to English for local small


async def transcribe_audio(wav_bytes: bytes, hint_language: str = "") -> tuple[str, str]:
    """Transcribe audio and detect language. Returns (text, language_code).

    hint_language: optional ISO-639-1 code (e.g. 'hi') — pass once language is
    locked on the session to improve accuracy on subsequent utterances.
    Leave empty for auto-detection on the first utterance.

    STT_PROVIDER=groq  → Groq whisper-large-v3-turbo (fast, accurate, recommended)
    STT_PROVIDER=local → Local Whisper model (set WHISPER_MODEL in .env)
    """
    if STT_PROVIDER == "groq" and LLM_API_KEY:
        import aiohttp, io
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {LLM_API_KEY}"}
        data = aiohttp.FormData()
        data.add_field("file", io.BytesIO(wav_bytes), filename="audio.wav", content_type="audio/wav")
        data.add_field("model", STT_MODEL)
        data.add_field("response_format", "verbose_json")
        # Pass language hint when already known — significantly improves accuracy
        if hint_language:
            data.add_field("language", hint_language)
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, data=data) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    raise RuntimeError(f"Groq STT error {resp.status}: {body}")
                result = await resp.json()
                text = result.get("text", "").strip()
                whisper_lang = result.get("language", hint_language or "en")
                lang = _detect_language_from_text(text, whisper_lang)
                return text, lang
    else:
        # Local Whisper (STT_PROVIDER=local or any other value)
        # Switch back anytime: set STT_PROVIDER=local in .env
        loop = asyncio.get_running_loop()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_bytes)
            tmp_path = f.name
        try:
            kwargs = {"language": hint_language} if hint_language else {}
            result = await loop.run_in_executor(
                None, lambda: _whisper_model.transcribe(tmp_path, **kwargs)
            )
            text = result["text"].strip()
            whisper_lang = result.get("language", hint_language or "en")
            lang = _detect_language_from_text(text, whisper_lang)
            return text, lang
        finally:
            os.unlink(tmp_path)


# ---------------------------------------------------------------------------
async def cartesia_tts(text: str, emotion: str = "neutral", language: str = "en") -> bytes:
    """Call Cartesia Sonic 3 API and return raw PCM16 bytes at 16kHz."""
    import aiohttp

    url = "https://api.cartesia.ai/tts/bytes"
    headers = {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": "2025-04-16",
        "Content-Type": "application/json",
    }
    CARTESIA_SUPPORTED_LANGS = {"en","hi","fr","de","es","pt","zh","ja","ko","nl","pl","ru","sv","tr","it"}
    cartesia_lang = language if language in CARTESIA_SUPPORTED_LANGS else "en"

    payload = {
        "model_id": CARTESIA_MODEL,
        "transcript": text,
        "voice": {"mode": "id", "id": CARTESIA_VOICE_ID},
        "language": cartesia_lang,
        "output_format": {
            "container": "raw",
            "encoding": "pcm_s16le",
            "sample_rate": 16000,
        },
    }
    # Inject Cartesia emotion controls based on detected user emotion
    if emotion and emotion != "neutral":
        controls = _emotion_to_cartesia(emotion)
        if controls:
            payload["voice"]["__experimental_controls"] = {"emotion": controls}
            log.info(f"[Cartesia] Emotion controls: {controls}")

    timeout = aiohttp.ClientTimeout(total=15)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, headers=headers, json=payload) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"Cartesia error {resp.status}: {body}")
            return await resp.read()


def _emotion_to_cartesia(emotion: str) -> list[str]:
    """Map detected user emotion → Cartesia voice emotion controls for the AI response."""
    # When user is X, AI speaks with Y tone
    mapping = {
        # Cartesia only accepts: high | low (not medium)
        "angry":      ["positivity:low", "sadness:low"],      # calm, de-escalating
        "frustrated": ["positivity:high"],                     # patient, warm
        "sad":        ["positivity:low", "sadness:low"],       # gentle, empathetic
        "fearful":    ["positivity:high"],                     # reassuring
        "disgusted":  ["positivity:low"],                      # neutral, professional
        "happy":      ["positivity:high"],                     # match positive energy
        "excited":    ["positivity:high", "surprise:low"],     # engaged, enthusiastic
        "surprised":  ["curiosity:high"],                      # curious, engaged
        "confused":   ["curiosity:high", "positivity:low"],    # helpful, clear
        "curious":    ["curiosity:high"],                      # engage with interest
        "neutral":    [],
    }
    return mapping.get(emotion.lower(), [])


# ---------------------------------------------------------------------------
# Qwen LLM — returns (emotion, reply) in a single API call
# ---------------------------------------------------------------------------
async def qwen_chat(
    messages: list[dict],
    system_prompt: str,
    language: str = "en",
) -> tuple[str, str]:
    """
    Call Qwen via /chat/completions.
    Returns (emotion, reply).
    Emotion is detected from the user's last message in the same call — zero extra latency.
    """
    import aiohttp

    _LANG_NAMES = {"en": "English", "hi": "Hindi", "fr": "French", "de": "German",
                   "es": "Spanish", "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese"}
    lang_name = _LANG_NAMES.get(language, "English")
    lang_instruction = (
        f"CRITICAL: Respond ONLY in {lang_name}. "
        "If the caller uses a mix of Hindi and English (Hinglish), always reply in Hindi. "
        "Never switch to a different language."
    )

    emotion_instruction = (
        "Before your reply, detect the caller's emotion from their words. "
        "Output exactly:\n"
        "EMOTION: <one of: neutral happy excited sad frustrated angry fearful confused surprised curious>\n"
        "RESPONSE: <your reply>\n\n"
        "Rules:\n"
        "- Adjust your tone to the caller's emotional state.\n"
        "- If caller is angry/frustrated: stay calm, empathetic, solution-focused.\n"
        "- If caller is sad: be warm and gentle.\n"
        "- If caller is happy/excited: match their energy.\n"
        "- If caller is confused: be clear and patient.\n"
        "- Keep RESPONSE to 1-3 short sentences suitable for voice.\n"
        "- No markdown, no bullet points in RESPONSE."
    )

    full_system = f"{system_prompt}\n\n{lang_instruction}\n\n{emotion_instruction}"
    url = f"{LLM_BASE_URL.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"

    full_messages = [{"role": "system", "content": full_system}] + messages
    payload = {
        "model": LLM_MODEL,
        "messages": full_messages,
        "temperature": 0.7,
        "max_tokens": 250,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"LLM error {resp.status}: {body}")
            data = await resp.json()
            content = data["choices"][0]["message"]["content"]

    # Strip <think>...</think> reasoning blocks (Qwen3 thinking mode)
    content = _re.sub(r"<think>.*?</think>", "", content, flags=_re.DOTALL).strip()

    # Parse EMOTION and RESPONSE
    emotion = "neutral"
    reply = content

    emotion_match = _re.search(r"EMOTION:\s*(\w+)", content, _re.IGNORECASE)
    response_match = _re.search(r"RESPONSE:\s*(.+)", content, _re.IGNORECASE | _re.DOTALL)

    _VALID_EMOTIONS = {"neutral","happy","excited","sad","frustrated","angry","fearful","confused","surprised","curious"}
    if emotion_match:
        parsed = emotion_match.group(1).lower().strip()
        emotion = parsed if parsed in _VALID_EMOTIONS else "neutral"
    if response_match:
        reply = response_match.group(1).strip()
    elif emotion_match:
        # fallback: everything after the EMOTION line
        reply = content[emotion_match.end():].strip()

    return emotion, reply


# ---------------------------------------------------------------------------
# Whisper hallucination detection
# ---------------------------------------------------------------------------
_HALLUCINATION_PATTERNS = _re.compile(
    r"^(okay\.?\s*){3,}$"                    # "Okay. Okay. Okay..."
    r"|^(thank you\.?\s*){3,}$"              # "Thank you. Thank you..."
    r"|^(\.?\s*){3,}$"                        # dots/whitespace only
    r"|^\s*$"                                 # empty
    r"|https?://\S+"                          # URLs
    r"|www\.\S+"                              # www. links
    r"|\S+\.(com|org|net|io|co|in)\b",        # bare domain names
    _re.IGNORECASE,
)

# Exact-match short hallucination phrases
_HALLUCINATION_PHRASES = {
    "you", "you.", "the", "i", "uh", "um", "hmm", "hm",
    "thanks for watching", "thanks for watching!",
    "subscribe", "like and subscribe",
    "please subscribe", "please like and subscribe",
}

# Substring phrases Whisper commonly hallucinates — if any appear, drop the transcript
_HALLUCINATION_SUBSTRINGS = [
    "www.", "http://", "https://", ".com", ".org", ".net",
    "follow us", "follow me", "subscribe to", "check out our",
    "visit our website", "like and subscribe", "thanks for watching",
    "смотрите", "subbed by", "subtitles by",  # foreign subtitle artifacts
]

def _is_hallucination(text: str) -> bool:
    """Return True if the transcript looks like a Whisper noise hallucination."""
    t = text.strip()
    if not t:
        return True
    tl = t.lower()
    # Exact match on known short hallucinations
    if tl.rstrip(".!?,") in _HALLUCINATION_PHRASES:
        return True
    # Substring match — catches "Please follow us at www.gmail.com" etc.
    if any(sub in tl for sub in _HALLUCINATION_SUBSTRINGS):
        return True
    # Regex pattern match
    if _HALLUCINATION_PATTERNS.search(t):
        return True
    # Repetition heuristic: >60% same word → hallucination
    words = tl.split()
    if len(words) >= 5:
        most_common_count = max(words.count(w) for w in set(words))
        if most_common_count / len(words) > 0.6:
            return True
    return False


# ---------------------------------------------------------------------------
# Per-connection session
# ---------------------------------------------------------------------------
class PipelineSession:
    SAMPLE_RATE = 8000
    SILENCE_THRESHOLD_MS = 400   # ms of silence to trigger STT
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
        self._current_emotion = "neutral"
        # Language: starts English, requires 2 consecutive Hindi detections to lock
        # Prevents a single Whisper hallucination from flipping the whole session
        self._session_language = "en"
        self._hindi_streak = 0   # consecutive Hindi utterances
        self._hindi_locked = False
        # Prevents overlapping STT→LLM→TTS pipelines (avoids garbled audio + conversation race)
        self._utterance_lock = asyncio.Lock()
        # Holds at most one pending utterance spoken while pipeline is busy
        self._pending_utterance: asyncio.Queue = asyncio.Queue(maxsize=1)

    async def send(self, msg: dict):
        try:
            await self.ws.send(json.dumps(msg))
        except Exception:
            pass  # WebSocket closed — ignore silently

    async def handle_config(self, session: dict):
        self.session_params = session
        call_type = session.get("callType", "inbound")
        caller = session.get("caller", "caller")

        # Use the rich system prompt built by Node.js (contains store info, menu,
        # campaign script, customer history). Fall back to a generic prompt if absent.
        if session.get("systemPrompt"):
            self.system_prompt = session["systemPrompt"]
            log.info(f"[Session] Using DB-enriched system prompt ({len(self.system_prompt)} chars)")
        elif call_type == "inbound":
            self.system_prompt = (
                f"You are a helpful voice AI assistant. "
                f"The caller is {caller}. Be concise and natural. "
                "Answer questions and assist the caller professionally. "
                "Keep replies to 1-3 short sentences."
            )
        else:
            self.system_prompt = (
                f"You are an outbound sales AI assistant. "
                f"You are calling {caller}. Be polite, professional, and helpful. "
                "Keep replies to 1-3 short sentences."
            )

        log.info(f"[Session] Configured for call {session.get('callId')} ({call_type})")
        await self.send({"type": "ready"})
        # Greet the caller immediately so they aren't met with silence
        asyncio.create_task(self._send_greeting())

    async def _send_greeting(self):
        """Proactively greet the caller right after the session is configured."""
        # Brief pause — ensures Twilio audio pipeline is ready to receive audio
        await asyncio.sleep(0.6)
        async with self._utterance_lock:
            # One-shot trigger: not stored in conversation so it doesn't pollute history
            trigger = [{"role": "user", "content": "[The call just connected. Please greet the caller warmly, introduce yourself, and ask how you can help. Be brief and natural — this is a live phone call. Do not output EMOTION: or RESPONSE: labels.]"}]
            try:
                _, reply = await qwen_chat(trigger, self.system_prompt)
            except Exception as e:
                log.error(f"[Greeting] LLM error: {e}")
                return

            log.info(f"[Greeting] {reply}")
            # Store greeting in conversation history so follow-up turns have context
            self.conversation.append({"role": "assistant", "content": reply})
            await self.send({"type": "transcript", "role": "assistant", "text": reply})

            if not CARTESIA_API_KEY or not CARTESIA_VOICE_ID:
                return
            try:
                # Greet with a warm, neutral tone (no user emotion to mirror yet)
                pcm_16k_bytes = await cartesia_tts(reply, emotion="neutral")
                pcm_16k = np.frombuffer(pcm_16k_bytes, dtype=np.int16)
                pcm_8k = resample_16k_to_8k(pcm_16k)
                mulaw = mulaw_encode(pcm_8k)
                for i in range(0, len(mulaw), self.CHUNK_BYTES):
                    frame = mulaw[i:i + self.CHUNK_BYTES]
                    payload = base64.b64encode(frame).decode()
                    await self.send({"type": "audio", "payload": payload})
            except Exception as e:
                log.error(f"[Greeting] TTS error: {e}")

    async def handle_audio(self, base64_payload: str):
        """Process incoming mulaw 8kHz audio through VAD → STT pipeline."""
        if _silero_model is None:
            return  # models not loaded yet
        import torch
        mulaw_bytes = base64.b64decode(base64_payload)
        pcm16 = mulaw_decode(mulaw_bytes)

        # Normalize to float32 in [-1, 1] for Silero
        pcm_float = pcm16.astype(np.float32) / 32768.0
        self._audio_pcm_buffer = np.concatenate([self._audio_pcm_buffer, pcm_float])

        chunk_size = 256  # 32ms at 8kHz
        loop = asyncio.get_running_loop()

        while len(self._audio_pcm_buffer) >= chunk_size:
            chunk = self._audio_pcm_buffer[:chunk_size]
            self._audio_pcm_buffer = self._audio_pcm_buffer[chunk_size:]

            # Run Silero-VAD in thread pool — non-blocking
            tensor = torch.from_numpy(chunk).unsqueeze(0)
            speech_prob = await loop.run_in_executor(
                None, lambda t=tensor: _silero_model(t, self.SAMPLE_RATE).item()
            )

            if speech_prob > 0.65:
                self._in_speech = True
                self._silence_frames = 0
                self._speech_chunks.append(chunk)
            elif self._in_speech:
                self._silence_frames += 1
                self._speech_chunks.append(chunk)
                if self._silence_frames >= self._silence_threshold_frames:
                    # End of utterance — snapshot chunks and process async
                    chunks = self._speech_chunks[:]
                    self._in_speech = False
                    self._speech_chunks = []
                    self._silence_frames = 0
                    asyncio.create_task(self._run_utterance(chunks))

    async def _run_utterance(self, chunks: list):
        """Lock guard: queue utterance if pipeline is busy, replacing any older pending one."""
        if self._utterance_lock.locked():
            # Evict stale pending utterance and replace with latest speech
            try:
                self._pending_utterance.get_nowait()
            except asyncio.QueueEmpty:
                pass
            await self._pending_utterance.put(chunks)
            log.info("[VAD] Pipeline busy — queued utterance for after current response")
            return
        async with self._utterance_lock:
            await self._process_utterance(chunks)
            # Drain any utterance that arrived while we were processing
            while not self._pending_utterance.empty():
                try:
                    queued = self._pending_utterance.get_nowait()
                    await self._process_utterance(queued)
                except asyncio.QueueEmpty:
                    break

    async def _process_utterance(self, speech_chunks: list):
        """Transcribe speech then run LLM → TTS."""
        if not speech_chunks:
            return

        # speech_chunks contain float32 normalized to [-1, 1] — scale back to int16 range
        pcm_8k = np.concatenate(speech_chunks)
        pcm_16k = (resample_8k_to_16k(pcm_8k) * 32768.0).clip(-32768, 32767).astype(np.int16)
        wav_bytes = pcm_to_wav_bytes(pcm_16k, 16000)

        # Pass language hint to Groq STT:
        # - Once locked: use locked language for maximum accuracy
        # - Before lock: use DEFAULT_STT_LANGUAGE ("hi" for Indian market) to prevent
        #   Groq from mishearing Hindi as Spanish/Italian on unlocked utterances
        if self._hindi_locked:
            hint = self._session_language
        elif STT_PROVIDER == "groq":
            hint = DEFAULT_STT_LANGUAGE  # "hi" by default — forces Groq to output Devanagari for Hindi speakers
        else:
            hint = ""
        try:
            transcript, detected_lang = await transcribe_audio(wav_bytes, hint_language=hint)
        except Exception as e:
            log.error(f"STT error: {e}")
            return

        if not transcript:
            return

        # ── Whisper hallucination filter ────────────────────────────────────
        # Whisper generates repetitive filler phrases on silence/background noise.
        # Drop utterances that are clearly hallucinated before hitting the LLM.
        if _is_hallucination(transcript):
            log.warning(f"[STT] Hallucination dropped: {transcript[:80]}")
            return

        # ── Language tracking ────────────────────────────────────────────────
        # Only trust language detection on utterances with 3+ words.
        # Short/noisy phrases like "A ed" or "of King" are too ambiguous for
        # Whisper small to classify correctly — ignore them for language purposes.
        word_count = len(transcript.split())
        if word_count >= 3:
            if detected_lang == "hi":
                self._hindi_streak += 1
                if self._hindi_streak >= 2:
                    self._hindi_locked = True
            else:
                self._hindi_streak = 0  # reset streak on non-Hindi utterance

        if self._hindi_locked:
            self._session_language = "hi"
        elif word_count >= 3:
            self._session_language = detected_lang
        # else: keep existing language — don't update on short phrases

        log.info(f"[STT] User ({self._session_language}): {transcript}")
        await self.send({"type": "transcript", "role": "user", "text": transcript})

        # LLM (detects emotion + generates response in one call) → TTS
        await self._llm_and_tts(transcript)

    async def handle_text(self, text: str):
        """Inject a user text utterance directly (for testing/transfer)."""
        log.info(f"[Text inject] User: {text}")
        await self.send({"type": "transcript", "role": "user", "text": text})
        await self._llm_and_tts(text)

    async def _llm_and_tts(self, user_text: str):
        """Detect emotion + generate reply (single LLM call) → Cartesia TTS."""
        self.conversation.append({"role": "user", "content": user_text})

        try:
            emotion, reply = await qwen_chat(
                self.conversation, self.system_prompt, language=self._session_language
            )
        except Exception as e:
            log.error(f"LLM error: {e}")
            await self.send({"type": "error", "message": f"LLM error: {e}"})
            return

        # Store detected emotion on session for context continuity
        self._current_emotion = emotion
        log.info(f"[Emotion] Detected: {emotion}")
        log.info(f"[LLM] Assistant: {reply}")

        # Send emotion + transcript to frontend dashboard
        await self.send({"type": "emotion", "emotion": emotion, "score": 1.0})
        await self.send({"type": "transcript", "role": "assistant", "text": reply})

        # Store clean reply in conversation (without emotion prefix)
        self.conversation.append({"role": "assistant", "content": reply})

        # TTS — Cartesia speaks with emotion-appropriate tone
        if not CARTESIA_API_KEY or not CARTESIA_VOICE_ID:
            log.warning("Cartesia credentials missing — skipping TTS")
            return

        try:
            pcm_16k_bytes = await cartesia_tts(reply, emotion=emotion, language=self._session_language)
            pcm_16k = np.frombuffer(pcm_16k_bytes, dtype=np.int16)
            pcm_8k = resample_16k_to_8k(pcm_16k)
            mulaw = mulaw_encode(pcm_8k)

            for i in range(0, len(mulaw), self.CHUNK_BYTES):
                frame = mulaw[i:i + self.CHUNK_BYTES]
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
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, load_models)
    log.info("Models loaded. Starting WebSocket server...")

    async with websockets.serve(handle_connection, HOST, PORT):
        log.info(f"Pipeline server listening on ws://{HOST}:{PORT}")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
