#!/usr/bin/env python3
"""Audio quality validation for TTS/STT training data.

Performs quality checks on audio files:
- Duration filtering
- Sample rate validation
- Clipping detection
- SNR estimation
- Silence detection

Usage:
    python audio_validator.py --manifest data/manifests/tts_hi_train.jsonl --output data/manifests/tts_hi_train_clean.jsonl
    python audio_validator.py --audio-dir data/raw/audio --report validation_report.json
"""
from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

import numpy as np
import soundfile as sf
from loguru import logger

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning("librosa not available. Some features will be limited.")


@dataclass
class AudioQualityMetrics:
    """Quality metrics for an audio file."""
    filepath: str
    duration: float
    sample_rate: int
    channels: int
    bit_depth: int
    peak_amplitude: float
    rms_amplitude: float
    snr_estimate: float
    silence_ratio: float
    clipping_ratio: float
    is_valid: bool
    rejection_reasons: List[str]


@dataclass
class ValidationConfig:
    """Configuration for audio validation."""
    min_duration: float = 0.5
    max_duration: float = 30.0
    target_sample_rate: int = 16000
    min_sample_rate: int = 8000
    max_channels: int = 2
    max_silence_ratio: float = 0.5
    max_clipping_ratio: float = 0.01
    min_snr: float = 10.0
    min_rms: float = 0.001
    clipping_threshold: float = 0.99


def estimate_snr(audio: np.ndarray, sr: int, frame_length: int = 2048) -> float:
    """Estimate Signal-to-Noise Ratio.

    Uses a simple VAD-based approach to separate speech and noise.

    Args:
        audio: Audio signal
        sr: Sample rate
        frame_length: Frame length for analysis

    Returns:
        Estimated SNR in dB
    """
    if len(audio) < frame_length:
        return 0.0

    # Compute frame energies
    hop_length = frame_length // 4
    num_frames = (len(audio) - frame_length) // hop_length + 1

    energies = []
    for i in range(num_frames):
        start = i * hop_length
        frame = audio[start:start + frame_length]
        energy = np.sum(frame ** 2) / frame_length
        energies.append(energy)

    energies = np.array(energies)

    if len(energies) < 2:
        return 0.0

    # Assume lower 20% of energy frames are noise
    sorted_energies = np.sort(energies)
    noise_threshold = int(len(sorted_energies) * 0.2)

    if noise_threshold < 1:
        noise_threshold = 1

    noise_energy = np.mean(sorted_energies[:noise_threshold])
    signal_energy = np.mean(sorted_energies[noise_threshold:])

    if noise_energy <= 0:
        return 50.0  # Very clean signal

    snr = 10 * np.log10(signal_energy / noise_energy)
    return float(snr)


def detect_silence(audio: np.ndarray, sr: int, threshold: float = 0.01) -> float:
    """Detect ratio of silence in audio.

    Args:
        audio: Audio signal
        sr: Sample rate
        threshold: RMS threshold for silence detection

    Returns:
        Ratio of silent frames (0.0 to 1.0)
    """
    frame_length = int(0.025 * sr)  # 25ms frames
    hop_length = int(0.010 * sr)    # 10ms hop

    if len(audio) < frame_length:
        return 0.0

    num_frames = (len(audio) - frame_length) // hop_length + 1
    silent_frames = 0

    for i in range(num_frames):
        start = i * hop_length
        frame = audio[start:start + frame_length]
        rms = np.sqrt(np.mean(frame ** 2))
        if rms < threshold:
            silent_frames += 1

    return silent_frames / num_frames if num_frames > 0 else 0.0


def detect_clipping(audio: np.ndarray, threshold: float = 0.99) -> float:
    """Detect ratio of clipped samples.

    Args:
        audio: Audio signal (normalized to [-1, 1])
        threshold: Threshold for clipping detection

    Returns:
        Ratio of clipped samples
    """
    clipped = np.sum(np.abs(audio) >= threshold)
    return clipped / len(audio) if len(audio) > 0 else 0.0


def analyze_audio(
    audio_path: Path,
    config: ValidationConfig,
) -> AudioQualityMetrics:
    """Analyze audio file quality.

    Args:
        audio_path: Path to audio file
        config: Validation configuration

    Returns:
        Quality metrics for the audio
    """
    rejection_reasons = []

    try:
        # Load audio info
        info = sf.info(str(audio_path))
        duration = info.duration
        sample_rate = info.samplerate
        channels = info.channels

        # Determine bit depth
        subtype = info.subtype
        if "PCM_16" in subtype:
            bit_depth = 16
        elif "PCM_24" in subtype:
            bit_depth = 24
        elif "PCM_32" in subtype or "FLOAT" in subtype:
            bit_depth = 32
        else:
            bit_depth = 16  # Default

        # Load audio data
        audio, sr = sf.read(str(audio_path), dtype="float32")

        # Convert to mono if needed
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        # Calculate metrics
        peak = float(np.max(np.abs(audio)))
        rms = float(np.sqrt(np.mean(audio ** 2)))
        snr = estimate_snr(audio, sr)
        silence_ratio = detect_silence(audio, sr)
        clipping_ratio = detect_clipping(audio, config.clipping_threshold)

        # Validation checks
        if duration < config.min_duration:
            rejection_reasons.append(f"Duration too short: {duration:.2f}s < {config.min_duration}s")
        if duration > config.max_duration:
            rejection_reasons.append(f"Duration too long: {duration:.2f}s > {config.max_duration}s")
        if sample_rate < config.min_sample_rate:
            rejection_reasons.append(f"Sample rate too low: {sample_rate} < {config.min_sample_rate}")
        if channels > config.max_channels:
            rejection_reasons.append(f"Too many channels: {channels} > {config.max_channels}")
        if silence_ratio > config.max_silence_ratio:
            rejection_reasons.append(f"Too much silence: {silence_ratio:.1%} > {config.max_silence_ratio:.1%}")
        if clipping_ratio > config.max_clipping_ratio:
            rejection_reasons.append(f"Too much clipping: {clipping_ratio:.1%} > {config.max_clipping_ratio:.1%}")
        if snr < config.min_snr:
            rejection_reasons.append(f"SNR too low: {snr:.1f}dB < {config.min_snr}dB")
        if rms < config.min_rms:
            rejection_reasons.append(f"RMS too low: {rms:.4f} < {config.min_rms}")

        return AudioQualityMetrics(
            filepath=str(audio_path),
            duration=duration,
            sample_rate=sample_rate,
            channels=channels,
            bit_depth=bit_depth,
            peak_amplitude=peak,
            rms_amplitude=rms,
            snr_estimate=snr,
            silence_ratio=silence_ratio,
            clipping_ratio=clipping_ratio,
            is_valid=len(rejection_reasons) == 0,
            rejection_reasons=rejection_reasons,
        )

    except Exception as e:
        return AudioQualityMetrics(
            filepath=str(audio_path),
            duration=0.0,
            sample_rate=0,
            channels=0,
            bit_depth=0,
            peak_amplitude=0.0,
            rms_amplitude=0.0,
            snr_estimate=0.0,
            silence_ratio=0.0,
            clipping_ratio=0.0,
            is_valid=False,
            rejection_reasons=[f"Failed to read audio: {e}"],
        )


def validate_manifest(
    manifest_path: Path,
    output_path: Path,
    config: ValidationConfig,
    report_path: Optional[Path] = None,
) -> Tuple[int, int]:
    """Validate audio files from a manifest.

    Args:
        manifest_path: Input manifest path
        output_path: Output filtered manifest path
        config: Validation configuration
        report_path: Optional path for validation report

    Returns:
        Tuple of (valid_count, total_count)
    """
    valid_entries = []
    all_metrics = []

    with open(manifest_path, "r", encoding="utf-8") as f:
        entries = [json.loads(line) for line in f if line.strip()]

    logger.info(f"Validating {len(entries)} entries from {manifest_path}")

    for i, entry in enumerate(entries):
        audio_path = Path(entry["audio_filepath"])

        if not audio_path.exists():
            logger.warning(f"Audio file not found: {audio_path}")
            continue

        metrics = analyze_audio(audio_path, config)
        all_metrics.append(metrics)

        if metrics.is_valid:
            valid_entries.append(entry)

        if (i + 1) % 100 == 0:
            logger.info(f"Processed {i + 1}/{len(entries)} files")

    # Write filtered manifest
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        for entry in valid_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    # Write report if requested
    if report_path:
        report = {
            "total_files": len(entries),
            "valid_files": len(valid_entries),
            "rejection_rate": 1 - len(valid_entries) / len(entries) if entries else 0,
            "rejection_reasons": {},
            "statistics": {
                "avg_duration": np.mean([m.duration for m in all_metrics if m.is_valid]),
                "avg_snr": np.mean([m.snr_estimate for m in all_metrics if m.is_valid]),
                "avg_silence_ratio": np.mean([m.silence_ratio for m in all_metrics if m.is_valid]),
            },
        }

        # Count rejection reasons
        for metrics in all_metrics:
            for reason in metrics.rejection_reasons:
                reason_type = reason.split(":")[0]
                report["rejection_reasons"][reason_type] = report["rejection_reasons"].get(reason_type, 0) + 1

        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        logger.info(f"Report saved to: {report_path}")

    logger.info(f"Validation complete: {len(valid_entries)}/{len(entries)} valid ({len(valid_entries)/len(entries)*100:.1f}%)")
    return len(valid_entries), len(entries)


def validate_directory(
    audio_dir: Path,
    config: ValidationConfig,
    report_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Validate all audio files in a directory.

    Args:
        audio_dir: Directory containing audio files
        config: Validation configuration
        report_path: Optional path for validation report

    Returns:
        Validation statistics
    """
    all_metrics = []
    audio_extensions = {".wav", ".flac", ".mp3", ".ogg", ".m4a"}

    audio_files = []
    for root, _, files in os.walk(audio_dir):
        for file in files:
            if Path(file).suffix.lower() in audio_extensions:
                audio_files.append(Path(root) / file)

    logger.info(f"Validating {len(audio_files)} audio files in {audio_dir}")

    for i, audio_path in enumerate(audio_files):
        metrics = analyze_audio(audio_path, config)
        all_metrics.append(metrics)

        if (i + 1) % 100 == 0:
            logger.info(f"Processed {i + 1}/{len(audio_files)} files")

    valid_count = sum(1 for m in all_metrics if m.is_valid)

    report = {
        "total_files": len(audio_files),
        "valid_files": valid_count,
        "rejection_rate": 1 - valid_count / len(audio_files) if audio_files else 0,
        "rejection_reasons": {},
        "statistics": {
            "avg_duration": float(np.mean([m.duration for m in all_metrics])) if all_metrics else 0,
            "avg_snr": float(np.mean([m.snr_estimate for m in all_metrics if m.snr_estimate > 0])) if all_metrics else 0,
            "total_duration_hours": sum(m.duration for m in all_metrics) / 3600,
        },
        "invalid_files": [
            {"filepath": m.filepath, "reasons": m.rejection_reasons}
            for m in all_metrics if not m.is_valid
        ],
    }

    # Count rejection reasons
    for metrics in all_metrics:
        for reason in metrics.rejection_reasons:
            reason_type = reason.split(":")[0]
            report["rejection_reasons"][reason_type] = report["rejection_reasons"].get(reason_type, 0) + 1

    if report_path:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        logger.info(f"Report saved to: {report_path}")

    logger.info(f"Validation complete: {valid_count}/{len(audio_files)} valid ({valid_count/len(audio_files)*100:.1f}%)")
    return report


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Validate audio quality for TTS/STT training",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Validate manifest and create filtered version
    python audio_validator.py --manifest data/manifests/tts_hi_train.jsonl \\
                              --output data/manifests/tts_hi_train_clean.jsonl

    # Validate directory and generate report
    python audio_validator.py --audio-dir data/raw/audio --report validation_report.json

    # Custom validation parameters
    python audio_validator.py --manifest data/train.jsonl --output data/train_clean.jsonl \\
                              --min-duration 1.0 --max-duration 20.0 --min-snr 15.0
        """,
    )
    parser.add_argument("--manifest", type=str, help="Input manifest file to validate")
    parser.add_argument("--output", type=str, help="Output filtered manifest file")
    parser.add_argument("--audio-dir", type=str, help="Directory of audio files to validate")
    parser.add_argument("--report", type=str, help="Path for validation report JSON")

    # Validation parameters
    parser.add_argument("--min-duration", type=float, default=0.5, help="Minimum duration (seconds)")
    parser.add_argument("--max-duration", type=float, default=30.0, help="Maximum duration (seconds)")
    parser.add_argument("--min-snr", type=float, default=10.0, help="Minimum SNR (dB)")
    parser.add_argument("--max-silence", type=float, default=0.5, help="Maximum silence ratio")
    parser.add_argument("--max-clipping", type=float, default=0.01, help="Maximum clipping ratio")

    args = parser.parse_args()

    config = ValidationConfig(
        min_duration=args.min_duration,
        max_duration=args.max_duration,
        min_snr=args.min_snr,
        max_silence_ratio=args.max_silence,
        max_clipping_ratio=args.max_clipping,
    )

    if args.manifest:
        if not args.output:
            parser.error("--output required when using --manifest")
        validate_manifest(
            Path(args.manifest),
            Path(args.output),
            config,
            Path(args.report) if args.report else None,
        )
    elif args.audio_dir:
        validate_directory(
            Path(args.audio_dir),
            config,
            Path(args.report) if args.report else None,
        )
    else:
        parser.error("Either --manifest or --audio-dir is required")


if __name__ == "__main__":
    main()
