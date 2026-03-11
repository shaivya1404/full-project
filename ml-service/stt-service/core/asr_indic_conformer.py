"""AI4Bharat IndicConformer ASR implementation.

Primary model: ai4bharat/indic-conformer-600m-multilingual
  - 600M parameter Conformer Hybrid CTC+RNNT
  - Covers all 22 official Indian languages
  - Loaded via transformers AutoModel (trust_remote_code=True)
  - API: model(wav_tensor, language_id, decoder_type)

Supported languages:
  hi, bn, gu, ta, te, kn, ml, mr, pa, or, ur, as,
  brx, doi, kok, ks, mai, mni, ne, sa, sat, sd, en

Decoder: "ctc" (fast) or "rnnt" (more accurate). Default: ctc.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
from loguru import logger

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MULTILINGUAL_MODEL_ID = "ai4bharat/indic-conformer-600m-multilingual"

DEFAULT_LANGUAGE = os.getenv("INDIC_DEFAULT_LANGUAGE", "hi")
DECODER_TYPE = os.getenv("INDIC_DECODER", "ctc")

# ---------------------------------------------------------------------------
# Model cache
# ---------------------------------------------------------------------------
_multi_model: Any = None


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def _get_model() -> Any:
    global _multi_model
    if _multi_model is not None:
        return _multi_model

    from transformers import AutoModel  # type: ignore

    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN") or None
    logger.info("Loading IndicConformer 600M multilingual from HuggingFace ...")
    _multi_model = AutoModel.from_pretrained(
        MULTILINGUAL_MODEL_ID,
        trust_remote_code=True,
        token=hf_token,
    )
    device = "cuda" if torch.cuda.is_available() else "cpu"
    _multi_model = _multi_model.to(device)
    _multi_model.eval()
    logger.info("IndicConformer 600M ready on {}", device)
    return _multi_model


# ---------------------------------------------------------------------------
# Public transcribe API
# ---------------------------------------------------------------------------

def transcribe(
    audio_data: np.ndarray,
    language: str | None,
) -> Tuple[str, float, List[Dict[str, Any]], str]:
    """Transcribe audio using the IndicConformer 600M multilingual model.

    Args:
        audio_data: float32 numpy array, 16 kHz mono
        language:   ISO 639-1 code ("hi", "ta", "en", …). None → DEFAULT_LANGUAGE.

    Returns:
        (text, confidence, timestamps, model_used)
    """
    lang = language or DEFAULT_LANGUAGE

    model = _get_model()

    # Model expects a [1, samples] float32 torch tensor at 16 kHz
    try:
        device = next(model.parameters()).device
    except StopIteration:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    wav = torch.from_numpy(audio_data).float().unsqueeze(0).to(device)  # [1, T]

    with torch.no_grad():
        result = model(wav, lang, DECODER_TYPE)

    text = str(result).strip() if result is not None else ""

    # Heuristic confidence (no log-prob available from this API)
    duration = len(audio_data) / 16000
    words = max(len(text.split()), 1)
    confidence = float(min(0.95, words / max(1, duration * 2.5)))

    logger.info(
        "IndicConformer: {} chars, lang={}, decoder={}",
        len(text), lang, DECODER_TYPE,
    )
    return text, confidence, [], MULTILINGUAL_MODEL_ID


def get_loaded_models() -> Dict[str, Any]:
    return {
        "multilingual_loaded": _multi_model is not None,
    }


def get_model_info() -> Dict[str, Any]:
    return {
        "name": "IndicConformer",
        "provider": "AI4Bharat",
        "architecture": "Conformer Hybrid CTC-RNNT",
        "model_id": MULTILINGUAL_MODEL_ID,
        "format": "HuggingFace transformers (trust_remote_code)",
        "supported_languages": [
            "hi", "bn", "gu", "ta", "te", "kn", "ml", "mr", "pa",
            "or", "ur", "as", "brx", "doi", "kok", "ks", "mai",
            "mni", "ne", "sa", "sat", "sd", "en",
        ],
        "default_language": DEFAULT_LANGUAGE,
        "decoder": DECODER_TYPE,
        "loaded": get_loaded_models(),
    }
