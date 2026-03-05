"""Whisper fallback removed — project uses AI4Bharat IndicConformer exclusively.

This file is kept as a tombstone to avoid import errors from any stale
references. All ASR is handled by asr_indic_conformer.py.
"""
raise ImportError(
    "asr_whisper_fallback is no longer available. "
    "Use asr_indic_conformer instead."
)
