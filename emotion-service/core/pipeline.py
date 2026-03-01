"""emotion2vec+ inference pipeline.

Model: iic/emotion2vec_plus_large (via FunASR / ModelScope)
Input: raw audio bytes (WAV, 16kHz mono preferred)
Output: EmotionResult with label + scores dict
"""
from __future__ import annotations

import io
import os
from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np
import soundfile as sf
from loguru import logger


# Emotion label mapping from emotion2vec+ output indices
EMOTION_LABELS = [
    "angry", "disgusted", "fearful", "happy",
    "neutral", "other", "sad", "surprised",
]

# Labels we expose to the LLM (map "other" -> "neutral")
LABEL_MAP = {
    "angry": "angry",
    "disgusted": "disgusted",
    "fearful": "fearful",
    "happy": "happy",
    "neutral": "neutral",
    "other": "neutral",
    "sad": "sad",
    "surprised": "surprised",
}


@dataclass
class EmotionResult:
    label: str
    score: float
    all_scores: Dict[str, float] = field(default_factory=dict)


class EmotionPipeline:
    """Wraps emotion2vec_plus_large for per-utterance scoring."""

    def __init__(self, device: str = "cpu", model_cache_dir: str = "/models/emotion") -> None:
        self.device = device
        self.model_cache_dir = model_cache_dir
        self._model = None
        self._load_model()

    def _load_model(self) -> None:
        try:
            from funasr import AutoModel  # type: ignore

            os.makedirs(self.model_cache_dir, exist_ok=True)
            logger.info("Loading emotion2vec_plus_large ...")
            self._model = AutoModel(
                model="iic/emotion2vec_plus_large",
                hub="ms",
                cache_dir=self.model_cache_dir,
                device=self.device,
            )
            logger.info("emotion2vec_plus_large loaded on {}", self.device)
        except Exception as exc:
            logger.error("Failed to load emotion model: {}", exc)
            self._model = None

    def analyze(self, audio_bytes: bytes, sample_rate: int = 16000) -> EmotionResult:
        """Analyze emotion from raw audio bytes.

        Args:
            audio_bytes: WAV file bytes OR raw PCM int16 bytes at `sample_rate`.
            sample_rate: Expected sample rate (16000 for STT pipeline).

        Returns:
            EmotionResult with dominant label and per-class scores.
        """
        if self._model is None:
            logger.warning("Emotion model not loaded, returning neutral")
            return EmotionResult(label="neutral", score=1.0, all_scores={"neutral": 1.0})

        try:
            # Try to parse as WAV first, else treat as raw PCM int16
            try:
                audio_array, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
            except Exception:
                audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                sr = sample_rate

            # Ensure mono
            if audio_array.ndim > 1:
                audio_array = audio_array.mean(axis=1)

            result = self._model.generate(
                audio_array,
                output_dir=None,
                granularity="utterance",
                extract_embedding=False,
            )

            # result is a list of dicts; first element has scores
            scores_raw: List[float] = result[0].get("scores", [])
            label_idx: int = int(np.argmax(scores_raw)) if scores_raw else 4  # default neutral

            raw_label = EMOTION_LABELS[label_idx] if label_idx < len(EMOTION_LABELS) else "neutral"
            mapped_label = LABEL_MAP.get(raw_label, "neutral")
            top_score = float(scores_raw[label_idx]) if scores_raw else 1.0

            all_scores = {
                LABEL_MAP.get(EMOTION_LABELS[i], "neutral"): float(s)
                for i, s in enumerate(scores_raw)
                if i < len(EMOTION_LABELS)
            }

            return EmotionResult(label=mapped_label, score=top_score, all_scores=all_scores)

        except Exception as exc:
            logger.error("Emotion analysis error: {}", exc)
            return EmotionResult(label="neutral", score=1.0, all_scores={"neutral": 1.0})
