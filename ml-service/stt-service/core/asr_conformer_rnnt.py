"""Primary ASR module using AI4Bharat IndicConformer.

Delegates to asr_indic_conformer which manages per-language model loading
and NeMo inference.
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np

from .asr_indic_conformer import get_model_info as _indic_info
from .asr_indic_conformer import transcribe as _indic_transcribe


def transcribe(
    audio_data: np.ndarray,
    language: str | None,
) -> Tuple[str, float, List[Dict[str, Any]], str]:
    """Transcribe audio using IndicConformer.

    Args:
        audio_data: float32 numpy array, 16 kHz mono
        language:   ISO 639-1 code (e.g. "hi", "en", "ta") or None

    Returns:
        (text, confidence, timestamps, model_used)
    """
    return _indic_transcribe(audio_data, language)


def get_model_info() -> Dict[str, Any]:
    return _indic_info()
