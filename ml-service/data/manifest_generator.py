#!/usr/bin/env python3
"""Generate JSONL training manifests from downloaded datasets.

Creates standardized manifest files for TTS and STT training with format:
{
    "audio_filepath": "/path/to/audio.wav",
    "text": "transcription text",
    "duration": 5.2,
    "language": "hi-IN",
    "speaker_id": "speaker_001"  # For TTS
}

Usage:
    python manifest_generator.py --input data/raw/indicTTS --output data/manifests --type tts
    python manifest_generator.py --input data/raw/shrutilipi --output data/manifests --type stt
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

import soundfile as sf
from loguru import logger

try:
    from datasets import load_from_disk
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False


# Supported audio formats
AUDIO_EXTENSIONS = {".wav", ".flac", ".mp3", ".ogg", ".m4a"}

# Language code to BCP-47 mapping
LANG_TO_BCP47 = {
    "hi": "hi-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "or": "or-IN",
    "pa": "pa-IN",
    "as": "as-IN",
    "ur": "ur-IN",
    "ne": "ne-NP",
    "en": "en-IN",
}


def get_audio_duration(audio_path: Path) -> float:
    """Get duration of an audio file in seconds.

    Args:
        audio_path: Path to audio file

    Returns:
        Duration in seconds
    """
    try:
        info = sf.info(str(audio_path))
        return info.duration
    except Exception as e:
        logger.warning(f"Failed to get duration for {audio_path}: {e}")
        return 0.0


def find_audio_files(directory: Path) -> Generator[Path, None, None]:
    """Recursively find all audio files in a directory.

    Args:
        directory: Root directory to search

    Yields:
        Paths to audio files
    """
    for root, _, files in os.walk(directory):
        for file in files:
            if Path(file).suffix.lower() in AUDIO_EXTENSIONS:
                yield Path(root) / file


def parse_transcript_file(transcript_path: Path) -> Dict[str, str]:
    """Parse a transcript file mapping audio filenames to text.

    Supports formats:
    - TSV: filename<tab>text
    - pipe-separated: filename|text
    - JSON: {"filename": "text", ...}

    Args:
        transcript_path: Path to transcript file

    Returns:
        Dict mapping filenames to transcripts
    """
    transcripts = {}

    with open(transcript_path, "r", encoding="utf-8") as f:
        content = f.read().strip()

    # Try JSON
    if content.startswith("{"):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

    # Try line-based formats
    for line in content.split("\n"):
        line = line.strip()
        if not line:
            continue

        # TSV format
        if "\t" in line:
            parts = line.split("\t", 1)
        # Pipe format
        elif "|" in line:
            parts = line.split("|", 1)
        else:
            continue

        if len(parts) == 2:
            filename, text = parts
            # Handle various filename formats
            filename = Path(filename).stem  # Remove extension
            transcripts[filename] = text.strip()

    return transcripts


def process_indicTTS(input_dir: Path, language: str) -> Generator[Dict[str, Any], None, None]:
    """Process IndicTTS dataset format.

    Args:
        input_dir: Directory containing IndicTTS data
        language: Language code

    Yields:
        Manifest entries
    """
    # IndicTTS structure: language/speaker/wav/*.wav + transcripts.txt
    lang_dir = input_dir / language
    if not lang_dir.exists():
        lang_dir = input_dir  # Try flat structure

    for speaker_dir in lang_dir.iterdir():
        if not speaker_dir.is_dir():
            continue

        speaker_id = speaker_dir.name
        wav_dir = speaker_dir / "wav"
        transcript_file = speaker_dir / "transcripts.txt"

        if not transcript_file.exists():
            transcript_file = speaker_dir / "txt"  # Alternative location
            if transcript_file.is_dir():
                # Individual txt files per audio
                for audio_file in find_audio_files(wav_dir if wav_dir.exists() else speaker_dir):
                    txt_file = transcript_file / f"{audio_file.stem}.txt"
                    if txt_file.exists():
                        text = txt_file.read_text(encoding="utf-8").strip()
                        duration = get_audio_duration(audio_file)
                        yield {
                            "audio_filepath": str(audio_file.absolute()),
                            "text": text,
                            "duration": duration,
                            "language": LANG_TO_BCP47.get(language, language),
                            "speaker_id": speaker_id,
                        }
                continue

        transcripts = parse_transcript_file(transcript_file) if transcript_file.exists() else {}

        audio_dir = wav_dir if wav_dir.exists() else speaker_dir
        for audio_file in find_audio_files(audio_dir):
            text = transcripts.get(audio_file.stem, "")
            if not text:
                continue

            duration = get_audio_duration(audio_file)
            yield {
                "audio_filepath": str(audio_file.absolute()),
                "text": text,
                "duration": duration,
                "language": LANG_TO_BCP47.get(language, language),
                "speaker_id": speaker_id,
            }


def process_huggingface_dataset(input_dir: Path, language: str) -> Generator[Dict[str, Any], None, None]:
    """Process a HuggingFace dataset saved to disk.

    Args:
        input_dir: Directory containing saved HF dataset
        language: Language code

    Yields:
        Manifest entries
    """
    if not HF_AVAILABLE:
        logger.warning("HuggingFace datasets not available")
        return

    try:
        dataset = load_from_disk(str(input_dir))

        for idx, sample in enumerate(dataset):
            # Handle different column names
            audio_path = sample.get("audio", {}).get("path") or sample.get("path") or sample.get("audio_filepath")
            text = sample.get("text") or sample.get("sentence") or sample.get("transcript", "")
            speaker = sample.get("speaker_id") or sample.get("client_id") or f"speaker_{idx // 100:04d}"

            if not audio_path or not text:
                continue

            # Get duration
            if "audio" in sample and isinstance(sample["audio"], dict):
                # HF audio format with array
                sr = sample["audio"].get("sampling_rate", 16000)
                array_len = len(sample["audio"].get("array", []))
                duration = array_len / sr if array_len > 0 else 0.0
            else:
                duration = sample.get("duration", 0.0)
                if duration == 0.0 and Path(audio_path).exists():
                    duration = get_audio_duration(Path(audio_path))

            yield {
                "audio_filepath": str(audio_path),
                "text": text,
                "duration": duration,
                "language": LANG_TO_BCP47.get(language, language),
                "speaker_id": str(speaker),
            }

    except Exception as e:
        logger.error(f"Failed to process HF dataset: {e}")


def process_openslr(input_dir: Path, language: str) -> Generator[Dict[str, Any], None, None]:
    """Process OpenSLR dataset format.

    Args:
        input_dir: Directory containing OpenSLR data
        language: Language code

    Yields:
        Manifest entries
    """
    # OpenSLR typically has: wav/speaker_id/*.wav and txt/speaker_id/*.txt
    # or flat structure with transcript.tsv

    # Try to find transcript file
    for transcript_name in ["line_index.tsv", "transcript.tsv", "transcripts.txt", "metadata.csv"]:
        transcript_file = input_dir / transcript_name
        if transcript_file.exists():
            transcripts = parse_transcript_file(transcript_file)
            break
    else:
        transcripts = {}

    # Process audio files
    for audio_file in find_audio_files(input_dir):
        # Try to find matching transcript
        text = transcripts.get(audio_file.stem, "")

        if not text:
            # Try to find .txt file with same name
            txt_file = audio_file.with_suffix(".txt")
            if txt_file.exists():
                text = txt_file.read_text(encoding="utf-8").strip()

        if not text:
            continue

        # Extract speaker from path
        speaker_id = audio_file.parent.name if audio_file.parent.name != input_dir.name else "default"

        duration = get_audio_duration(audio_file)
        yield {
            "audio_filepath": str(audio_file.absolute()),
            "text": text,
            "duration": duration,
            "language": LANG_TO_BCP47.get(language, language),
            "speaker_id": speaker_id,
        }


def generate_manifest(
    input_dir: Path,
    output_dir: Path,
    dataset_type: str,
    language: str,
    format_hint: Optional[str] = None,
    min_duration: float = 0.5,
    max_duration: float = 30.0,
    train_ratio: float = 0.9,
) -> Tuple[Path, Path]:
    """Generate training manifests from a dataset.

    Args:
        input_dir: Input dataset directory
        output_dir: Output manifest directory
        dataset_type: 'tts' or 'stt'
        language: Language code
        format_hint: Dataset format hint ('indicTTS', 'openslr', 'huggingface')
        min_duration: Minimum audio duration in seconds
        max_duration: Maximum audio duration in seconds
        train_ratio: Ratio of data for training (rest goes to validation)

    Returns:
        Tuple of (train_manifest_path, val_manifest_path)
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Detect format if not specified
    if not format_hint:
        if (input_dir / "dataset_info.json").exists():
            format_hint = "huggingface"
        elif any((input_dir / f).exists() for f in ["line_index.tsv", "transcript.tsv"]):
            format_hint = "openslr"
        else:
            format_hint = "indicTTS"

    logger.info(f"Processing {format_hint} format dataset from {input_dir}")

    # Process dataset
    if format_hint == "huggingface":
        entries = list(process_huggingface_dataset(input_dir, language))
    elif format_hint == "openslr":
        entries = list(process_openslr(input_dir, language))
    else:
        entries = list(process_indicTTS(input_dir, language))

    # Filter by duration
    filtered_entries = [
        e for e in entries
        if min_duration <= e["duration"] <= max_duration
    ]

    logger.info(f"Found {len(entries)} entries, {len(filtered_entries)} after filtering")

    if not filtered_entries:
        raise ValueError("No valid entries found in dataset")

    # Split into train/val
    split_idx = int(len(filtered_entries) * train_ratio)
    train_entries = filtered_entries[:split_idx]
    val_entries = filtered_entries[split_idx:]

    # Write manifests
    train_path = output_dir / f"{dataset_type}_{language}_train.jsonl"
    val_path = output_dir / f"{dataset_type}_{language}_val.jsonl"

    with open(train_path, "w", encoding="utf-8") as f:
        for entry in train_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    with open(val_path, "w", encoding="utf-8") as f:
        for entry in val_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    logger.info(f"Train manifest: {train_path} ({len(train_entries)} entries)")
    logger.info(f"Val manifest: {val_path} ({len(val_entries)} entries)")

    return train_path, val_path


def merge_manifests(manifest_paths: List[Path], output_path: Path) -> Path:
    """Merge multiple manifest files into one.

    Args:
        manifest_paths: List of manifest file paths
        output_path: Output merged manifest path

    Returns:
        Path to merged manifest
    """
    all_entries = []

    for path in manifest_paths:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    all_entries.append(json.loads(line))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        for entry in all_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    logger.info(f"Merged {len(manifest_paths)} manifests into {output_path} ({len(all_entries)} entries)")
    return output_path


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate JSONL training manifests from datasets",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Generate TTS manifest from IndicTTS
    python manifest_generator.py --input data/raw/indicTTS/hi --output data/manifests --type tts --lang hi

    # Generate STT manifest from Shrutilipi
    python manifest_generator.py --input data/raw/shrutilipi/ta --output data/manifests --type stt --lang ta

    # Merge multiple manifests
    python manifest_generator.py --merge data/manifests/tts_hi_train.jsonl data/manifests/tts_bn_train.jsonl \\
                                 --output data/manifests/tts_indic_train.jsonl
        """,
    )
    parser.add_argument("--input", type=str, help="Input dataset directory")
    parser.add_argument("--output", type=str, default="data/manifests", help="Output directory")
    parser.add_argument("--type", choices=["tts", "stt"], help="Dataset type")
    parser.add_argument("--lang", type=str, help="Language code")
    parser.add_argument("--format", type=str, choices=["indicTTS", "openslr", "huggingface"],
                        help="Dataset format hint")
    parser.add_argument("--min-duration", type=float, default=0.5, help="Minimum audio duration")
    parser.add_argument("--max-duration", type=float, default=30.0, help="Maximum audio duration")
    parser.add_argument("--train-ratio", type=float, default=0.9, help="Train/val split ratio")
    parser.add_argument("--merge", nargs="+", type=str, help="Manifest files to merge")

    args = parser.parse_args()

    if args.merge:
        # Merge mode
        if not args.output:
            parser.error("--output required for merge mode")
        merge_manifests([Path(p) for p in args.merge], Path(args.output))
    else:
        # Generate mode
        if not args.input or not args.type or not args.lang:
            parser.error("--input, --type, and --lang are required")

        generate_manifest(
            Path(args.input),
            Path(args.output),
            args.type,
            args.lang,
            args.format,
            args.min_duration,
            args.max_duration,
            args.train_ratio,
        )


if __name__ == "__main__":
    main()
