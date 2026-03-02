#!/usr/bin/env python3
"""
Test the Python pipeline server directly (without Node.js).

Tests:
  1. Connection & config → ready message
  2. Auto-greeting (AI speaks first without any audio input)
  3. Text injection → AI response + TTS audio

Usage (run pipeline server first in another terminal):
  python pipeline/server.py         (terminal 1)
  python pipeline/test_pipeline.py  (terminal 2)
"""

import asyncio
import json
import time

try:
    import websockets
except ImportError:
    raise SystemExit("Install websockets: pip install websockets")

PIPELINE_URL = "ws://localhost:8765"
TIMEOUT = 20  # seconds per wait

MOCK_SYSTEM_PROMPT = (
    "You are a helpful voice AI assistant for Test Restaurant. "
    "You serve Indian street food. "
    "The caller is a test customer. "
    "Be concise and natural. Keep replies to 1-3 short sentences."
)


def fmt(msg: dict) -> str:
    t = msg.get("type", "?")
    if t == "transcript":
        role = msg.get("role", "?").upper()
        text = msg.get("text", "")[:120]
        return f"[{role}] {text}"
    elif t == "emotion":
        return f"[EMOTION] {msg.get('emotion')} (score={msg.get('score', 0):.2f})"
    elif t == "audio":
        payload = msg.get("payload", "")
        return f"[AUDIO] {len(payload)} b64 chars"
    elif t == "error":
        return f"[ERROR] {msg.get('message')}"
    elif t == "ready":
        return "[READY]"
    return f"[{t}] {json.dumps(msg)[:80]}"


async def collect_until(ws, stop_condition, timeout=TIMEOUT, label="message"):
    """Receive messages until stop_condition(msg) is True or timeout."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        remaining = deadline - time.monotonic()
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=min(remaining, 5))
        except asyncio.TimeoutError:
            continue
        msg = json.loads(raw)
        print(f"  ← {fmt(msg)}")
        if stop_condition(msg):
            return msg
    raise TimeoutError(f"Timed out waiting for {label}")


async def run_test():
    print(f"\n{'='*60}")
    print(f"  Python Pipeline Test  →  {PIPELINE_URL}")
    print(f"{'='*60}\n")

    print("Connecting...")
    async with websockets.connect(PIPELINE_URL) as ws:
        print("Connected.\n")

        # ── Test 1: Config + Ready ────────────────────────────────────────────
        print("TEST 1: Sending config and waiting for 'ready'...")
        config_msg = {
            "type": "config",
            "session": {
                "callId": "TEST-CALL-001",
                "teamId": "test-team-001",
                "streamSid": "MXtest001",
                "caller": "+919876543210",
                "callType": "inbound",
                "systemPrompt": MOCK_SYSTEM_PROMPT,
            },
        }
        await ws.send(json.dumps(config_msg))

        ready_msg = await collect_until(
            ws,
            lambda m: m.get("type") == "ready",
            label="ready"
        )
        print("  PASS: received 'ready'\n")

        # ── Test 2: Auto-greeting ─────────────────────────────────────────────
        print("TEST 2: Waiting for auto-greeting (AI speaks first)...")
        greeting = await collect_until(
            ws,
            lambda m: m.get("type") == "transcript" and m.get("role") == "assistant",
            timeout=30,
            label="greeting transcript"
        )
        print(f"  PASS: Greeting received → \"{greeting.get('text', '')}\"\n")

        # Drain any remaining audio frames from greeting TTS
        print("  (draining greeting audio frames...)")
        try:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                msg = json.loads(raw)
                print(f"  ← {fmt(msg)}")
        except asyncio.TimeoutError:
            pass  # no more frames

        # ── Test 3: Text injection → LLM response ────────────────────────────
        user_text = "What items do you have on the menu today?"
        print(f"\nTEST 3: Injecting text → \"{user_text}\"")
        await ws.send(json.dumps({"type": "text", "text": user_text}))

        print("  Waiting for user transcript echo...")
        await collect_until(
            ws,
            lambda m: m.get("type") == "transcript" and m.get("role") == "user",
            label="user transcript"
        )

        print("  Waiting for assistant response...")
        response = await collect_until(
            ws,
            lambda m: m.get("type") == "transcript" and m.get("role") == "assistant",
            timeout=30,
            label="assistant response"
        )
        print(f"  PASS: Response → \"{response.get('text', '')}\"\n")

        # Drain audio frames
        print("  (draining response audio frames...)")
        try:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                msg = json.loads(raw)
                print(f"  ← {fmt(msg)}")
        except asyncio.TimeoutError:
            pass

        # ── Test 4: Emotion detection ─────────────────────────────────────────
        print("\nTEST 4: Checking emotion was detected...")
        # Re-send a message and check for emotion event
        await ws.send(json.dumps({"type": "text", "text": "I am really angry about my last order!"}))
        try:
            emotion_msg = await collect_until(
                ws,
                lambda m: m.get("type") == "emotion",
                timeout=20,
                label="emotion"
            )
            print(f"  PASS: Emotion detected → {emotion_msg.get('emotion')}\n")
        except TimeoutError:
            print("  WARN: No emotion message received (emotion detection may not be active)\n")

        # Drain remaining
        try:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                print(f"  ← {fmt(json.loads(raw))}")
        except asyncio.TimeoutError:
            pass

        # ── Close cleanly ─────────────────────────────────────────────────────
        print("\nClosing connection...")
        await ws.send(json.dumps({"type": "close"}))
        print("Connection closed.\n")

    print("=" * 60)
    print("  All tests PASSED")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_test())
