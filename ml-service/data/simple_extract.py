#!/usr/bin/env python3
"""Simple Speech Extraction for STT Training.

Simpler, more reliable version that:
1. Downloads YouTube audio
2. Splits into segments using VAD
3. Saves segments with manifest

Usage:
    python simple_extract.py --url "YOUTUBE_URL" --output data/stt --lang hi
    python simple_extract.py --file audio.wav --output data/stt --lang en
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from loguru import logger

# Configure logging
logger.remove()
logger.add(sys.stderr, level="INFO", format="{time:HH:mm:ss} | {level} | {message}")


def download_youtube(url: str, output_dir: Path) -> Path:
    """Download YouTube audio."""
    import shutil

    output_dir.mkdir(parents=True, exist_ok=True)

    # Get video ID
    import re
    match = re.search(r'(?:v=|/)([a-zA-Z0-9_-]{11})', url)
    video_id = match.group(1) if match else "video"

    output_file = output_dir / f"{video_id}.wav"

    if output_file.exists():
        logger.info(f"Already downloaded: {output_file}")
        return output_file

    logger.info(f"Downloading: {url}")

    # Find yt-dlp executable
    ytdlp = shutil.which("yt-dlp")
    if not ytdlp:
        # Try common Windows paths
        import os
        possible_paths = [
            os.path.expanduser("~") + r"\AppData\Roaming\Python\Python313\Scripts\yt-dlp.exe",
            os.path.expanduser("~") + r"\AppData\Local\Programs\Python\Python313\Scripts\yt-dlp.exe",
            r"C:\Python313\Scripts\yt-dlp.exe",
        ]
        for p in possible_paths:
            if os.path.exists(p):
                ytdlp = p
                break
        if not ytdlp:
            ytdlp = "yt-dlp"  # Fallback

    cmd = [
        ytdlp,
        "-x",
        "--audio-format", "wav",
        "-o", str(output_dir / "%(id)s.%(ext)s"),
        "--no-playlist",
        url,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error(f"Download failed: {result.stderr}")
        raise RuntimeError("Download failed")

    # Find the wav file
    wav_files = list(output_dir.glob("*.wav"))
    if wav_files:
        return wav_files[0]

    raise RuntimeError("No audio file found")


def detect_speech_vad(audio: np.ndarray, sr: int) -> list:
    """Detect speech using Silero VAD."""
    import torch

    logger.info("Loading VAD model...")
    model, utils = torch.hub.load(
        repo_or_dir='snakers4/silero-vad',
        model='silero_vad',
        force_reload=False,
        trust_repo=True,
    )

    get_speech_timestamps = utils[0]

    # Resample to 16kHz if needed
    if sr != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        sr = 16000

    # Convert to tensor
    audio_tensor = torch.from_numpy(audio).float()

    logger.info("Detecting speech...")
    timestamps = get_speech_timestamps(
        audio_tensor,
        model,
        sampling_rate=sr,
        min_speech_duration_ms=2000,  # Min 2 seconds
        max_speech_duration_s=20,      # Max 20 seconds
        min_silence_duration_ms=500,
        speech_pad_ms=100,
    )

    # Convert to seconds
    segments = []
    for ts in timestamps:
        start = ts['start'] / sr
        end = ts['end'] / sr
        segments.append((start, end))

    logger.info(f"Found {len(segments)} speech segments")
    return segments


def extract_segments(
    audio_path: Path,
    output_dir: Path,
    language: str,
    min_duration: float = 2.0,
    max_duration: float = 20.0,
) -> list:
    """Extract speech segments from audio file."""

    output_dir.mkdir(parents=True, exist_ok=True)
    audio_dir = output_dir / "audio"
    audio_dir.mkdir(exist_ok=True)

    # Load audio
    logger.info(f"Loading audio: {audio_path}")
    audio, sr = sf.read(audio_path, dtype='float32')

    # Convert to mono
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    logger.info(f"Audio duration: {len(audio)/sr:.1f} seconds")

    # Detect speech
    segments = detect_speech_vad(audio, sr)

    # Resample for saving (16kHz is standard for STT)
    if sr != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        sr = 16000

    # Extract and save segments
    samples = []
    source_name = audio_path.stem

    logger.info("Extracting segments...")
    for idx, (start, end) in enumerate(segments):
        duration = end - start

        # Filter by duration
        if duration < min_duration or duration > max_duration:
            continue

        # Extract audio
        start_sample = int(start * sr)
        end_sample = int(end * sr)
        segment_audio = audio[start_sample:end_sample]

        # Save
        filename = f"{source_name}_{idx:04d}.wav"
        filepath = audio_dir / filename
        sf.write(filepath, segment_audio, sr)

        samples.append({
            "audio_filepath": f"audio/{filename}",
            "text": "",  # No transcript yet
            "language": language,
            "duration": duration,
            "source": source_name,
        })

        if (idx + 1) % 20 == 0:
            logger.info(f"Saved {idx + 1} segments...")

    logger.info(f"Extracted {len(samples)} segments")

    # Save manifest
    manifest_path = output_dir / "manifest.jsonl"
    with open(manifest_path, "w", encoding="utf-8") as f:
        for sample in samples:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    logger.info(f"Manifest saved: {manifest_path}")

    return samples


def main():
    parser = argparse.ArgumentParser(description="Extract speech for STT training")

    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--url", help="YouTube URL")
    input_group.add_argument("--file", help="Local audio/video file")

    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--lang", default="hi", help="Language code (hi/en)")

    args = parser.parse_args()

    output_dir = Path(args.output)

    # Get audio file
    if args.url:
        audio_path = download_youtube(args.url, output_dir / "raw")
    else:
        audio_path = Path(args.file)
        if not audio_path.exists():
            logger.error(f"File not found: {audio_path}")
            return

    # Extract segments
    samples = extract_segments(audio_path, output_dir, args.lang)

    # Summary
    total_duration = sum(s["duration"] for s in samples)
    print(f"\n{'='*50}")
    print(f"EXTRACTION COMPLETE")
    print(f"{'='*50}")
    print(f"Segments: {len(samples)}")
    print(f"Total duration: {total_duration/60:.1f} minutes")
    print(f"Output: {output_dir}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
