"""Integration tests for the full STT (AI4Bharat) → LLM (Qwen/Groq) → TTS (Cartesia) pipeline.

These tests make REAL API calls to Groq and Cartesia using credentials from .env.
The STT service (IndicConformer) is either called live (if STT_SERVICE_URL is reachable)
or stubbed with a pre-set transcript so LLM + TTS can still be verified end-to-end.

Run:
    cd ml-service/pipeline-service
    pytest tests/test_integration.py -v -s

Skip live STT tests if service is not running — they are automatically skipped.
"""
from __future__ import annotations

import asyncio
import base64
import io
import os
import struct
import sys
import wave
from pathlib import Path

import pytest

# ── Path setup ──────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent.parent.parent  # workspace/full-project
SERVICE_DIR = Path(__file__).resolve().parent.parent
for p in [str(ROOT / "ml-service"), str(SERVICE_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)


# ── Load .env (same logic as server.py) ─────────────────────────────────────
def _load_env():
    for candidate in [
        SERVICE_DIR / ".env",
        SERVICE_DIR.parent.parent / ".env",   # workspace/full-project/.env
    ]:
        if candidate.exists():
            for line in candidate.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    v = v.strip().strip('"').strip("'")
                    os.environ.setdefault(k.strip(), v)
            break

_load_env()


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_sine_wav(freq: int = 440, duration_s: float = 1.5, sample_rate: int = 16000) -> bytes:
    """Generate a WAV file containing a sine wave (used as dummy audio for pipeline tests)."""
    import math
    num_samples = int(sample_rate * duration_s)
    samples = [
        int(32767 * math.sin(2 * math.pi * freq * i / sample_rate))
        for i in range(num_samples)
    ]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{num_samples}h", *samples))
    return buf.getvalue()


def _is_stt_service_up() -> bool:
    """Check if the IndicConformer STT service is reachable and is actually the STT service."""
    import json
    import urllib.request
    url = os.getenv("STT_SERVICE_URL", "http://localhost:8001").rstrip("/") + "/ml/stt/health"
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            if r.status != 200:
                return False
            body = json.loads(r.read())
            # Confirm it's actually the IndicConformer STT service
            return "stt" in body.get("detail", "").lower()
    except Exception:
        return False


def save_pcm_as_wav(pcm_bytes: bytes, path: str, sample_rate: int = 16000) -> None:
    """Save raw PCM s16le bytes as a WAV file for manual inspection."""
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)


# ── Skip markers ─────────────────────────────────────────────────────────────

_missing_llm_key = not os.getenv("LLM_API_KEY")
_missing_cartesia_key = not os.getenv("CARTESIA_API_KEY")
_missing_cartesia_voice = not os.getenv("CARTESIA_VOICE_ID")
_stt_service_up = _is_stt_service_up()

skip_no_llm = pytest.mark.skipif(_missing_llm_key, reason="LLM_API_KEY not set")
skip_no_cartesia = pytest.mark.skipif(
    _missing_cartesia_key or _missing_cartesia_voice,
    reason="CARTESIA_API_KEY or CARTESIA_VOICE_ID not set",
)
skip_no_stt = pytest.mark.skipif(not _stt_service_up, reason="STT service not reachable")


# ════════════════════════════════════════════════════════════════════════════
# 1. LLM — Qwen via Groq (real API call)
# ════════════════════════════════════════════════════════════════════════════

class TestQwenLLM:

    @skip_no_llm
    def test_english_response(self):
        """Qwen should reply in English to an English question."""
        from core.llm import generate_response, LLM_MODEL

        reply = asyncio.run(generate_response(
            user_text="What is Oolix.in?",
            language="en",
        ))

        print(f"\n[LLM/{LLM_MODEL}] EN reply: {reply}")
        assert isinstance(reply, str)
        assert len(reply) > 5
        # Should NOT contain Qwen3 thinking blocks
        assert "<think>" not in reply
        assert "</think>" not in reply

    @skip_no_llm
    def test_hindi_response(self):
        """Qwen should reply in Hindi when user speaks Hindi."""
        from core.llm import generate_response, LLM_MODEL

        reply = asyncio.run(generate_response(
            user_text="मुझे बीमा के बारे में जानकारी चाहिए",
            language="hi",
        ))

        print(f"\n[LLM/{LLM_MODEL}] HI reply: {reply}")
        assert isinstance(reply, str)
        assert len(reply) > 5
        assert "<think>" not in reply

    @skip_no_llm
    def test_think_tags_stripped(self):
        """Verify <think> blocks are stripped even when Qwen3 emits them."""
        from core.llm import _THINK_RE

        raw = "<think>Let me consider this carefully...</think>Namaste! Main aapki kaise madad kar sakta hoon?"
        cleaned = _THINK_RE.sub("", raw).strip()
        assert "<think>" not in cleaned
        assert "Namaste" in cleaned

    @skip_no_llm
    def test_conversation_history(self):
        """Multi-turn: second reply should reference prior context."""
        from core.llm import generate_response

        history = [
            {"role": "user", "content": "My name is Rahul."},
            {"role": "assistant", "content": "Hello Rahul! How can I help you today?"},
        ]
        reply = asyncio.run(generate_response(
            user_text="What is my name?",
            language="en",
            history=history,
        ))

        print(f"\n[LLM] History test reply: {reply}")
        assert isinstance(reply, str)
        assert len(reply) > 5


# ════════════════════════════════════════════════════════════════════════════
# 2. TTS — Cartesia sonic-3 (real API call)
# ════════════════════════════════════════════════════════════════════════════

class TestCartesiaTTS:

    @skip_no_cartesia
    def test_english_synthesis(self, tmp_path):
        """Cartesia should return non-empty PCM audio for English text."""
        from core.tts_cartesia import synthesize, CARTESIA_MODEL

        audio, lang = asyncio.run(synthesize(
            text="Hello! Welcome to Oolix. How can I help you today?",
            language="en",
        ))

        out = tmp_path / "test_en.wav"
        save_pcm_as_wav(audio, str(out))
        print(f"\n[TTS/{CARTESIA_MODEL}] EN: {len(audio)} bytes → {out}")

        assert len(audio) > 1000, "Expected non-trivial audio bytes"
        assert lang == "en"

    @skip_no_cartesia
    def test_hindi_synthesis(self, tmp_path):
        """Cartesia should return non-empty PCM audio for Hindi text."""
        from core.tts_cartesia import synthesize, CARTESIA_MODEL

        audio, lang = asyncio.run(synthesize(
            text="नमस्ते! आपका Oolix में स्वागत है। मैं आपकी कैसे मदद कर सकता हूँ?",
            language="hi",
        ))

        out = tmp_path / "test_hi.wav"
        save_pcm_as_wav(audio, str(out))
        print(f"\n[TTS/{CARTESIA_MODEL}] HI: {len(audio)} bytes → {out}")

        assert len(audio) > 1000
        assert lang == "hi"

    @skip_no_cartesia
    def test_tamil_falls_back_to_hindi(self, tmp_path):
        """Unsupported Indic lang (Tamil) should fall back to Hindi voice."""
        from core.tts_cartesia import synthesize

        audio, lang = asyncio.run(synthesize(
            text="வணக்கம்! நான் உங்களுக்கு எப்படி உதவலாம்?",
            language="ta",
        ))

        print(f"\n[TTS] TA→HI fallback: {len(audio)} bytes, lang={lang}")
        assert lang == "hi"
        assert len(audio) > 1000

    @skip_no_cartesia
    def test_audio_is_valid_pcm(self):
        """Returned bytes should be plausible 16-bit PCM (non-zero, non-trivial)."""
        import numpy as np
        from core.tts_cartesia import synthesize

        audio, _ = asyncio.run(synthesize(
            text="Testing audio quality.",
            language="en",
        ))

        samples = np.frombuffer(audio, dtype=np.int16)
        rms = float(np.sqrt(np.mean(samples.astype(np.float32) ** 2)))
        print(f"\n[TTS] PCM RMS: {rms:.1f} (should be > 100 for real speech)")
        assert rms > 100, "Audio appears silent — TTS may have failed"


# ════════════════════════════════════════════════════════════════════════════
# 3. Full pipeline — STT mocked, LLM + TTS real
#    Verifies Qwen + Cartesia work together end-to-end
# ════════════════════════════════════════════════════════════════════════════

class TestFullPipelineRealAPIs:

    @pytest.fixture
    def pipeline(self):
        from core.pipeline import VoicePipeline
        return VoicePipeline()

    @pytest.mark.skipif(_missing_llm_key or _missing_cartesia_key or _missing_cartesia_voice,
                        reason="LLM_API_KEY or CARTESIA credentials not set")
    def test_hindi_call_llm_and_tts_real(self, pipeline, tmp_path):
        """Simulate STT output (Hindi) → real Qwen LLM → real Cartesia TTS."""
        from unittest.mock import AsyncMock, patch

        stt_result = {
            "text": "मुझे बीमा पॉलिसी के बारे में जानकारी चाहिए",
            "language": "hi",
            "confidence": 0.93,
            "timestamps": [],
            "meta": {"duration_seconds": 2.1},
            "modelUsed": "ai4bharat/indic-conformer-600m-multilingual",
            "status": "success",
        }

        from core.pipeline import PipelineRequest
        result = asyncio.run(
            _run_with_real_llm_tts(pipeline, stt_result, PipelineRequest(language_hint="hi"))
        )

        print(f"\n[Pipeline] HI transcript: {result.transcript}")
        print(f"[Pipeline] HI LLM reply:  {result.llm_response}")
        print(f"[Pipeline] HI audio:      {len(base64.b64decode(result.audio_base64))} bytes")

        assert result.transcript == stt_result["text"]
        assert len(result.llm_response) > 5
        assert "<think>" not in result.llm_response
        assert len(base64.b64decode(result.audio_base64)) > 1000

        # Save audio for manual inspection
        out = tmp_path / "pipeline_hi_output.wav"
        save_pcm_as_wav(base64.b64decode(result.audio_base64), str(out))
        print(f"[Pipeline] HI audio saved → {out}")

    @pytest.mark.skipif(_missing_llm_key or _missing_cartesia_key or _missing_cartesia_voice,
                        reason="LLM_API_KEY or CARTESIA credentials not set")
    def test_english_call_llm_and_tts_real(self, pipeline, tmp_path):
        """Simulate STT output (English) → real Qwen LLM → real Cartesia TTS."""
        stt_result = {
            "text": "I want to place an order for a large pizza with extra cheese",
            "language": "en",
            "confidence": 0.96,
            "timestamps": [],
            "meta": {"duration_seconds": 3.0},
            "modelUsed": "ai4bharat/indic-conformer-600m-multilingual",
            "status": "success",
        }

        from core.pipeline import PipelineRequest
        result = asyncio.run(
            _run_with_real_llm_tts(pipeline, stt_result, PipelineRequest())
        )

        print(f"\n[Pipeline] EN transcript: {result.transcript}")
        print(f"[Pipeline] EN LLM reply:  {result.llm_response}")
        print(f"[Pipeline] EN audio:      {len(base64.b64decode(result.audio_base64))} bytes")

        assert len(result.llm_response) > 5
        assert len(base64.b64decode(result.audio_base64)) > 1000

        out = tmp_path / "pipeline_en_output.wav"
        save_pcm_as_wav(base64.b64decode(result.audio_base64), str(out))
        print(f"[Pipeline] EN audio saved → {out}")

    @pytest.mark.skipif(_missing_llm_key or _missing_cartesia_key or _missing_cartesia_voice,
                        reason="LLM_API_KEY or CARTESIA credentials not set")
    def test_multi_turn_conversation(self, pipeline):
        """Two-turn conversation — second reply should be contextually coherent."""
        from core.pipeline import PipelineRequest

        session_id = "integration-test-session"

        turn1_stt = {
            "text": "Hello, I need help with my insurance renewal",
            "language": "en", "confidence": 0.94, "timestamps": [],
            "meta": {}, "modelUsed": "indic-conformer-600m-multilingual", "status": "success",
        }
        turn2_stt = {
            "text": "What documents do I need?",
            "language": "en", "confidence": 0.91, "timestamps": [],
            "meta": {}, "modelUsed": "indic-conformer-600m-multilingual", "status": "success",
        }

        r1 = asyncio.run(_run_with_real_llm_tts(
            pipeline, turn1_stt, PipelineRequest(session_id=session_id)
        ))
        r2 = asyncio.run(_run_with_real_llm_tts(
            pipeline, turn2_stt, PipelineRequest(session_id=session_id)
        ))

        print(f"\n[Pipeline] Turn 1: {r1.llm_response}")
        print(f"[Pipeline] Turn 2: {r2.llm_response}")

        assert len(r1.llm_response) > 5
        assert len(r2.llm_response) > 5
        # Second reply should be about documents (contextually aware)
        r2_lower = r2.llm_response.lower()
        assert any(w in r2_lower for w in ("document", "id", "policy", "renewal", "proof", "aadhar", "pan")), \
            f"Turn 2 reply doesn't seem insurance-relevant: {r2.llm_response}"


# ════════════════════════════════════════════════════════════════════════════
# 4. Full pipeline — Live STT service (IndicConformer) + LLM + TTS
#    Skipped automatically if STT service is not running
# ════════════════════════════════════════════════════════════════════════════

class TestFullPipelineLive:
    """End-to-end test against the running IndicConformer STT service.

    Start the STT service first:
        cd ml-service/stt-service
        uvicorn app:app --port 8001

    Then run:
        STT_SERVICE_URL=http://localhost:8001 pytest tests/test_integration.py::TestFullPipelineLive -v -s
    """

    @pytest.fixture
    def pipeline(self):
        from core.pipeline import VoicePipeline
        return VoicePipeline()

    @skip_no_stt
    @pytest.mark.skipif(_missing_llm_key or _missing_cartesia_key or _missing_cartesia_voice,
                        reason="API credentials not set")
    def test_live_stt_to_llm_to_tts(self, pipeline, tmp_path):
        """Send real audio to IndicConformer → Qwen → Cartesia end-to-end."""
        from core.pipeline import PipelineRequest

        audio = make_sine_wav(freq=440, duration_s=1.0)

        from core.pipeline import PipelineRequest
        result = asyncio.run(pipeline.run(audio, PipelineRequest(language_hint="en")))

        print(f"\n[Live] STT transcript: {result.transcript!r}")
        print(f"[Live] LLM reply:      {result.llm_response!r}")
        print(f"[Live] TTS audio:      {len(base64.b64decode(result.audio_base64))} bytes")

        # STT may return empty for a sine wave (no speech) — that's valid
        # The important thing is the pipeline didn't crash
        assert result.language in ("en", "hi", "")
        if result.transcript:
            assert len(result.llm_response) > 0
            assert len(base64.b64decode(result.audio_base64)) > 0

        out = tmp_path / "live_pipeline_output.wav"
        if result.audio_base64:
            save_pcm_as_wav(base64.b64decode(result.audio_base64), str(out))
            print(f"[Live] Audio saved → {out}")


# ════════════════════════════════════════════════════════════════════════════
# Helper
# ════════════════════════════════════════════════════════════════════════════

async def _run_with_real_llm_tts(pipeline, stt_result: dict, request):
    """Run the pipeline with a pre-set STT result but real LLM and TTS calls."""
    from unittest.mock import AsyncMock, patch

    with patch.object(pipeline, "_call_stt", AsyncMock(return_value=stt_result)):
        return await pipeline.run(b"fake-audio", request)
