"""Silero VAD v5 wrapper.

Uses the `silero-vad` pip package (v5), NOT torch.hub (that was v4).
Buffers 16kHz PCM int16 mono frames from the WebSocket.
Fires on_speech_start / on_speech_end callbacks.
on_speech_end delivers the full utterance as raw PCM bytes.
"""
from __future__ import annotations

import time
from typing import Callable, Optional

import numpy as np
import torch
from loguru import logger


class VADProcessor:
    """Stateful per-call VAD using Silero VAD v5."""

    SAMPLE_RATE = 16000
    # Silero VAD v5 requires exactly 512 samples per chunk @ 16kHz
    CHUNK_SAMPLES = 512
    CHUNK_BYTES = CHUNK_SAMPLES * 2  # int16 = 2 bytes per sample

    def __init__(
        self,
        silence_ms: int = 600,
        on_speech_start: Optional[Callable[[], None]] = None,
        on_speech_end: Optional[Callable[[bytes], None]] = None,
    ) -> None:
        self.silence_ms = silence_ms
        self.on_speech_start = on_speech_start
        self.on_speech_end = on_speech_end

        # v5 package loading — silero-vad pip package must be installed
        from silero_vad import load_silero_vad  # type: ignore
        self._model = load_silero_vad()
        self._model.eval()
        logger.info("Silero VAD v5 loaded")

        self._speech_buffer: list[np.ndarray] = []
        self._raw_chunk: bytes = b""
        self._in_speech: bool = False
        self._last_speech_time: float = 0.0

    # ── Public ────────────────────────────────────────────────────────────────

    def feed(self, pcm_bytes: bytes) -> None:
        """Feed raw PCM int16 bytes (any length) from the WebSocket."""
        self._raw_chunk += pcm_bytes
        while len(self._raw_chunk) >= self.CHUNK_BYTES:
            chunk = self._raw_chunk[: self.CHUNK_BYTES]
            self._raw_chunk = self._raw_chunk[self.CHUNK_BYTES :]
            self._process_chunk(chunk)

    def reset(self) -> None:
        """Call at end of call to release per-call state."""
        self._speech_buffer.clear()
        self._raw_chunk = b""
        self._in_speech = False
        self._model.reset_states()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _process_chunk(self, chunk: bytes) -> None:
        # Convert int16 bytes -> float32 [-1, 1]
        samples = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
        tensor = torch.from_numpy(samples)

        with torch.no_grad():
            speech_prob: float = self._model(tensor, self.SAMPLE_RATE).item()

        is_speech = speech_prob > 0.5

        if is_speech:
            if not self._in_speech:
                self._in_speech = True
                logger.debug("VAD: speech start")
                if self.on_speech_start:
                    self.on_speech_start()
            self._speech_buffer.append(samples)
            self._last_speech_time = time.monotonic()
        else:
            if self._in_speech:
                silence_so_far_ms = (time.monotonic() - self._last_speech_time) * 1000
                if silence_so_far_ms >= self.silence_ms:
                    logger.debug("VAD: speech end ({:.0f}ms silence)", silence_so_far_ms)
                    self._fire_speech_end()
                else:
                    # Short pause mid-sentence — keep buffering
                    self._speech_buffer.append(samples)

    def _fire_speech_end(self) -> None:
        if not self._speech_buffer:
            return
        audio = np.concatenate(self._speech_buffer)
        audio_int16 = (audio * 32768).clip(-32768, 32767).astype(np.int16)
        audio_bytes = audio_int16.tobytes()

        self._speech_buffer.clear()
        self._in_speech = False

        if self.on_speech_end:
            self.on_speech_end(audio_bytes)
