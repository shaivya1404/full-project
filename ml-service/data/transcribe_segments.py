#!/usr/bin/env python3
"""Transcribe audio segments using Whisper.

Adds text transcriptions to extracted audio segments.

Usage:
    python transcribe_segments.py --manifest data/stt/extracted/en_test/manifest.jsonl
    python transcribe_segments.py --manifest data/stt/extracted/hi_test/manifest.jsonl --lang hi
"""
import argparse
import json
import sys
from pathlib import Path

from loguru import logger

# Configure logging
logger.remove()
logger.add(sys.stderr, level="INFO", format="{time:HH:mm:ss} | {level} | {message}")


def load_whisper_model(model_size: str = "base"):
    """Load Whisper model."""
    try:
        import whisper
        logger.info(f"Loading Whisper {model_size} model...")
        model = whisper.load_model(model_size)
        return model, "openai"
    except ImportError:
        pass

    try:
        from faster_whisper import WhisperModel
        logger.info(f"Loading Faster-Whisper {model_size} model...")
        model = WhisperModel(model_size, compute_type="int8")
        return model, "faster"
    except ImportError:
        pass

    raise RuntimeError("Install whisper: pip install openai-whisper OR pip install faster-whisper")


def transcribe_openai(model, audio_path: Path, language: str) -> str:
    """Transcribe using OpenAI Whisper."""
    result = model.transcribe(
        str(audio_path),
        language=language if language != "hi-en" else None,
        task="transcribe",
    )
    return result["text"].strip()


def transcribe_faster(model, audio_path: Path, language: str) -> str:
    """Transcribe using Faster-Whisper."""
    segments, _ = model.transcribe(
        str(audio_path),
        language=language if language != "hi-en" else None,
        task="transcribe",
    )
    text = " ".join(seg.text for seg in segments)
    return text.strip()


def transcribe_manifest(manifest_path: Path, language: str, model_size: str):
    """Transcribe all audio in a manifest."""

    manifest_dir = manifest_path.parent

    # Load manifest
    with open(manifest_path, "r", encoding="utf-8") as f:
        samples = [json.loads(line) for line in f if line.strip()]

    logger.info(f"Found {len(samples)} samples to transcribe")

    # Load model
    model, model_type = load_whisper_model(model_size)

    transcribe_fn = transcribe_openai if model_type == "openai" else transcribe_faster

    # Transcribe each sample
    transcribed = []
    for idx, sample in enumerate(samples):
        audio_path = manifest_dir / sample["audio_filepath"]

        if not audio_path.exists():
            logger.warning(f"Audio not found: {audio_path}")
            continue

        try:
            # Use sample language or override
            lang = sample.get("language", language)
            if lang == "hi-en":
                lang = None  # Auto-detect for code-switching

            text = transcribe_fn(model, audio_path, lang)
            sample["text"] = text
            transcribed.append(sample)

            if (idx + 1) % 10 == 0:
                logger.info(f"Transcribed {idx + 1}/{len(samples)}")

        except Exception as e:
            logger.error(f"Failed to transcribe {audio_path}: {e}")
            continue

    # Save updated manifest
    output_path = manifest_path.parent / "manifest_transcribed.jsonl"
    with open(output_path, "w", encoding="utf-8") as f:
        for sample in transcribed:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    logger.info(f"Saved transcribed manifest: {output_path}")

    # Show samples
    print(f"\n{'='*60}")
    print("SAMPLE TRANSCRIPTIONS")
    print('='*60)
    for sample in transcribed[:5]:
        print(f"\nAudio: {sample['audio_filepath']}")
        print(f"Text: {sample['text'][:100]}...")
    print(f"\n{'='*60}")

    return transcribed


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio segments")
    parser.add_argument("--manifest", required=True, help="Path to manifest.jsonl")
    parser.add_argument("--lang", default="en", help="Language (en/hi/hi-en)")
    parser.add_argument("--model", default="base", help="Whisper model size (tiny/base/small/medium)")

    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        logger.error(f"Manifest not found: {manifest_path}")
        return

    transcribe_manifest(manifest_path, args.lang, args.model)


if __name__ == "__main__":
    main()
