"""Whisper Small + LoRA inference pipeline.

This is YOUR fine-tuned model (trained on Kaggle, Feb 2026).
Loss: 1.59 -> 0.97 (39% improvement over base Whisper Small).
Optimised for Indian accent English + Hindi.

Model path: set via env var LORA_MODEL_PATH (default: /models/stt/whisper-stt-finetuned)
The directory must contain:
  - adapter_config.json   (LoRA adapter config)
  - adapter_model.bin     (LoRA weights)
  - vocab.json, tokenizer files (WhisperProcessor)
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from loguru import logger


class LoRAPipeline:
    """Loads and runs Whisper Small + LoRA for transcription."""

    def __init__(self, model_path: str, device: str = "cpu") -> None:
        self.model_path = model_path
        self.device = device
        self._model = None
        self._processor = None
        self._load()

    def _load(self) -> None:
        path = Path(self.model_path)
        if not path.exists():
            logger.error(
                "LoRA model not found at {}. "
                "Upload whisper-stt-finetuned/ to this path.",
                self.model_path,
            )
            return

        try:
            import torch
            from peft import PeftModel  # type: ignore
            from transformers import WhisperForConditionalGeneration, WhisperProcessor  # type: ignore

            logger.info("Loading Whisper Small base ...")
            base = WhisperForConditionalGeneration.from_pretrained("openai/whisper-small")

            logger.info("Attaching LoRA weights from {} ...", self.model_path)
            self._model = PeftModel.from_pretrained(base, self.model_path)
            self._model.eval()
            self._model.to(device=self.device)

            self._processor = WhisperProcessor.from_pretrained(self.model_path)
            logger.info("Whisper Small + LoRA ready on {}", self.device)

        except Exception as exc:
            logger.error("Failed to load LoRA model: {}", exc)
            self._model = None
            self._processor = None

    @property
    def is_ready(self) -> bool:
        return self._model is not None and self._processor is not None

    def transcribe(
        self,
        audio_bytes: bytes,
        language_hint: Optional[str] = None,
    ) -> Tuple[str, float, List[Dict[str, Any]]]:
        """Transcribe audio bytes using the fine-tuned model.

        Args:
            audio_bytes: Raw audio (WAV or raw PCM int16 @ 16kHz).
            language_hint: 'en', 'hi', or None for auto-detect.

        Returns:
            (text, confidence, timestamps)
        """
        if not self.is_ready:
            return "", 0.0, []

        try:
            import torch
            import soundfile as sf  # type: ignore

            # Parse audio
            try:
                audio_array, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
            except Exception:
                audio_array = (
                    np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                )
                sr = 16000

            # Ensure mono float32 @ 16kHz
            if audio_array.ndim > 1:
                audio_array = audio_array.mean(axis=1)
            if sr != 16000:
                import librosa  # type: ignore
                audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=16000)

            # Build input features
            inputs = self._processor(
                audio_array,
                sampling_rate=16000,
                return_tensors="pt",
            )
            input_features = inputs.input_features.to(self.device)

            # Build forced decoder ids for language forcing
            forced_decoder_ids = None
            if language_hint:
                forced_decoder_ids = self._processor.get_decoder_prompt_ids(
                    language=language_hint, task="transcribe"
                )

            with torch.no_grad():
                generated_ids = self._model.generate(
                    input_features,
                    forced_decoder_ids=forced_decoder_ids,
                    max_length=225,
                )

            text = self._processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()

            # Confidence: Whisper Small doesn't output logprobs easily;
            # use a heuristic based on text length vs audio length
            audio_duration = len(audio_array) / 16000
            words = len(text.split())
            confidence = min(0.95, words / max(1, audio_duration * 2.5))

            return text, confidence, []

        except Exception as exc:
            logger.error("LoRA transcription error: {}", exc)
            return "", 0.0, []
