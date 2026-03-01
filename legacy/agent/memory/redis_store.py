"""Redis-backed conversation + emotion history per call.

Key schema:
  call:{call_id}:turns   → Redis list of JSON-encoded ConversationTurn dicts
  call:{call_id}:meta    → Redis hash: company_id, caller_number, status
  TTL: 2 hours after last write
"""
from __future__ import annotations

import json
from typing import List, Optional

import redis.asyncio as aioredis
from loguru import logger

from agent.config import settings
from agent.memory.schemas import ConversationTurn

_HISTORY_LIMIT = 20
_TTL_SECONDS = 7200  # 2 hours


class RedisStore:
    def __init__(self) -> None:
        self._redis: Optional[aioredis.Redis] = None

    async def connect(self) -> None:
        self._redis = await aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        logger.info("RedisStore connected to {}", settings.redis_url)

    async def disconnect(self) -> None:
        if self._redis:
            await self._redis.aclose()

    # ── Turn history ──────────────────────────────────────────────────────────

    def _turns_key(self, call_id: str) -> str:
        return f"call:{call_id}:turns"

    def _meta_key(self, call_id: str) -> str:
        return f"call:{call_id}:meta"

    async def append_turn(self, call_id: str, turn: ConversationTurn) -> None:
        key = self._turns_key(call_id)
        payload = json.dumps({
            "turn_index": turn.turn_index,
            "speaker_text": turn.speaker_text,
            "agent_text": turn.agent_text,
            "emotion": turn.emotion,
            "emotion_score": turn.emotion_score,
            "stt_confidence": turn.stt_confidence,
            "latency_ms": turn.latency_ms,
            "tool_calls": turn.tool_calls,
        })
        await self._redis.rpush(key, payload)
        await self._redis.expire(key, _TTL_SECONDS)

    async def get_turns(self, call_id: str, last_n: int = _HISTORY_LIMIT) -> List[ConversationTurn]:
        key = self._turns_key(call_id)
        raw_list = await self._redis.lrange(key, -last_n, -1)
        turns: List[ConversationTurn] = []
        for raw in raw_list:
            try:
                d = json.loads(raw)
                turns.append(ConversationTurn(**d))
            except Exception as exc:
                logger.warning("Failed to deserialize turn: {}", exc)
        return turns

    # ── Call metadata ─────────────────────────────────────────────────────────

    async def set_meta(self, call_id: str, meta: dict) -> None:
        key = self._meta_key(call_id)
        await self._redis.hset(key, mapping={k: str(v) for k, v in meta.items()})
        await self._redis.expire(key, _TTL_SECONDS)

    async def get_meta(self, call_id: str) -> dict:
        key = self._meta_key(call_id)
        return await self._redis.hgetall(key)

    async def delete_call(self, call_id: str) -> None:
        await self._redis.delete(self._turns_key(call_id), self._meta_key(call_id))
