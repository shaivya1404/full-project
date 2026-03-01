#!/usr/bin/env python3
"""Combine all manifests into single training files."""
import json
from pathlib import Path

def combine_manifests(base_dir: Path, output_dir: Path):
    """Combine all manifests by language."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all manifests (prefer transcribed, but include all)
    all_manifests = {}
    for manifest in base_dir.rglob("manifest*.jsonl"):
        key = manifest.parent
        # Prefer transcribed version
        if "transcribed" in manifest.name:
            all_manifests[key] = manifest
        elif key not in all_manifests:
            all_manifests[key] = manifest
    manifests = list(all_manifests.values())

    print(f"Found {len(manifests)} manifest files")

    # Group by language
    by_lang = {"en": [], "hi": []}

    for manifest_path in manifests:
        with open(manifest_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    sample = json.loads(line)
                    lang = sample.get("language", "hi")[:2]

                    # Fix audio path to be absolute
                    audio_path = manifest_path.parent / sample["audio_filepath"]
                    sample["audio_filepath"] = str(audio_path.absolute())

                    if lang in by_lang:
                        by_lang[lang].append(sample)

    # Save combined manifests
    for lang, samples in by_lang.items():
        if samples:
            output_path = output_dir / f"{lang}_train.jsonl"
            with open(output_path, "w", encoding="utf-8") as f:
                for sample in samples:
                    f.write(json.dumps(sample, ensure_ascii=False) + "\n")
            print(f"{lang}: {len(samples)} samples -> {output_path}")

    # Print summary
    total = sum(len(s) for s in by_lang.values())
    total_duration = sum(
        sum(s.get("duration", 0) for s in samples)
        for samples in by_lang.values()
    )
    print(f"\nTotal: {total} samples, {total_duration/3600:.2f} hours")

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent.parent / "data" / "stt" / "extracted"
    output_dir = Path(__file__).parent.parent.parent / "data" / "stt" / "combined"
    combine_manifests(base_dir, output_dir)
