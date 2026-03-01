#!/usr/bin/env python3
"""Batch extract audio from YouTube URLs for STT training.

Simple script to process multiple YouTube URLs and extract clean speech.

Usage:
    python batch_extract.py --start          # Start extraction from youtube_sources.txt
    python batch_extract.py --url "URL"      # Extract single URL
    python batch_extract.py --status         # Check progress
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from datetime import datetime

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from loguru import logger


# Configuration
BASE_DIR = Path(__file__).parent.parent.parent  # tts-stt folder
DATA_DIR = BASE_DIR / "data" / "stt"
SOURCES_FILE = DATA_DIR / "youtube_sources.txt"
PROGRESS_FILE = DATA_DIR / "extraction_progress.json"


def load_progress() -> dict:
    """Load extraction progress."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"completed": [], "failed": [], "total_duration": 0, "total_samples": 0}


def save_progress(progress: dict):
    """Save extraction progress."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)


def parse_sources_file() -> list:
    """Parse youtube_sources.txt file."""
    sources = []

    if not SOURCES_FILE.exists():
        logger.error(f"Sources file not found: {SOURCES_FILE}")
        return sources

    with open(SOURCES_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            parts = line.split("|")
            url = parts[0].strip()
            lang = parts[1].strip() if len(parts) > 1 else "hi"
            category = parts[2].strip() if len(parts) > 2 else "general"

            if "youtube.com" in url or "youtu.be" in url:
                sources.append({"url": url, "lang": lang, "category": category})

    return sources


def extract_video_id(url: str) -> str:
    """Extract video ID from YouTube URL."""
    patterns = [
        r'(?:v=|/)([a-zA-Z0-9_-]{11})',
        r'(?:youtu\.be/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return url[:11]


def download_and_extract(url: str, lang: str, category: str) -> dict:
    """Download and extract audio from a single URL.

    Returns:
        dict with status, samples count, duration
    """
    video_id = extract_video_id(url)
    output_dir = DATA_DIR / "youtube" / lang / category
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Processing: {url}")
    logger.info(f"Language: {lang}, Category: {category}")

    # Step 1: Download audio using yt-dlp
    audio_file = output_dir / f"{video_id}.wav"

    if not audio_file.exists():
        logger.info("Downloading audio...")
        cmd = [
            "yt-dlp",
            "-x",
            "--audio-format", "wav",
            "--audio-quality", "0",
            "-o", str(output_dir / "%(id)s.%(ext)s"),
            "--no-playlist",
            url,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"Download failed: {result.stderr}")
            return {"status": "failed", "error": "download_failed"}

    # Find the downloaded file
    audio_files = list(output_dir.glob(f"{video_id}.*"))
    if not audio_files:
        return {"status": "failed", "error": "no_audio_file"}

    audio_file = audio_files[0]

    # Step 2: Download subtitles
    logger.info("Downloading subtitles...")
    sub_cmd = [
        "yt-dlp",
        "--write-auto-sub",
        "--sub-lang", f"{lang},en,hi",
        "--sub-format", "srt",
        "--skip-download",
        "-o", str(output_dir / "%(id)s.%(ext)s"),
        "--no-playlist",
        url,
    ]
    subprocess.run(sub_cmd, capture_output=True, text=True)

    # Find subtitle file
    sub_files = list(output_dir.glob(f"{video_id}*.srt")) + list(output_dir.glob(f"{video_id}*.vtt"))
    sub_file = sub_files[0] if sub_files else None

    # Step 3: Extract segments using youtube_extractor
    logger.info("Extracting speech segments...")

    try:
        from youtube_extractor import YouTubeExtractor

        extractor = YouTubeExtractor(
            output_dir=output_dir / "segments",
            language=lang.split("-")[0],  # hi-en -> hi
            min_duration=2.0,
            max_duration=20.0,
            apply_noise_reduction=True,
        )

        samples = extractor.process_local_file(audio_file, sub_file)

        # Save manifest for this video
        manifest_file = output_dir / "segments" / f"{video_id}_manifest.jsonl"
        extractor.save_manifest(samples, f"{video_id}_manifest.jsonl")

        total_duration = sum(s.duration for s in samples)

        return {
            "status": "success",
            "samples": len(samples),
            "duration": total_duration,
            "manifest": str(manifest_file),
        }

    except Exception as e:
        logger.error(f"Extraction failed: {e}")

        # Fallback: just keep the full audio
        return {
            "status": "partial",
            "samples": 1,
            "duration": 0,
            "error": str(e),
        }


def run_extraction():
    """Run extraction on all sources."""
    sources = parse_sources_file()
    progress = load_progress()

    if not sources:
        logger.error("No sources found. Add URLs to data/stt/youtube_sources.txt")
        return

    logger.info(f"Found {len(sources)} sources")
    logger.info(f"Already completed: {len(progress['completed'])}")

    for source in sources:
        url = source["url"]
        video_id = extract_video_id(url)

        # Skip if already done
        if video_id in progress["completed"]:
            logger.info(f"Skipping (already done): {video_id}")
            continue

        if video_id in progress["failed"]:
            logger.info(f"Skipping (previously failed): {video_id}")
            continue

        # Process
        result = download_and_extract(url, source["lang"], source["category"])

        if result["status"] == "success":
            progress["completed"].append(video_id)
            progress["total_samples"] += result.get("samples", 0)
            progress["total_duration"] += result.get("duration", 0)
            logger.info(f"SUCCESS: {result['samples']} samples, {result['duration']:.1f}s")
        else:
            progress["failed"].append(video_id)
            logger.error(f"FAILED: {result.get('error', 'unknown')}")

        save_progress(progress)

        print(f"\n--- Progress: {len(progress['completed'])}/{len(sources)} videos ---")
        print(f"Total samples: {progress['total_samples']}")
        print(f"Total duration: {progress['total_duration']/3600:.2f} hours\n")


def show_status():
    """Show extraction status."""
    progress = load_progress()
    sources = parse_sources_file()

    print("\n" + "=" * 50)
    print("STT DATA EXTRACTION STATUS")
    print("=" * 50)
    print(f"\nTotal sources: {len(sources)}")
    print(f"Completed: {len(progress['completed'])}")
    print(f"Failed: {len(progress['failed'])}")
    print(f"Remaining: {len(sources) - len(progress['completed']) - len(progress['failed'])}")
    print(f"\nTotal samples extracted: {progress['total_samples']}")
    print(f"Total audio duration: {progress['total_duration']/3600:.2f} hours")
    print("=" * 50 + "\n")


def extract_single(url: str, lang: str = "hi"):
    """Extract from a single URL."""
    result = download_and_extract(url, lang, "single")

    if result["status"] == "success":
        print(f"\nSUCCESS!")
        print(f"Samples: {result['samples']}")
        print(f"Duration: {result['duration']:.1f} seconds")
        print(f"Manifest: {result['manifest']}")
    else:
        print(f"\nFAILED: {result.get('error', 'unknown')}")


def main():
    parser = argparse.ArgumentParser(description="Batch extract YouTube audio for STT")
    parser.add_argument("--start", action="store_true", help="Start batch extraction")
    parser.add_argument("--url", type=str, help="Extract single URL")
    parser.add_argument("--lang", type=str, default="hi", help="Language (hi/en)")
    parser.add_argument("--status", action="store_true", help="Show progress status")
    parser.add_argument("--reset", action="store_true", help="Reset progress")

    args = parser.parse_args()

    if args.reset:
        if PROGRESS_FILE.exists():
            os.remove(PROGRESS_FILE)
        print("Progress reset.")
        return

    if args.status:
        show_status()
        return

    if args.url:
        extract_single(args.url, args.lang)
        return

    if args.start:
        run_extraction()
        return

    # Default: show help
    parser.print_help()


if __name__ == "__main__":
    main()
