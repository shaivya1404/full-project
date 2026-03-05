"""Unit tests for the voice pipeline (STT → LLM → TTS).

All external HTTP calls are mocked so no live services are needed.
Run with:
    cd ml-service/pipeline-service
    pip install pytest pytest-asyncio httpx
    pytest tests/ -v
"""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Make sure the service modules are importable
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from core.pipeline import PipelineRequest, PipelineResult, VoicePipeline, _sessions


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_sessions():
    """Reset in-memory session store before each test."""
    _sessions.clear()
    yield
    _sessions.clear()


def _make_stt_response(
    text: str = "नमस्ते, मुझे बीमा चाहिए",
    language: str = "hi",
    confidence: float = 0.92,
    model: str = "ai4bharat/indic-conformer-600m-multilingual",
) -> dict:
    return {
        "text": text,
        "language": language,
        "confidence": confidence,
        "timestamps": [],
        "meta": {"duration_seconds": 2.5, "quality_score": 0.88},
        "modelUsed": model,
        "status": "success",
    }


def _make_wav_bytes() -> bytes:
    """Minimal valid WAV header (44 bytes) + silent audio."""
    import struct
    num_samples = 22050  # 1 second at 22050 Hz
    data_size = num_samples * 2  # 16-bit mono
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, 22050, 44100, 2, 16,
        b"data", data_size,
    )
    return header + b"\x00" * data_size


# ---------------------------------------------------------------------------
# LLM tests
# ---------------------------------------------------------------------------

class TestGroqLLM:
    @pytest.mark.asyncio
    async def test_generate_response_success(self):
        from core.llm import generate_response

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "हाँ, मैं आपकी मदद कर सकता हूँ।"}}],
            "usage": {"completion_tokens": 12},
        }

        with patch("core.llm.LLM_API_KEY", "test-key"), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            reply = await generate_response("नमस्ते", "hi")

        assert reply == "हाँ, मैं आपकी मदद कर सकता हूँ।"

    @pytest.mark.asyncio
    async def test_generate_response_no_api_key(self):
        from core.llm import generate_response

        with patch("core.llm.LLM_API_KEY", ""):
            with pytest.raises(RuntimeError, match="LLM_API_KEY"):
                await generate_response("hello", "en")

    @pytest.mark.asyncio
    async def test_generate_response_api_error(self):
        from core.llm import generate_response

        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limit exceeded"

        with patch("core.llm.LLM_API_KEY", "test-key"), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(RuntimeError, match="LLM API error 429"):
                await generate_response("hello", "en")

    @pytest.mark.asyncio
    async def test_history_is_included(self):
        from core.llm import generate_response

        captured: list = []

        async def fake_post(url, json=None, headers=None):
            captured.append(json)
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "choices": [{"message": {"content": "sure"}}],
                "usage": {"completion_tokens": 1},
            }
            return mock_resp

        with patch("core.llm.LLM_API_KEY", "test-key"), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = fake_post
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            history = [
                {"role": "user", "content": "hi"},
                {"role": "assistant", "content": "hello"},
            ]
            await generate_response("follow-up", "en", history=history)

        messages = captured[0]["messages"]
        roles = [m["role"] for m in messages]
        assert roles == ["system", "user", "assistant", "user"]


# ---------------------------------------------------------------------------
# Cartesia TTS tests
# ---------------------------------------------------------------------------

class TestCartesiaTTS:
    @pytest.mark.asyncio
    async def test_synthesize_success(self):
        from core.tts_cartesia import synthesize

        wav = _make_wav_bytes()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = wav

        with patch("core.tts_cartesia.CARTESIA_API_KEY", "test-key"), \
             patch("core.tts_cartesia.CARTESIA_VOICE_ID", "voice-uuid"), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            audio, lang = await synthesize("Hello world", "en")

        assert audio == wav
        assert lang == "en"

    @pytest.mark.asyncio
    async def test_unsupported_lang_falls_back_to_hindi(self):
        from core.tts_cartesia import synthesize, _cartesia_lang

        # Tamil not directly supported by Cartesia → should map to "hi"
        assert _cartesia_lang("ta") == "hi"
        assert _cartesia_lang("te") == "hi"
        assert _cartesia_lang("bn") == "hi"

        wav = _make_wav_bytes()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = wav

        with patch("core.tts_cartesia.CARTESIA_API_KEY", "test-key"), \
             patch("core.tts_cartesia.CARTESIA_VOICE_ID", "voice-uuid"), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            audio, lang = await synthesize("நமஸ்தே", "ta")  # Tamil input

        assert lang == "hi"  # fell back to Hindi for Cartesia

    @pytest.mark.asyncio
    async def test_no_api_key_raises(self):
        from core.tts_cartesia import synthesize

        with patch("core.tts_cartesia.CARTESIA_API_KEY", ""):
            with pytest.raises(RuntimeError, match="CARTESIA_API_KEY"):
                await synthesize("hello", "en")

    @pytest.mark.asyncio
    async def test_api_error_raises(self):
        from core.tts_cartesia import synthesize

        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "invalid voice id"

        with patch("core.tts_cartesia.CARTESIA_API_KEY", "test-key"), \
             patch("core.tts_cartesia.CARTESIA_VOICE_ID", "voice-uuid"), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(RuntimeError, match="Cartesia API error 400"):
                await synthesize("hello", "en")


# ---------------------------------------------------------------------------
# VoicePipeline orchestration tests
# ---------------------------------------------------------------------------

class TestVoicePipeline:
    @pytest.fixture
    def pipeline(self):
        return VoicePipeline()

    @pytest.mark.asyncio
    async def test_full_pipeline_hindi(self, pipeline):
        """Happy path: Hindi audio → Groq → Cartesia."""
        stt_data = _make_stt_response(
            text="मुझे बीमा चाहिए", language="hi", confidence=0.9
        )
        wav_out = _make_wav_bytes()
        llm_text = "जी हाँ, मैं आपकी मदद कर सकता हूँ।"

        with patch.object(pipeline, "_call_stt", AsyncMock(return_value=stt_data)), \
             patch("core.pipeline.generate_response", AsyncMock(return_value=llm_text)), \
             patch("core.pipeline.tts_synthesize", AsyncMock(return_value=(wav_out, "hi"))):

            result = await pipeline.run(
                b"fake-audio",
                PipelineRequest(language_hint="hi", session_id="sess-1"),
            )

        assert result.transcript == "मुझे बीमा चाहिए"
        assert result.llm_response == llm_text
        assert result.language == "hi"
        assert result.tts_language == "hi"
        assert result.stt_confidence == 0.9
        assert base64.b64decode(result.audio_base64) == wav_out
        assert result.session_id == "sess-1"

    @pytest.mark.asyncio
    async def test_full_pipeline_english(self, pipeline):
        """Happy path: English audio → pipeline."""
        stt_data = _make_stt_response(text="I need help with my order", language="en", confidence=0.95)
        wav_out = _make_wav_bytes()
        llm_text = "Sure, I can help you with your order."

        with patch.object(pipeline, "_call_stt", AsyncMock(return_value=stt_data)), \
             patch("core.pipeline.generate_response", AsyncMock(return_value=llm_text)), \
             patch("core.pipeline.tts_synthesize", AsyncMock(return_value=(wav_out, "en"))):

            result = await pipeline.run(b"audio", PipelineRequest())

        assert result.transcript == "I need help with my order"
        assert result.language == "en"
        assert result.tts_language == "en"

    @pytest.mark.asyncio
    async def test_empty_transcript_returns_early(self, pipeline):
        """If STT returns no speech, pipeline short-circuits without calling LLM/TTS."""
        stt_data = _make_stt_response(text="", language="hi", confidence=0.0)

        with patch.object(pipeline, "_call_stt", AsyncMock(return_value=stt_data)), \
             patch("core.pipeline.generate_response") as mock_llm, \
             patch("core.pipeline.tts_synthesize") as mock_tts:

            result = await pipeline.run(b"silence", PipelineRequest())

        mock_llm.assert_not_called()
        mock_tts.assert_not_called()
        assert result.transcript == ""
        assert result.audio_base64 == ""
        assert result.meta.get("warning") == "no_speech_detected"

    @pytest.mark.asyncio
    async def test_conversation_history_persists(self, pipeline):
        """Second call in same session should include prior turn in LLM history."""
        stt_data = _make_stt_response(text="tell me more", language="en")
        wav_out = _make_wav_bytes()

        captured_history: list = []

        async def fake_llm(user_text, language, system_prompt=None, history=None):
            captured_history.append(history or [])
            return "Here is more info."

        # First turn
        with patch.object(pipeline, "_call_stt", AsyncMock(return_value=_make_stt_response(text="hello", language="en"))), \
             patch("core.pipeline.generate_response", side_effect=fake_llm), \
             patch("core.pipeline.tts_synthesize", AsyncMock(return_value=(wav_out, "en"))):
            await pipeline.run(b"audio1", PipelineRequest(session_id="sess-conv"))

        # Second turn
        with patch.object(pipeline, "_call_stt", AsyncMock(return_value=stt_data)), \
             patch("core.pipeline.generate_response", side_effect=fake_llm), \
             patch("core.pipeline.tts_synthesize", AsyncMock(return_value=(wav_out, "en"))):
            await pipeline.run(b"audio2", PipelineRequest(session_id="sess-conv"))

        # First call had empty history, second had 2 messages (user+assistant)
        assert len(captured_history[0]) == 0
        assert len(captured_history[1]) == 2
        assert captured_history[1][0]["role"] == "user"
        assert captured_history[1][0]["content"] == "hello"

    @pytest.mark.asyncio
    async def test_stt_service_error_raises(self, pipeline):
        with patch.object(pipeline, "_call_stt", AsyncMock(side_effect=RuntimeError("STT service error 503"))):
            with pytest.raises(RuntimeError, match="STT service error"):
                await pipeline.run(b"audio", PipelineRequest())

    @pytest.mark.asyncio
    async def test_llm_error_propagates(self, pipeline):
        stt_data = _make_stt_response()
        with patch.object(pipeline, "_call_stt", AsyncMock(return_value=stt_data)), \
             patch("core.pipeline.generate_response", AsyncMock(side_effect=RuntimeError("Groq API error 429"))):
            with pytest.raises(RuntimeError, match="Groq API error 429"):
                await pipeline.run(b"audio", PipelineRequest())

    @pytest.mark.asyncio
    async def test_tts_error_propagates(self, pipeline):
        stt_data = _make_stt_response()
        with patch.object(pipeline, "_call_stt", AsyncMock(return_value=stt_data)), \
             patch("core.pipeline.generate_response", AsyncMock(return_value="reply")), \
             patch("core.pipeline.tts_synthesize", AsyncMock(side_effect=RuntimeError("Cartesia API error 400"))):
            with pytest.raises(RuntimeError, match="Cartesia API error 400"):
                await pipeline.run(b"audio", PipelineRequest())

    @pytest.mark.asyncio
    async def test_custom_system_prompt_passed_to_llm(self, pipeline):
        stt_data = _make_stt_response()
        wav_out = _make_wav_bytes()
        captured: list = []

        async def fake_llm(user_text, language, system_prompt=None, history=None):
            captured.append(system_prompt)
            return "ok"

        custom = "You are a pizza ordering bot."
        with patch.object(pipeline, "_call_stt", AsyncMock(return_value=stt_data)), \
             patch("core.pipeline.generate_response", side_effect=fake_llm), \
             patch("core.pipeline.tts_synthesize", AsyncMock(return_value=(wav_out, "hi"))):
            await pipeline.run(b"audio", PipelineRequest(system_prompt=custom))

        assert captured[0] == custom


# ---------------------------------------------------------------------------
# FastAPI endpoint tests
# ---------------------------------------------------------------------------

class TestPipelineAPI:
    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app import app
        return TestClient(app)

    def test_health_endpoint(self, client):
        resp = client.get("/ml/pipeline/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "stt" in data["services"]
        assert "llm" in data["services"]
        assert "cartesia" in data["services"]["tts"]

    def test_voice_endpoint_empty_file(self, client):
        resp = client.post(
            "/ml/pipeline/voice",
            files={"file": ("audio.wav", b"", "audio/wav")},
        )
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"]

    def test_voice_endpoint_success(self, client):
        wav = _make_wav_bytes()
        stt_data = _make_stt_response()
        llm_text = "हाँ, मैं मदद कर सकता हूँ।"

        with patch("core.pipeline.VoicePipeline._call_stt", AsyncMock(return_value=stt_data)), \
             patch("core.pipeline.generate_response", AsyncMock(return_value=llm_text)), \
             patch("core.pipeline.tts_synthesize", AsyncMock(return_value=(wav, "hi"))):

            resp = client.post(
                "/ml/pipeline/voice",
                files={"file": ("audio.wav", b"fake-audio", "audio/wav")},
                data={"language_hint": "hi", "session_id": "test-sess"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["transcript"] == stt_data["text"]
        assert data["llm_response"] == llm_text
        assert data["language"] == "hi"
        assert data["audio_base64"]  # non-empty

    def test_session_clear(self, client):
        _sessions["my-session"] = [{"role": "user", "content": "hi"}]
        resp = client.delete("/ml/pipeline/session/my-session")
        assert resp.status_code == 200
        assert resp.json()["cleared"] is True
        assert "my-session" not in _sessions

    def test_session_get(self, client):
        _sessions["view-sess"] = [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]
        resp = client.get("/ml/pipeline/session/view-sess")
        assert resp.status_code == 200
        data = resp.json()
        assert data["turns"] == 1
        assert len(data["history"]) == 2
