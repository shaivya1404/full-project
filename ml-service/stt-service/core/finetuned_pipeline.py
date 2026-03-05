"""IndicConformer fine-tuned model inference pipeline.

Loads a custom .nemo checkpoint produced by fine-tuning IndicConformer
on your own call-center data.

Usage:
    Set env var FINETUNED_MODEL_PATH to the .nemo file, e.g.:
        FINETUNED_MODEL_PATH=/models/stt/indicconformer-finetuned-hi.nemo

    The checkpoint is loaded alongside the base IndicConformer pipeline.
    Call the /ml/stt/transcribe/finetuned endpoint to use it.

Fine-tuning:
    Use NeMo's speech_to_text_rnnt_bpe.py script:
        python speech_to_text_rnnt_bpe.py \
            model.train_ds.manifest_filepath=train.json \
            model.validation_ds.manifest_filepath=val.json \
            +init_from_pretrained_model=ai4bharat/indicconformer_stt_hi_hybrid_rnnt_large \
            trainer.max_epochs=10 \
            exp_manager.exp_dir=/models/stt/finetuned
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import soundfile as sf
from loguru import logger


class IndicConformerFineTunedPipeline:
    """Loads and runs a fine-tuned IndicConformer .nemo checkpoint."""

    def __init__(self, model_path: str, device: str = "cpu") -> None:
        self.model_path = model_path
        self.device = device
        self._model: Any = None
        self._load()

    def _load(self) -> None:
        path = Path(self.model_path)
        if not path.exists():
            logger.error(
                "Fine-tuned model not found at {}. "
                "Set FINETUNED_MODEL_PATH to a valid .nemo checkpoint.",
                self.model_path,
            )
            return

        try:
            import nemo.collections.asr as nemo_asr  # type: ignore
            import torch  # type: ignore

            logger.info("Loading fine-tuned IndicConformer from {} ...", self.model_path)
            self._model = nemo_asr.models.EncDecRNNTBPEModel.restore_from(
                restore_path=self.model_path,
                map_location=self.device,
            )
            self._model.eval()
            logger.info("Fine-tuned IndicConformer ready on {}", self.device)

        except Exception as exc:
            logger.error("Failed to load fine-tuned model: {}", exc)
            self._model = None

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    def transcribe(
        self,
        audio_bytes: bytes,
        language_hint: Optional[str] = None,
    ) -> Tuple[str, float, List[Dict[str, Any]]]:
        """Transcribe audio bytes using the fine-tuned model.

        Args:
            audio_bytes:   Raw audio (WAV, FLAC, etc.) at any sample rate
            language_hint: ISO 639-1 code hint (informational only)

        Returns:
            (text, confidence, timestamps)
        """
        if not self.is_ready:
            return "", 0.0, []

        try:
            import io
            import soundfile as sf_inner  # type: ignore
            import librosa  # type: ignore

            # Decode audio to float32 16 kHz mono
            try:
                audio_array, sr = sf_inner.read(io.BytesIO(audio_bytes), dtype="float32")
            except Exception:
                audio_array = (
                    np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                )
                sr = 16000

            if audio_array.ndim > 1:
                audio_array = audio_array.mean(axis=1)
            if sr != 16000:
                audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=16000)

            # Write to temp file for NeMo
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
                sf.write(tmp_path, audio_array, samplerate=16000, subtype="PCM_16")

            try:
                hypotheses = self._model.transcribe(
                    paths2audio_files=[tmp_path],
                    return_hypotheses=True,
                    batch_size=1,
                )
            finally:
                os.unlink(tmp_path)

            if not hypotheses:
                return "", 0.0, []

            hyp = hypotheses[0]
            text = hyp.text.strip() if hasattr(hyp, "text") else str(hyp).strip()
            token_count = max(len(text.split()), 1)
            raw_score = hyp.score if hasattr(hyp, "score") else -5.0 * token_count
            confidence = float(min(1.0, max(0.0, 1.0 + raw_score / (token_count * 5.0))))

            return text, confidence, []

        except Exception as exc:
            logger.error("Fine-tuned IndicConformer transcription error: {}", exc)
            return "", 0.0, []
