"""Audio-based language identification for the STT pipeline.

Uses facebook/mms-lid-126 (Meta MMS Language Identification) which supports
all major Indian languages via audio input — no transcription required.

ISO 639-3 -> ISO 639-1 mapping covers:
    hin -> hi, eng -> en, tam -> ta, tel -> te, ben -> bn,
    mar -> mr, guj -> gu, kan -> kn, mal -> ml, pan -> pa,
    ori -> or, urd -> ur
"""
from __future__ import annotations

from typing import Union

import numpy as np
from loguru import logger

# MMS LID uses ISO 639-3 (3-letter); IndicConformer expects ISO 639-1 (2-letter)
_ISO3_TO_ISO1: dict[str, str] = {
    "hin": "hi",
    "eng": "en",
    "tam": "ta",
    "tel": "te",
    "ben": "bn",
    "mar": "mr",
    "guj": "gu",
    "kan": "kn",
    "mal": "ml",
    "pan": "pa",
    "ori": "or",
    "urd": "ur",
}

LANGUAGE_FALLBACK = "hi"
SAMPLE_RATE = 16000

# Lazy-loaded pipeline
_lid_pipeline = None


def _get_lid_pipeline():
    """Load facebook/mms-lid-126 once and cache it."""
    global _lid_pipeline
    if _lid_pipeline is not None:
        return _lid_pipeline

    try:
        from transformers import pipeline as hf_pipeline  # type: ignore

        logger.info("Loading MMS language identification model (facebook/mms-lid-126) ...")
        _lid_pipeline = hf_pipeline(
            "audio-classification",
            model="facebook/mms-lid-126",
        )
        logger.info("MMS LID model loaded successfully")
    except Exception as exc:
        logger.warning("MMS LID model failed to load ({}); will use fallback '{}'", exc, LANGUAGE_FALLBACK)
        _lid_pipeline = None

    return _lid_pipeline


def detect_language(audio_data: Union[np.ndarray, bytes], hint: str | None) -> str:
    """Detect spoken language from audio.

    If a hint is provided it is used directly (after normalisation).
    Otherwise facebook/mms-lid-126 classifies the audio and the top
    prediction is mapped to an ISO 639-1 code.

    Args:
        audio_data: 16 kHz mono float32 numpy array (or raw bytes, ignored)
        hint:       Optional ISO 639-1 language code from the caller

    Returns:
        ISO 639-1 language code (e.g. "hi", "en", "ta")
    """
    if hint:
        normalized = hint.split("-")[0].lower()
        logger.debug("Using caller-provided language hint: {} -> {}", hint, normalized)
        return normalized

    if not isinstance(audio_data, np.ndarray):
        logger.warning("LID received non-numpy audio; returning fallback '{}'", LANGUAGE_FALLBACK)
        return LANGUAGE_FALLBACK

    lid = _get_lid_pipeline()
    if lid is None:
        logger.debug("LID pipeline unavailable; returning fallback '{}'", LANGUAGE_FALLBACK)
        return LANGUAGE_FALLBACK

    try:
        # HuggingFace audio-classification pipeline accepts
        # {"array": np.ndarray, "sampling_rate": int}
        result = lid({"array": audio_data, "sampling_rate": SAMPLE_RATE}, top_k=1)
        iso3_code = result[0]["label"].lower()  # e.g. "hin"
        iso1_code = _ISO3_TO_ISO1.get(iso3_code, LANGUAGE_FALLBACK)
        score = result[0]["score"]
        logger.debug(
            "MMS LID: {} ({}) -> {} (score={:.3f})",
            iso3_code,
            result[0]["label"],
            iso1_code,
            score,
        )
        return iso1_code

    except Exception as exc:
        logger.warning("MMS LID inference error ({}); returning fallback '{}'", exc, LANGUAGE_FALLBACK)
        return LANGUAGE_FALLBACK
