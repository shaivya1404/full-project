#!/usr/bin/env python3
"""Batch extract Hindi audio from multiple YouTube videos."""
import subprocess
import sys
from pathlib import Path

# Video IDs to process (curated list)
HINDI_VIDEOS = [
    # News - Formal Hindi
    ("CoMml30MJ3c", "news", "Aaj Tak Weather"),
    ("IzGxFLQoal4", "news", "NDTV India"),

    # Educational - Clear pronunciation
    ("uplQ3jn6SPg", "education", "Khan Academy 1"),
    ("6Lna51cVShg", "education", "Khan Academy 2"),
    ("3eASa-TFF0k", "education", "Khan Academy 3"),

    # Podcasts - Conversational
    ("SSyc52SsdrM", "podcast", "Hindi Podcast 1"),
]

def run_command(cmd):
    """Run command and return success."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr[:200]}")
        return False
    return True

def main():
    base_dir = Path(__file__).parent.parent.parent
    output_base = base_dir / "data" / "stt" / "extracted" / "hindi"

    total_segments = 0

    for video_id, category, desc in HINDI_VIDEOS:
        print(f"\n{'='*60}")
        print(f"Processing: {desc} ({video_id})")
        print('='*60)

        url = f"https://www.youtube.com/watch?v={video_id}"
        output_dir = output_base / category / video_id

        # Check if already processed
        manifest = output_dir / "manifest_transcribed.jsonl"
        if manifest.exists():
            with open(manifest) as f:
                count = sum(1 for _ in f)
            print(f"Already processed: {count} segments")
            total_segments += count
            continue

        # Extract
        print("Extracting audio segments...")
        cmd = f'python ml-service/data/simple_extract.py --url "{url}" --output "{output_dir}" --lang hi'
        if not run_command(cmd):
            print(f"Failed to extract: {video_id}")
            continue

        # Transcribe
        print("Transcribing...")
        manifest_path = output_dir / "manifest.jsonl"
        cmd = f'python ml-service/data/transcribe_segments.py --manifest "{manifest_path}" --lang hi'
        if not run_command(cmd):
            print(f"Failed to transcribe: {video_id}")
            continue

        # Count segments
        if manifest.exists():
            with open(manifest) as f:
                count = sum(1 for _ in f)
            print(f"Extracted: {count} segments")
            total_segments += count

    print(f"\n{'='*60}")
    print(f"TOTAL HINDI SEGMENTS: {total_segments}")
    print('='*60)

if __name__ == "__main__":
    main()
