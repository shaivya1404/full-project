"""Dataclasses for in-memory and Redis conversation state."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple


@dataclass
class ConversationTurn:
    turn_index: int
    speaker_text: str
    agent_text: str
    emotion: str = "neutral"
    emotion_score: float = 1.0
    stt_confidence: float = 1.0
    latency_ms: int = 0
    tool_calls: Optional[list] = None


@dataclass
class EmotionContext:
    current_emotion: str
    current_score: float
    history: List[Tuple[str, float]]
    dominant_emotion: str
    escalation_flag: bool
    llm_note: str


@dataclass
class CompanyConfig:
    id: str
    org_id: str
    name: str
    agent_name: str
    system_prompt: str
    product_context: Optional[str]
    faq_context: Optional[str]
    language: str
    voice_id: Optional[str]
    max_turns: int
