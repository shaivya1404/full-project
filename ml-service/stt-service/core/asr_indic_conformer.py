"""AI4Bharat IndicConformer ASR implementation.

Primary model: indic-conformer-600m-multilingual
  - 600M parameter Conformer Hybrid CTC+RNNT
  - Covers all 22 official Indian languages
  - Loaded via transformers AutoModel (ONNX runtime under the hood)
  - API: model(wav_tensor, language_id, decoder_type)

Fallback: per-language .nemo checkpoints via AI4Bharat NeMo fork
  - Used if multilingual model is not available
  - Currently downloaded: hi.nemo

Supported languages:
  hi, bn, gu, ta, te, kn, ml, mr, pa, or, ur, as,
  brx, doi, kok, ks, mai, mni, ne, sa, sat, sd

Decoder: "ctc" (fast) or "rnnt" (more accurate). Default: ctc.
"""
from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
import soundfile as sf
from loguru import logger

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MULTILINGUAL_MODEL_ID = "ai4bharat/indic-conformer-600m-multilingual"

LANG_TO_NEMO_MODEL: Dict[str, str] = {
    "hi": "ai4bharat/indicconformer_stt_hi_hybrid_ctc_rnnt_large",
    "ta": "ai4bharat/indicconformer_stt_ta_hybrid_ctc_rnnt_large",
    "te": "ai4bharat/indicconformer_stt_te_hybrid_ctc_rnnt_large",
    "bn": "ai4bharat/indicconformer_stt_bn_hybrid_ctc_rnnt_large",
    "mr": "ai4bharat/indicconformer_stt_mr_hybrid_ctc_rnnt_large",
    "gu": "ai4bharat/indicconformer_stt_gu_hybrid_ctc_rnnt_large",
    "kn": "ai4bharat/indicconformer_stt_kn_hybrid_ctc_rnnt_large",
    "ml": "ai4bharat/indicconformer_stt_ml_hybrid_ctc_rnnt_large",
    "pa": "ai4bharat/indicconformer_stt_pa_hybrid_ctc_rnnt_large",
    "or": "ai4bharat/indicconformer_stt_or_hybrid_ctc_rnnt_large",
    "ur": "ai4bharat/indicconformer_stt_ur_hybrid_ctc_rnnt_large",
    "as": "ai4bharat/indicconformer_stt_as_hybrid_ctc_rnnt_large",
}

DEFAULT_LANGUAGE = os.getenv("INDIC_DEFAULT_LANGUAGE", "hi")
DECODER_TYPE = os.getenv("INDIC_DECODER", "ctc")
LOCAL_NEMO_DIR = os.getenv("INDIC_MODEL_DIR", "/models/stt/indicconformer")

# ---------------------------------------------------------------------------
# Model caches
# ---------------------------------------------------------------------------
_multi_model: Any = None          # multilingual ONNX model
_nemo_cache: Dict[str, Any] = {}  # per-language NeMo models


# ---------------------------------------------------------------------------
# Multilingual model (primary path)
# ---------------------------------------------------------------------------

def _get_multilingual_model() -> Any:
    global _multi_model
    if _multi_model is not None:
        return _multi_model

    try:
        from transformers import AutoModel  # type: ignore

        logger.info("Loading multilingual IndicConformer 600M ...")
        _multi_model = AutoModel.from_pretrained(
            MULTILINGUAL_MODEL_ID,
            trust_remote_code=True,
        )
        logger.info("Multilingual IndicConformer loaded (ONNX)")
    except Exception as exc:
        logger.error("Failed to load multilingual model: {}", exc)
        raise RuntimeError(f"Multilingual IndicConformer failed to load: {exc}") from exc

    return _multi_model


def _transcribe_multilingual(
    audio_data: np.ndarray,
    language: str,
) -> Tuple[str, float, List[Dict[str, Any]], str]:
    """Transcribe using the 600M multilingual ONNX model."""
    model = _get_multilingual_model()

    # Model expects a [1, samples] float32 torch tensor at 16 kHz
    wav = torch.from_numpy(audio_data).float().unsqueeze(0)  # [1, T]

    result = model(wav, language, DECODER_TYPE)

    # result is a string transcription
    text = str(result).strip() if result is not None else ""

    # Heuristic confidence
    duration = len(audio_data) / 16000
    words = max(len(text.split()), 1)
    confidence = float(min(0.95, words / max(1, duration * 2.5)))

    logger.info(
        "Multilingual IndicConformer: {} chars, lang={}, decoder={}",
        len(text), language, DECODER_TYPE,
    )
    return text, confidence, [], MULTILINGUAL_MODEL_ID


# ---------------------------------------------------------------------------
# Per-language NeMo fallback
# ---------------------------------------------------------------------------

def _local_nemo_path(lang: str) -> str | None:
    p = os.path.join(LOCAL_NEMO_DIR, f"{lang}.nemo")
    return p if os.path.exists(p) else None


def _get_nemo_model(language: str) -> Tuple[Any, str]:
    """Load per-language NeMo model. Falls back to hi if lang not available."""
    import nemo.collections.asr as nemo_asr  # type: ignore

    lang = language if _local_nemo_path(language) or language in LANG_TO_NEMO_MODEL else DEFAULT_LANGUAGE

    if lang not in _nemo_cache:
        local = _local_nemo_path(lang)
        if local:
            logger.info("Loading NeMo fallback from {}", local)
            model = nemo_asr.models.ASRModel.restore_from(local)
        else:
            model_id = LANG_TO_NEMO_MODEL[lang]
            logger.info("Downloading NeMo fallback: {}", model_id)
            model = nemo_asr.models.ASRModel.from_pretrained(model_id)

        model.freeze()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(torch.device(device))
        _nemo_cache[lang] = model
        logger.info("NeMo fallback '{}' loaded on {}", lang, device)

    return _nemo_cache[lang], lang


def _transcribe_nemo(
    audio_data: np.ndarray,
    language: str,
) -> Tuple[str, float, List[Dict[str, Any]], str]:
    """Transcribe using per-language NeMo model."""
    model, resolved_lang = _get_nemo_model(language)
    model_label = LANG_TO_NEMO_MODEL.get(resolved_lang, resolved_lang)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name
        sf.write(tmp_path, audio_data, samplerate=16000, subtype="PCM_16")

    try:
        model.cur_decoder = DECODER_TYPE
        results = model.transcribe([tmp_path], batch_size=1, language_id=resolved_lang)
    finally:
        os.unlink(tmp_path)

    raw = results[0] if results else ""
    text = raw.text.strip() if hasattr(raw, "text") else str(raw).strip()

    duration = len(audio_data) / 16000
    words = max(len(text.split()), 1)
    confidence = float(min(0.95, words / max(1, duration * 2.5)))

    logger.info("NeMo fallback: {} chars, lang={}", len(text), resolved_lang)
    return text, confidence, [], model_label


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def transcribe(
    audio_data: np.ndarray,
    language: str | None,
) -> Tuple[str, float, List[Dict[str, Any]], str]:
    """Transcribe audio using IndicConformer.

    Tries multilingual 600M model first; falls back to per-language NeMo.

    Args:
        audio_data: float32 numpy array, 16 kHz mono
        language:   ISO 639-1 code ("hi", "ta", "en", …). None → DEFAULT_LANGUAGE.

    Returns:
        (text, confidence, timestamps, model_used)
    """
    lang = language or DEFAULT_LANGUAGE

    # Try multilingual model first
    try:
        return _transcribe_multilingual(audio_data, lang)
    except Exception as multi_exc:
        logger.warning(
            "Multilingual model failed ({}), falling back to NeMo per-language model",
            multi_exc,
        )

    # NeMo per-language fallback
    return _transcribe_nemo(audio_data, lang)


def get_loaded_models() -> Dict[str, Any]:
    return {
        "multilingual_loaded": _multi_model is not None,
        "nemo_loaded_languages": list(_nemo_cache.keys()),
    }


def get_model_info() -> Dict[str, Any]:
    return {
        "name": "IndicConformer",
        "provider": "AI4Bharat",
        "architecture": "Conformer Hybrid CTC-RNNT",
        "primary_model": MULTILINGUAL_MODEL_ID,
        "primary_format": "ONNX via transformers AutoModel",
        "fallback_models": LANG_TO_NEMO_MODEL,
        "fallback_format": "NeMo .nemo checkpoint",
        "supported_languages": list(set(list(LANG_TO_NEMO_MODEL.keys()) + [
            "brx", "doi", "kok", "ks", "mai", "mni", "ne", "sa", "sat", "sd"
        ])),
        "default_language": DEFAULT_LANGUAGE,
        "decoder": DECODER_TYPE,
        "loaded": get_loaded_models(),
    }
