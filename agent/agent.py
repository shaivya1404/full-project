"""VoiceAgent — full per-call orchestration loop.

One VoiceAgent instance is created per WebSocket connection (= per call).

Flow per utterance:
  1. VAD fires speech_end -> audio_bytes available
  2. asyncio.gather: STT + Emotion (parallel)
  3. Build EmotionContext from Redis history + current emotion
  4. Load last 20 turns from Redis
  5. Build LLM messages: system + emotion_note + history + user
  6. Stream Qwen: text deltas -> Cartesia TTS stream -> audio out on WS
     tool_calls -> tool-middleware -> inject result -> continue LLM
  7. Save turn to Redis + PostgreSQL (async, non-blocking)
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import TYPE_CHECKING, Optional

from loguru import logger
from sqlalchemy import text

from agent.config import settings
from agent.db import SessionLocal
from agent.memory.redis_store import RedisStore
from agent.memory.schemas import CompanyConfig, ConversationTurn
from agent.pipeline.context_builder import build_emotion_context
from agent.pipeline.emotion_client import EmotionClient
from agent.pipeline.llm_client import LLMClient
from agent.pipeline.stt_client import STTClient
from agent.pipeline.tts_client import TTSClient
from agent.pipeline.vad import VADProcessor
from agent.tools.definitions import TOOLS
from agent.tools.middleware_client import MiddlewareClient

if TYPE_CHECKING:
    import websockets


class VoiceAgent:
    """Manages the full lifetime of one phone call."""

    def __init__(
        self,
        call_id: str,
        company: CompanyConfig,
        caller_number: str,
        to_number: str,
        ws,  # websockets.WebSocketServerProtocol
        redis: RedisStore,
    ) -> None:
        self.call_id = call_id
        self.company = company
        self.caller_number = caller_number
        self.to_number = to_number
        self.ws = ws
        self.redis = redis

        self._stt = STTClient()
        self._emotion = EmotionClient()
        self._llm = LLMClient()
        self._tts = TTSClient()
        self._tools = MiddlewareClient()

        self._turn_index: int = 0
        self._db_call_session_id: Optional[str] = None
        self._pending_audio: Optional[bytes] = None
        self._processing: bool = False

        # VAD fires callbacks into our handler
        self._vad = VADProcessor(
            silence_ms=settings.vad_silence_ms,
            on_speech_start=self._on_speech_start,
            on_speech_end=self._on_speech_end,
        )

        # asyncio queue: VAD puts audio in, processing loop reads
        self._utterance_queue: asyncio.Queue[bytes] = asyncio.Queue()

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Initialize DB session row, Redis meta, send greeting."""
        self._db_call_session_id = await self._create_call_session()
        await self.redis.set_meta(self.call_id, {
            "company_id": self.company.id,
            "caller_number": self.caller_number,
            "to_number": self.to_number,
            "status": "active",
            "db_session_id": self._db_call_session_id,
        })
        logger.info("Call {} started for company {} ({})", self.call_id, self.company.name, self.caller_number)

        # Send greeting to caller
        greeting = f"Hello, thank you for calling. I'm {self.company.agent_name}. How can I help you today?"
        await self._tts_and_send(greeting)

    async def handle_audio(self, audio_bytes: bytes) -> None:
        """Feed incoming PCM bytes from WebSocket into VAD."""
        self._vad.feed(audio_bytes)

    async def process_utterances(self) -> None:
        """Processing loop — runs concurrently with the WebSocket reader."""
        while True:
            audio = await self._utterance_queue.get()
            if audio is None:  # shutdown signal
                break
            await self._process_utterance(audio)

    async def end(self) -> None:
        """Graceful shutdown: close clients, update DB."""
        self._vad.reset()
        await self._utterance_queue.put(None)  # stop processing loop
        await self._update_call_session_ended()
        await asyncio.gather(
            self._stt.close(),
            self._emotion.close(),
            self._llm.close(),
            self._tts.close(),
            self._tools.close(),
        )
        logger.info("Call {} ended ({} turns)", self.call_id, self._turn_index)

    # ── VAD callbacks ──────────────────────────────────────────────────────────

    def _on_speech_start(self) -> None:
        # Signal to the calling product that we're listening (optional)
        pass

    def _on_speech_end(self, audio_bytes: bytes) -> None:
        """Called by VAD (sync) — enqueue for async processing."""
        self._utterance_queue.put_nowait(audio_bytes)

    # ── Core turn processing ───────────────────────────────────────────────────

    async def _process_utterance(self, audio_bytes: bytes) -> None:
        if self._turn_index >= self.company.max_turns:
            await self._tts_and_send("We've reached the end of our conversation time. Thank you for calling. Goodbye!")
            return

        turn_start = time.monotonic()
        self._turn_index += 1
        turn_idx = self._turn_index

        # ── Step 1: Parallel STT + Emotion ───────────────────────────────────
        lang_hint = self.company.language if self.company.language != "en_hi" else None
        stt_result, emotion_result = await asyncio.gather(
            self._stt.transcribe(audio_bytes, language_hint=lang_hint),
            self._emotion.analyze(audio_bytes),
        )

        user_text: str = stt_result.get("text", "").strip()
        stt_confidence: float = stt_result.get("confidence", 0.0)
        emotion_label: str = emotion_result.get("label", "neutral")
        emotion_score: float = emotion_result.get("score", 1.0)

        if not user_text:
            logger.debug("Empty STT result for turn {}, skipping", turn_idx)
            return

        logger.info("[Turn {}] User: '{}' | Emotion: {} ({:.2f})", turn_idx, user_text, emotion_label, emotion_score)

        # ── Step 2: Build EmotionContext from history ────────────────────────
        prior_turns = await self.redis.get_turns(self.call_id)
        # Temporarily add current emotion to context building
        dummy_turn = ConversationTurn(
            turn_index=turn_idx,
            speaker_text=user_text,
            agent_text="",
            emotion=emotion_label,
            emotion_score=emotion_score,
        )
        emotion_ctx = build_emotion_context(prior_turns + [dummy_turn])

        # ── Step 3: Build LLM messages ───────────────────────────────────────
        messages = self._build_messages(user_text, prior_turns, emotion_ctx.llm_note)

        # ── Step 4: Stream LLM → TTS ─────────────────────────────────────────
        agent_text, tool_calls_log = await self._stream_llm_to_tts(messages)

        latency_ms = int((time.monotonic() - turn_start) * 1000)
        logger.info("[Turn {}] Agent: '{}' | Latency: {}ms", turn_idx, agent_text[:80], latency_ms)

        # ── Step 5: Persist (non-blocking) ───────────────────────────────────
        turn = ConversationTurn(
            turn_index=turn_idx,
            speaker_text=user_text,
            agent_text=agent_text,
            emotion=emotion_label,
            emotion_score=emotion_score,
            stt_confidence=stt_confidence,
            latency_ms=latency_ms,
            tool_calls=tool_calls_log or None,
        )
        asyncio.create_task(self._persist_turn(turn))

    # ── LLM streaming + TTS ───────────────────────────────────────────────────

    async def _stream_llm_to_tts(self, messages: list) -> tuple[str, list]:
        """Stream Qwen output. On tool_call: execute tool, inject result, continue.
        Simultaneously stream TTS audio back to caller.
        Returns (full_agent_text, tool_calls_log).
        """
        full_text = ""
        tool_calls_log = []
        tts_buffer = ""  # Accumulate until sentence boundary for lower TTS latency

        async for event in self._llm.chat_stream(messages, tools=TOOLS):
            if event["type"] == "text_delta":
                delta = event["delta"]
                full_text += delta
                tts_buffer += delta

                # Send TTS on sentence boundaries to minimize latency
                if any(tts_buffer.rstrip().endswith(p) for p in (".", "!", "?", "...", "\n")):
                    await self._tts_and_send(tts_buffer.strip())
                    tts_buffer = ""

            elif event["type"] == "tool_call":
                name = event["name"]
                args = event["arguments"]
                # Auto-inject company_id for tools that need it
                args.setdefault("company_id", self.company.id)
                if name == "lookup_customer":
                    args.setdefault("phone", self.caller_number)

                logger.info("[Tool] Calling {} with {}", name, args)
                result = await self._tools.execute(name, args)
                tool_calls_log.append({"name": name, "args": args, "result": result})

                # Inject tool result and continue generation
                messages.append({"role": "assistant", "content": None, "tool_calls": [
                    {"id": f"call_{name}", "type": "function", "function": {"name": name, "arguments": str(args)}}
                ]})
                messages.append({"role": "tool", "tool_call_id": f"call_{name}", "content": json.dumps(result)})

                # Continue streaming after tool result
                async for follow_event in self._llm.chat_stream(messages):
                    if follow_event["type"] == "text_delta":
                        delta = follow_event["delta"]
                        full_text += delta
                        tts_buffer += delta
                        if any(tts_buffer.rstrip().endswith(p) for p in (".", "!", "?", "\n")):
                            await self._tts_and_send(tts_buffer.strip())
                            tts_buffer = ""
                    elif follow_event["type"] == "done":
                        break

            elif event["type"] == "done":
                break

        # Flush any remaining TTS buffer
        if tts_buffer.strip():
            await self._tts_and_send(tts_buffer.strip())

        return full_text, tool_calls_log

    async def _tts_and_send(self, text: str) -> None:
        """Convert text to audio via Cartesia and send over WebSocket."""
        if not text or not self.company.voice_id:
            # If no voice_id configured, send text event so calling product can use its own TTS
            await self._send_event({"type": "agent_text", "text": text})
            return

        lang = self.company.language if self.company.language != "en_hi" else "en"
        try:
            async for chunk in self._tts.synthesize_stream(text, self.company.voice_id, lang):
                await self.ws.send(chunk)
        except Exception as exc:
            logger.error("TTS/send error: {}", exc)

    async def _send_event(self, event: dict) -> None:
        """Send a JSON control event over WebSocket."""
        try:
            await self.ws.send(json.dumps(event))
        except Exception:
            pass

    # ── Message building ───────────────────────────────────────────────────────

    def _build_messages(self, user_text: str, prior_turns: list, emotion_note: str) -> list:
        """Build the full messages list for Qwen."""
        system = self._build_system_prompt(emotion_note)
        messages = [{"role": "system", "content": system}]

        for turn in prior_turns[-10:]:  # last 10 turns in context
            messages.append({"role": "user", "content": turn.speaker_text})
            messages.append({"role": "assistant", "content": turn.agent_text})

        messages.append({"role": "user", "content": user_text})
        return messages

    def _build_system_prompt(self, emotion_note: str) -> str:
        parts = [
            self.company.system_prompt,
            f"Your name is {self.company.agent_name}.",
            f"You are assisting a customer who called {self.company.name}.",
        ]
        if self.company.product_context:
            parts.append(f"\nProduct Information:\n{self.company.product_context}")
        if self.company.faq_context:
            parts.append("\nYou have access to the company FAQ via the search_faq tool.")
        if emotion_note:
            parts.append(f"\nEmotion Guidance: {emotion_note}")
        parts.append("\nKeep responses concise and conversational — this is a phone call.")
        return "\n\n".join(parts)

    # ── DB persistence ─────────────────────────────────────────────────────────

    async def _create_call_session(self) -> str:
        async with SessionLocal() as db:
            row = await db.execute(
                text("""
                    INSERT INTO call_sessions
                        (phone_number_id, company_id, external_call_id, caller_number, status)
                    SELECT pn.id, :company_id, :external_call_id, :caller_number, 'active'
                    FROM phone_numbers pn
                    WHERE pn.number = :to_number AND pn.is_active = true
                    LIMIT 1
                    RETURNING id
                """),
                {
                    "company_id": self.company.id,
                    "external_call_id": self.call_id,
                    "caller_number": self.caller_number,
                    "to_number": self.to_number,
                },
            )
            await db.commit()
            result = row.fetchone()
            if result:
                return str(result.id)
            # Fallback: create without phone_number_id (shouldn't happen)
            logger.error("Could not find phone number {} in DB for call session", self.to_number)
            return self.call_id

    async def _persist_turn(self, turn: ConversationTurn) -> None:
        """Fire-and-forget: saves turn to Redis and PostgreSQL."""
        try:
            await self.redis.append_turn(self.call_id, turn)
        except Exception as exc:
            logger.error("Redis turn persist failed: {}", exc)

        if not self._db_call_session_id:
            return
        try:
            async with SessionLocal() as db:
                await db.execute(
                    text("""
                        INSERT INTO conversation_turns
                            (call_session_id, turn_index, speaker_text, agent_text,
                             emotion, emotion_score, stt_confidence, latency_ms, tool_calls)
                        VALUES
                            (:session_id, :turn_index, :speaker_text, :agent_text,
                             :emotion, :emotion_score, :stt_confidence, :latency_ms, :tool_calls)
                    """),
                    {
                        "session_id": self._db_call_session_id,
                        "turn_index": turn.turn_index,
                        "speaker_text": turn.speaker_text,
                        "agent_text": turn.agent_text,
                        "emotion": turn.emotion,
                        "emotion_score": turn.emotion_score,
                        "stt_confidence": turn.stt_confidence,
                        "latency_ms": turn.latency_ms,
                        "tool_calls": json.dumps(turn.tool_calls) if turn.tool_calls else None,
                    },
                )
                await db.execute(
                    text("UPDATE call_sessions SET turn_count = :tc WHERE id = :id"),
                    {"tc": turn.turn_index, "id": self._db_call_session_id},
                )
                await db.commit()
        except Exception as exc:
            logger.error("DB turn persist failed: {}", exc)

    async def _update_call_session_ended(self) -> None:
        if not self._db_call_session_id:
            return
        try:
            async with SessionLocal() as db:
                await db.execute(
                    text("""
                        UPDATE call_sessions
                        SET status = 'completed',
                            ended_at = now(),
                            duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::int,
                            turn_count = :turns
                        WHERE id = :id
                    """),
                    {"turns": self._turn_index, "id": self._db_call_session_id},
                )
                await db.commit()
        except Exception as exc:
            logger.error("Failed to update call session on end: {}", exc)
