"""
End-to-end pipeline test script.

Tests the full call flow without needing a real phone:
  1. Health checks on all services
  2. Seeds a test company + phone number via admin-api
  3. Starts a call session (POST /calls)
  4. Connects WebSocket, sends real audio, receives agent response

Usage:
    pip install httpx websockets soundfile numpy
    python scripts/test_pipeline.py

Requirements running:
    - admin-api   on :8006
    - agent       on :8010 (WS) / :8011 (HTTP)
    - stt-service on :8002        (optional, skipped if down)
    - emotion-service on :8003    (optional, skipped if down)
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import struct
import sys
import time
import wave
from pathlib import Path

import httpx

ADMIN_URL = os.getenv("ADMIN_API_URL", "http://localhost:8006")
AGENT_HTTP_URL = os.getenv("AGENT_HTTP_URL", "http://localhost:8011")
STT_URL = os.getenv("STT_SERVICE_URL", "http://localhost:8002")
EMOTION_URL = os.getenv("EMOTION_SERVICE_URL", "http://localhost:8003")

TEST_PHONE_TO = "+911234567890"    # the "company" number
TEST_PHONE_FROM = "+919999999999"  # the "caller" number

# Use a real WAV if you have one, else we generate a silent test tone
TEST_AUDIO_PATH = os.getenv("TEST_AUDIO_PATH", "")


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_test_audio_pcm(duration_sec: float = 2.0, sample_rate: int = 16000) -> bytes:
    """Generate a simple 440Hz tone as raw PCM int16 bytes (simulates speech)."""
    import math
    n_samples = int(sample_rate * duration_sec)
    samples = []
    for i in range(n_samples):
        # 440 Hz sine wave
        value = int(32767 * math.sin(2 * math.pi * 440 * i / sample_rate))
        samples.append(value)
    return struct.pack(f"<{n_samples}h", *samples)


def load_audio_as_pcm(path: str) -> bytes:
    """Load a WAV file and return raw PCM int16 bytes at 16kHz mono."""
    try:
        import soundfile as sf
        import numpy as np
        audio, sr = sf.read(path, dtype="int16")
        if audio.ndim > 1:
            audio = audio.mean(axis=1).astype("int16")
        if sr != 16000:
            # simple resample using numpy (not ideal but works for testing)
            ratio = 16000 / sr
            new_len = int(len(audio) * ratio)
            indices = np.round(np.linspace(0, len(audio) - 1, new_len)).astype(int)
            audio = audio[indices]
        return audio.tobytes()
    except Exception as e:
        print(f"  Could not load {path}: {e}. Using generated tone.")
        return make_test_audio_pcm()


def pcm_to_wav_bytes(pcm: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap raw PCM int16 bytes into a WAV container for STT/emotion services."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)   # int16 = 2 bytes
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def ok(msg: str) -> None:
    print(f"  [OK]  {msg}")


def fail(msg: str) -> None:
    print(f"  [FAIL] {msg}")


def section(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ── Individual service tests ────────────────────────────────────────────────────

def test_admin_api(client: httpx.Client) -> str | None:
    """Returns company_id if successful."""
    section("1. Admin API (:8006)")

    # Health
    try:
        r = client.get(f"{ADMIN_URL}/admin/v1/health")
        if r.status_code == 200:
            ok(f"Health: {r.json()}")
        else:
            fail(f"Health returned {r.status_code}")
            return None
    except Exception as e:
        fail(f"Cannot reach admin-api: {e}")
        return None

    # Create test company
    payload = {
        "org_id": "test-org-001",
        "name": "Acme Support",
        "agent_name": "Aria",
        "system_prompt": (
            "You are Aria, a helpful customer support agent for Acme Corp. "
            "Be concise and friendly. This is a phone call."
        ),
        "product_context": "We sell cloud software for small businesses.",
        "faq_context": (
            "Q: What are your hours?\nA: We are available 24/7.\n\n"
            "Q: How do I reset my password?\nA: Go to Settings > Account > Reset Password."
        ),
        "language": "en",
        "voice_id": os.getenv("CARTESIA_VOICE_ID", ""),
        "max_turns": 10,
    }
    r = client.post(f"{ADMIN_URL}/admin/v1/companies", json=payload)
    if r.status_code in (200, 201):
        company = r.json()
        ok(f"Company created: id={company['id']} name={company['name']}")
    else:
        fail(f"Company creation failed: {r.status_code} {r.text}")
        return None

    company_id = company["id"]

    # Register phone number
    r = client.post(
        f"{ADMIN_URL}/admin/v1/phone-numbers",
        json={"company_id": company_id, "number": TEST_PHONE_TO},
    )
    if r.status_code in (200, 201):
        pn = r.json()
        ok(f"Phone number registered: {pn['number']} -> company {company_id}")
    else:
        fail(f"Phone number registration failed: {r.status_code} {r.text}")
        return None

    return company_id


def test_stt_service(client: httpx.Client, wav_bytes: bytes) -> None:
    section("2. STT Service (:8002)")
    try:
        r = client.get(f"{STT_URL}/ml/stt/health", timeout=5)
        ok(f"Health: {r.json().get('status')}")
    except Exception as e:
        fail(f"Cannot reach stt-service: {e}")
        return

    # Test base Whisper
    try:
        r = client.post(
            f"{STT_URL}/ml/stt/transcribe",
            files={"file": ("test.wav", wav_bytes, "audio/wav")},
            timeout=30,
        )
        if r.status_code == 200:
            result = r.json()
            ok(f"Whisper large-v3: '{result.get('text', '')}' (conf={result.get('confidence', 0):.2f})")
        else:
            fail(f"Transcribe returned {r.status_code}: {r.text[:200]}")
    except Exception as e:
        fail(f"Transcribe error: {e}")

    # Test LoRA endpoint
    try:
        r = client.post(
            f"{STT_URL}/ml/stt/transcribe/lora",
            files={"file": ("test.wav", wav_bytes, "audio/wav")},
            timeout=30,
        )
        if r.status_code == 200:
            result = r.json()
            ok(f"Whisper Small+LoRA: '{result.get('text', '')}' (conf={result.get('confidence', 0):.2f})")
        elif r.status_code == 503:
            print("  [SKIP] LoRA model not loaded yet (set LORA_MODEL_PATH to your model dir)")
        else:
            fail(f"LoRA transcribe returned {r.status_code}: {r.text[:200]}")
    except Exception as e:
        fail(f"LoRA transcribe error: {e}")


def test_emotion_service(client: httpx.Client, wav_bytes: bytes) -> None:
    section("3. Emotion Service (:8003)")
    try:
        r = client.get(f"{EMOTION_URL}/emotion/health", timeout=5)
        ok(f"Health: {r.json()}")
    except Exception as e:
        fail(f"Cannot reach emotion-service: {e}")
        return

    try:
        audio_b64 = base64.b64encode(wav_bytes).decode()
        r = client.post(
            f"{EMOTION_URL}/emotion/analyze",
            json={"audio_b64": audio_b64, "sample_rate": 16000},
            timeout=30,
        )
        if r.status_code == 200:
            result = r.json()
            ok(f"Emotion: {result['label']} (score={result['score']:.2f})")
            ok(f"All scores: {result['all_scores']}")
        else:
            fail(f"Analyze returned {r.status_code}: {r.text[:200]}")
    except Exception as e:
        fail(f"Analyze error: {e}")


async def test_full_agent(pcm_bytes: bytes) -> None:
    section("4. Full Agent — WebSocket end-to-end (:8011 HTTP / :8010 WS)")

    try:
        import websockets
    except ImportError:
        fail("pip install websockets  — then re-run")
        return

    async with httpx.AsyncClient() as client:
        # Step A: Start call
        try:
            r = await client.post(
                f"{AGENT_HTTP_URL}/calls",
                json={
                    "to_number": TEST_PHONE_TO,
                    "from_number": TEST_PHONE_FROM,
                    "call_id": "test-call-001",
                },
                timeout=10,
            )
        except Exception as e:
            fail(f"Cannot reach agent HTTP: {e}")
            return

        if r.status_code == 404:
            fail(f"Phone number {TEST_PHONE_TO} not registered — did admin-api test pass?")
            return
        if r.status_code != 200:
            fail(f"POST /calls returned {r.status_code}: {r.text}")
            return

        data = r.json()
        ok(f"Call started: call_id={data['call_id']}")
        ok(f"Agent: {data.get('agent_name')} @ {data.get('company_name')}")
        ws_url = data["ws_url"]
        ok(f"WebSocket URL: {ws_url}")

    # Step B: Connect WebSocket and stream audio
    print(f"\n  Connecting to {ws_url} ...")
    try:
        async with websockets.connect(ws_url) as ws:
            ok("WebSocket connected")

            # Send audio in 20ms chunks (320 samples @ 16kHz = 640 bytes)
            # This simulates a real-time audio stream from the calling product
            CHUNK_SIZE = 640  # 20ms @ 16kHz int16
            total_chunks = len(pcm_bytes) // CHUNK_SIZE
            print(f"  Streaming {len(pcm_bytes)} bytes ({total_chunks} chunks of 20ms)...")

            send_start = time.monotonic()
            for i in range(0, len(pcm_bytes), CHUNK_SIZE):
                chunk = pcm_bytes[i : i + CHUNK_SIZE]
                await ws.send(chunk)
                await asyncio.sleep(0.02)  # real-time pacing

            send_elapsed = time.monotonic() - send_start
            ok(f"Audio sent in {send_elapsed:.2f}s")

            # Wait for agent response (text or audio)
            print("\n  Waiting for agent response (up to 30s)...")
            response_start = time.monotonic()
            audio_received = 0
            text_received = ""

            try:
                async with asyncio.timeout(30):
                    async for message in ws:
                        if isinstance(message, bytes):
                            audio_received += len(message)
                            if audio_received == len(message):  # first chunk
                                latency = int((time.monotonic() - send_elapsed - send_start) * 1000)
                                ok(f"First audio chunk received! Latency ~{latency}ms")
                        elif isinstance(message, str):
                            try:
                                event = json.loads(message)
                                evt_type = event.get("type", "")
                                if evt_type == "agent_text":
                                    text_received = event.get("text", "")
                                    ok(f"Agent says: '{text_received}'")
                                elif evt_type == "transcript":
                                    ok(f"Transcript: '{event.get('text')}' [{event.get('emotion')}]")
                                elif evt_type == "call_ended":
                                    ok("Call ended cleanly")
                                    break
                            except Exception:
                                print(f"  Raw message: {message[:100]}")

                        # After receiving a response, end the call
                        if audio_received > 0 or text_received:
                            await ws.send(json.dumps({"type": "end"}))
                            break

            except asyncio.TimeoutError:
                fail("No response in 30s — check service logs")

            if audio_received > 0:
                ok(f"Total audio received: {audio_received} bytes ({audio_received/32000:.2f}s of speech)")
            elif text_received:
                ok("Received text response (no voice_id set — expected)")

    except Exception as e:
        fail(f"WebSocket error: {e}")


# ── Main ───────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n VOICE AGENT PIPELINE TEST")
    print(f" Admin API  : {ADMIN_URL}")
    print(f" Agent HTTP : {AGENT_HTTP_URL}")
    print(f" STT        : {STT_URL}")
    print(f" Emotion    : {EMOTION_URL}")

    # Load or generate test audio
    if TEST_AUDIO_PATH and Path(TEST_AUDIO_PATH).exists():
        print(f"\n Using audio file: {TEST_AUDIO_PATH}")
        pcm_bytes = load_audio_as_pcm(TEST_AUDIO_PATH)
    else:
        print("\n No TEST_AUDIO_PATH set — using generated 440Hz tone (2 seconds)")
        print(" For better results: TEST_AUDIO_PATH=path/to/your/speech.wav python scripts/test_pipeline.py")
        pcm_bytes = make_test_audio_pcm(duration_sec=2.0)

    wav_bytes = pcm_to_wav_bytes(pcm_bytes)

    with httpx.Client(timeout=30) as client:
        company_id = test_admin_api(client)
        test_stt_service(client, wav_bytes)
        test_emotion_service(client, wav_bytes)

    await test_full_agent(pcm_bytes)

    section("Done")
    print("  Check logs above for any [FAIL] items.")
    print("  All [OK] = system is working end-to-end.\n")


if __name__ == "__main__":
    asyncio.run(main())
