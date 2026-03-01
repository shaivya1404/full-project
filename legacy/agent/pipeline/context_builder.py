"""Builds EmotionContext each turn — used to inject emotion awareness into the LLM prompt."""
from __future__ import annotations

from collections import Counter
from typing import List

from agent.memory.schemas import ConversationTurn, EmotionContext


# Emotions that warrant special handling in the system prompt
ESCALATION_EMOTIONS = {"angry", "fearful", "disgusted"}


def build_emotion_context(turns: List[ConversationTurn]) -> EmotionContext:
    """Build an EmotionContext from the last N turns.

    Args:
        turns: Recent conversation turns (from Redis).

    Returns:
        EmotionContext with current + history + escalation flag + LLM note.
    """
    if not turns:
        return EmotionContext(
            current_emotion="neutral",
            current_score=1.0,
            history=[],
            dominant_emotion="neutral",
            escalation_flag=False,
            llm_note="",
        )

    # Current emotion = last turn
    last = turns[-1]
    current_emotion = last.emotion
    current_score = last.emotion_score or 0.0

    # History = all emotions in order
    history = [(t.emotion, t.emotion_score or 0.0) for t in turns]

    # Dominant = most frequent over last N turns
    emotion_counts = Counter(t.emotion for t in turns)
    dominant_emotion = emotion_counts.most_common(1)[0][0]

    # Escalation: any of last 3 turns is an escalation emotion
    recent = turns[-3:]
    escalation_flag = any(t.emotion in ESCALATION_EMOTIONS for t in recent)

    # Build a short natural-language note for the LLM system prompt injection
    llm_note = _build_llm_note(current_emotion, dominant_emotion, escalation_flag)

    return EmotionContext(
        current_emotion=current_emotion,
        current_score=current_score,
        history=history,
        dominant_emotion=dominant_emotion,
        escalation_flag=escalation_flag,
        llm_note=llm_note,
    )


def _build_llm_note(current: str, dominant: str, escalation: bool) -> str:
    notes: list[str] = []

    if current == "angry":
        notes.append("The customer sounds angry right now. Stay calm, acknowledge their frustration, and be extra helpful.")
    elif current == "sad":
        notes.append("The customer sounds upset. Show empathy before jumping to solutions.")
    elif current == "fearful":
        notes.append("The customer sounds anxious. Reassure them and be clear and concise.")
    elif current == "happy":
        notes.append("The customer sounds happy. Match their positive tone.")
    elif current == "disgusted":
        notes.append("The customer sounds very dissatisfied. Apologize sincerely and focus on resolution.")
    elif current == "surprised":
        notes.append("The customer sounds surprised. Clarify and explain clearly.")

    if escalation and dominant in ESCALATION_EMOTIONS:
        notes.append("This call has been escalating emotionally. Prioritize de-escalation. Offer to involve a human agent if needed.")

    return " ".join(notes)
