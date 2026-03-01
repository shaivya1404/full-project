#!/usr/bin/env python3
"""Dataset downloaders for STT/TTS training (English customer-care + Indic).

Supports downloading from:
- HuggingFace Hub (AI4Bharat, Mozilla, Google datasets)
- OpenSLR (LibriSpeech, MUSAN, TED-LIUM, VoxPopuli)
- Mozilla Common Voice

English customer-care datasets:
    python download_datasets.py --dataset librispeech_test --output data/raw
    python download_datasets.py --dataset musan --output data/raw
    python download_datasets.py --dataset common_voice --lang en --output data/raw
    python download_datasets.py --dataset voxpopuli --lang en --output data/raw
    python download_datasets.py --dataset ted_lium --output data/raw
    python download_datasets.py --dataset customer_care_all --output data/raw

Indic datasets:
    python download_datasets.py --dataset indicTTS --lang hi --output data/raw
    python download_datasets.py --dataset shrutilipi --lang ta --output data/raw
    python download_datasets.py --dataset common_voice --lang hi --output data/raw
"""
from __future__ import annotations

import argparse
import os
import shutil
import tarfile
import zipfile
from pathlib import Path
from typing import Dict, List, Optional
from urllib.request import urlretrieve

from loguru import logger

try:
    from datasets import load_dataset
    from huggingface_hub import hf_hub_download, snapshot_download
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    logger.warning("HuggingFace libraries not available. Install with: pip install datasets huggingface_hub")


# Dataset registry with metadata
# RECOMMENDED FOR ENGLISH + HINDI: Use "common_voice", "fleurs", "librispeech" for English
#                                  Use "common_voice", "shrutilipi", "indicTTS" for Hindi
DATASETS: Dict[str, Dict] = {
    # ============================================
    # ENGLISH STT — CUSTOMER CARE TEST DATASETS
    # ============================================

    # --- LibriSpeech (clean / noisy English speech) ---
    "librispeech_test": {
        "type": "stt",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/12/test-clean.tar.gz",
        "languages": ["en"],
        "size_mb": 346,
        "description": "LibriSpeech test-clean — 5 h clean English speech (no login needed)",
    },
    "librispeech_test_other": {
        "type": "stt",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/12/test-other.tar.gz",
        "languages": ["en"],
        "size_mb": 328,
        "description": "LibriSpeech test-other — 5 h harder/accented English speech",
    },
    "librispeech_train_100": {
        "type": "stt",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/12/train-clean-100.tar.gz",
        "languages": ["en"],
        "size_mb": 6300,
        "description": "LibriSpeech train-clean-100 — 100 h clean English (for training)",
    },

    "librispeech_train_360": {
        "type": "stt",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/12/train-clean-360.tar.gz",
        "languages": ["en"],
        "size_mb": 23000,
        "description": "LibriSpeech train-clean-360 — 360 h clean English (larger training set)",
    },

    "librispeech_dev_clean": {
        "type": "stt",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/12/dev-clean.tar.gz",
        "languages": ["en"],
        "size_mb": 337,
        "description": "LibriSpeech dev-clean — validation set, clean English speech",
    },

    "librispeech_dev_other": {
        "type": "stt",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/12/dev-other.tar.gz",
        "languages": ["en"],
        "size_mb": 314,
        "description": "LibriSpeech dev-other — validation set, harder English speech",
    },

    # --- MUSAN noise dataset (essential for noise augmentation) ---
    "musan": {
        "type": "noise",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/17/musan.tar.gz",
        "languages": ["en"],
        "size_mb": 10000,
        "description": "MUSAN — music, noise & speech samples for audio augmentation",
    },

    # --- TED-LIUM 3 (lecture/conference English speech) ---
    "ted_lium": {
        "type": "stt",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/51/TEDLIUM_release-3.tgz",
        "languages": ["en"],
        "size_mb": 50000,
        "description": "TED-LIUM 3 — 450 h TED talks English speech (large download)",
    },

    # --- VoxPopuli (European-accented English via HuggingFace) ---
    "voxpopuli": {
        "type": "stt",
        "source": "huggingface",
        "repo_id": "facebook/voxpopuli",
        "config": "en",
        "languages": ["en"],
        "size_mb": 2000,
        "description": "VoxPopuli — European-accented English from EU Parliament recordings",
    },

    # --- Common Voice English (multi-accent, crowd-sourced) ---
    # Also supports Indic languages — see lang argument
    "common_voice": {
        "type": "both",
        "source": "huggingface",
        "repo_id": "mozilla-foundation/common_voice_17_0",
        "languages": ["en", "hi", "ta", "te", "bn", "mr", "gu", "pa", "ur"],
        "size_mb": 2500,
        "description": "Mozilla Common Voice 17.0 — crowd-sourced multi-accent speech",
    },

    # ============================================
    # INDIAN ACCENT ENGLISH DATASETS (verified)
    # ============================================

    # BEST — 9.6 h, 117 speakers across 65 Indian districts, CC BY 4.0
    "svarah": {
        "type": "stt",
        "source": "huggingface",
        "repo_id": "ai4bharat/Svarah",
        "languages": ["en"],
        "size_mb": 950,
        "description": (
            "AI4Bharat Svarah — 9.6 h Indian-accented English, 117 speakers, "
            "65 districts across 19 Indian states, 19 native language backgrounds. "
            "Best dedicated Indian English accent dataset. (HF login required)"
        ),
    },

    # Hindi-English + Bengali-English code-switched speech (OpenSLR 104)
    "openslr_codeswitched": {
        "type": "stt",
        "source": "openslr_multi",
        "parts": [
            "https://www.openslr.org/resources/104/Hindi-English_test.tar.gz",   # 443 MB
            "https://www.openslr.org/resources/104/Hindi-English_train.tar.gz",  # 7.3 GB
        ],
        "languages": ["en"],
        "size_mb": 7800,
        "description": (
            "OpenSLR-104 — Hindi-English code-switched speech, "
            "7.3 GB train + 443 MB test. Real Indian bilingual speech. "
            "No login required."
        ),
    },
    # test-only variant (small, 443 MB — download this first to verify)
    "openslr_codeswitched_test": {
        "type": "stt",
        "source": "openslr_multi",
        "parts": [
            "https://www.openslr.org/resources/104/Hindi-English_test.tar.gz",   # 443 MB only
        ],
        "languages": ["en"],
        "size_mb": 443,
        "description": (
            "OpenSLR-104 test set only (443 MB) — Hindi-English code-switched speech. "
            "Use this to verify before downloading the full 7.3 GB train set."
        ),
    },

    # Common Voice English filtered for Indian accent speakers
    "common_voice_indian": {
        "type": "stt",
        "source": "huggingface_accent",
        "repo_id": "mozilla-foundation/common_voice_17_0",
        "config": "en",
        "accent_filter": "India",
        "split": "train",      # test split has no data files; use train
        "languages": ["en"],
        "size_mb": 300,
        "description": (
            "Mozilla Common Voice 17.0 English — filtered to India-accent speakers only. "
            "Crowd-sourced, diverse Indian English. (HF login required)"
        ),
    },

    # ============================================
    # ENGLISH DATASETS (High-Quality)
    # ============================================
    "librispeech": {
        "type": "stt",
        "source": "huggingface",
        "repo_id": "librispeech_asr",
        "languages": ["en"],
        "description": "LibriSpeech via HuggingFace - 960 hours of English audiobooks (BEST for English STT)",
    },
    "ljspeech": {
        "type": "tts",
        "source": "huggingface",
        "repo_id": "lj_speech",
        "languages": ["en"],
        "description": "LJ Speech - 24 hours of single female English speaker (BEST for English TTS)",
    },
    "vctk": {
        "type": "tts",
        "source": "huggingface",
        "repo_id": "vctk",
        "languages": ["en"],
        "description": "VCTK - 44 hours, 110 English speakers with different accents",
    },
    # ============================================
    # HINDI DATASETS (High-Quality)
    # ============================================
    "indicTTS": {
        "type": "tts",
        "source": "huggingface",
        "repo_id": "ai4bharat/indicTTS",
        "languages": ["hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "or", "pa", "as", "ur", "en"],
        "description": "IndicTTS from IIT Madras - 40+ hrs per language (BEST for Hindi TTS)",
    },
    "kathbath": {
        "type": "tts",
        "source": "huggingface",
        "repo_id": "ai4bharat/kathbath",
        "languages": ["hi", "bn"],
        "description": "AI4Bharat Kathbath - 30+ hours of Hindi and Bengali",
    },
    "openslr_hindi": {
        "type": "tts",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/103/hi_in_female.zip",
        "languages": ["hi"],
        "description": "OpenSLR Hindi TTS - 10-20 hours clean studio recordings",
    },
    "shrutilipi": {
        "type": "stt",
        "source": "huggingface",
        "repo_id": "ai4bharat/shrutilipi",
        "languages": ["hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "or", "pa", "as", "ne"],
        "description": "Shrutilipi - 6400+ hours (BEST for Hindi STT)",
    },
    # ============================================
    # MULTILINGUAL (English + Hindi + Others)
    # ============================================
    "fleurs": {
        "type": "both",
        "source": "huggingface",
        "repo_id": "google/fleurs",
        "languages": ["en", "hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa", "ur"],
        "description": "Google FLEURS - High quality multilingual (RECOMMENDED for both)",
    },
    "common_voice": {
        "type": "both",
        "source": "huggingface",
        "repo_id": "mozilla-foundation/common_voice_16_1",
        "languages": ["en", "hi", "ta", "te", "bn", "mr", "gu", "pa", "ur"],
        "description": "Mozilla Common Voice - Crowd-sourced voices (RECOMMENDED)",
    },
    # ============================================
    # OTHER INDIC DATASETS
    # ============================================
    "indic_superb": {
        "type": "stt",
        "source": "huggingface",
        "repo_id": "ai4bharat/indicSUPERB",
        "languages": ["hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "or", "pa", "as", "ne"],
        "description": "IndicSUPERB benchmark - 3000+ hours",
    },
    "mucs_2021": {
        "type": "stt",
        "source": "huggingface",
        "repo_id": "MUCS/2021",
        "languages": ["hi", "ta", "te", "gu", "mr", "or"],
        "description": "MUCS 2021 - 600+ hours for 6 Indic languages",
    },
    "openslr_tamil": {
        "type": "tts",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/65/ta_in_female.zip",
        "languages": ["ta"],
        "description": "OpenSLR Tamil TTS - 10-20 hours",
    },
    "openslr_bengali": {
        "type": "tts",
        "source": "openslr",
        "url": "https://www.openslr.org/resources/37/bn_bd_female.zip",
        "languages": ["bn"],
        "description": "OpenSLR Bengali TTS - 10-20 hours",
    },
}

# Language code mappings
LANG_CODES: Dict[str, str] = {
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "or": "Odia",
    "pa": "Punjabi",
    "as": "Assamese",
    "ur": "Urdu",
    "ne": "Nepali",
    "en": "English",
}


_last_reported_pct = -1


# ---------------------------------------------------------------------------
# Edge-case helpers
# ---------------------------------------------------------------------------

def check_disk_space(required_mb: float, path: Path) -> None:
    """Raise RuntimeError if free disk space is less than required_mb * 2.5."""
    import shutil
    free_bytes = shutil.disk_usage(path).free
    free_mb = free_bytes / (1024 * 1024)
    needed_mb = required_mb * 2.5  # compressed + extracted + buffer
    if free_mb < needed_mb:
        raise RuntimeError(
            f"Not enough disk space. Need ~{needed_mb:.0f} MB, "
            f"only {free_mb:.0f} MB free on {path.anchor}"
        )


def verify_archive(path: Path) -> bool:
    """Return True if archive can be opened without errors."""
    try:
        if str(path).endswith(".tar.gz") or str(path).endswith(".tgz"):
            with tarfile.open(path, "r:gz") as tf:
                tf.getmembers()  # read all headers
        elif str(path).endswith(".zip"):
            with zipfile.ZipFile(path, "r") as zf:
                zf.namelist()
        return True
    except Exception:
        return False


def download_progress_hook(block_num: int, block_size: int, total_size: int) -> None:
    """Progress hook for urlretrieve. Prints every 5%."""
    global _last_reported_pct
    if total_size <= 0:
        return
    downloaded = min(block_num * block_size, total_size)
    percent = int((downloaded / total_size) * 100)
    mb_done = downloaded / (1024 * 1024)
    mb_total = total_size / (1024 * 1024)
    if percent >= _last_reported_pct + 5:
        _last_reported_pct = (percent // 5) * 5
        print(f"  {_last_reported_pct:3d}%  {mb_done:.1f} MB / {mb_total:.1f} MB", flush=True)
    if percent >= 100:
        _last_reported_pct = -1  # reset for next file


def download_from_openslr(url: str, output_dir: Path, extract: bool = True) -> Path:
    """Download dataset from OpenSLR.

    Args:
        url: Direct download URL
        output_dir: Directory to save the dataset
        extract: Whether to extract archives

    Returns:
        Path to downloaded/extracted directory
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = url.split("/")[-1]
    download_path = output_dir / filename

    if download_path.exists() and verify_archive(download_path):
        logger.info(f"Already downloaded: {filename}")
    else:
        if download_path.exists():
            logger.warning(f"Corrupted archive, re-downloading: {filename}")
            download_path.unlink()
        download_file_direct(url, download_path)

    if extract:
        extract_dir = output_dir / filename.replace(".zip", "").replace(".tar.gz", "")
        if extract_dir.exists():
            logger.info(f"Already extracted: {extract_dir}")
            return extract_dir
        extract_archive(download_path, extract_dir)
        return extract_dir

    return download_path


def download_from_huggingface(
    repo_id: str,
    output_dir: Path,
    language: Optional[str] = None,
    config: Optional[str] = None,
    split: str = "train",
    streaming: bool = False,
    max_samples: Optional[int] = None,
) -> Path:
    """Download dataset from HuggingFace Hub.

    Args:
        repo_id: HuggingFace repository ID
        output_dir: Directory to save the dataset
        language: Language code to filter (optional)
        config: Dataset config name (overrides language when set)
        split: Dataset split (train, validation, test)
        streaming: Whether to use streaming mode
        max_samples: Maximum number of samples to download

    Returns:
        Path to downloaded dataset directory
    """
    if not HF_AVAILABLE:
        raise RuntimeError("HuggingFace libraries required. Install with: pip install datasets huggingface_hub")

    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Loading dataset from HuggingFace: {repo_id}")

    # config takes priority; fall back to language
    cfg_name = config or language

    try:
        if cfg_name:
            dataset = load_dataset(repo_id, cfg_name, split=split, streaming=streaming)
        else:
            dataset = load_dataset(repo_id, split=split, streaming=streaming)

        if max_samples and not streaming:
            dataset = dataset.select(range(min(max_samples, len(dataset))))

        # Save to disk
        save_path = output_dir / repo_id.replace("/", "_") / (cfg_name or "all") / split
        save_path.mkdir(parents=True, exist_ok=True)

        if not streaming:
            dataset.save_to_disk(str(save_path))
            logger.info(f"Dataset saved to: {save_path}")
        else:
            import soundfile as sf
            import numpy as np
            audio_dir = save_path / "audio"
            audio_dir.mkdir(exist_ok=True)
            trans_lines: List[str] = []
            count = 0
            for sample in dataset:
                if max_samples and count >= max_samples:
                    break
                try:
                    arr = sample["audio"]["array"]
                    sr  = sample["audio"]["sampling_rate"]
                    txt = sample.get("sentence", sample.get("text", "")).strip()
                    fname = f"sample_{count:05d}.wav"
                    sf.write(str(audio_dir / fname), arr, sr)
                    if txt:
                        trans_lines.append(f"{fname}\t{txt}")
                    count += 1
                    if count % 100 == 0:
                        logger.info(f"  Saved {count} samples ...")
                except Exception as e:
                    logger.warning(f"  Skipping sample {count}: {e}")
            (save_path / "transcripts.txt").write_text(
                "\n".join(trans_lines), encoding="utf-8"
            )
            logger.info(f"Processed {count} samples -> {save_path}")

        return save_path

    except Exception as e:
        err = str(e).lower()
        if "gated" in err or "401" in err or "authentication" in err or "unauthorized" in err:
            logger.error(
                f"\n  '{repo_id}' requires HuggingFace login.\n"
                f"  Run:  huggingface-cli login\n"
                f"  Then accept the dataset terms at: https://huggingface.co/datasets/{repo_id}\n"
                f"  Then retry this command."
            )
            raise PermissionError(f"Authentication required for {repo_id}") from e
        logger.warning(f"Failed to load as dataset, trying snapshot download: {e}")
        save_path = output_dir / repo_id.replace("/", "_")
        snapshot_download(repo_id, local_dir=str(save_path))
        return save_path


def download_common_voice(
    language: str,
    output_dir: Path,
    split: str = "train",
    max_samples: Optional[int] = None,
) -> Path:
    """Download Mozilla Common Voice dataset for a specific language.

    Supports both English (en) and Indic languages (hi, ta, te, bn, ...).

    Args:
        language: Language code — 'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'pa', 'ur'
        output_dir: Directory to save the dataset
        split: Dataset split (train / validation / test)
        max_samples: Maximum samples to download

    Returns:
        Path to downloaded dataset
    """
    if not HF_AVAILABLE:
        raise RuntimeError("HuggingFace libraries required")

    repo_id = "mozilla-foundation/common_voice_17_0"
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Loading Common Voice {language} ({split}) from {repo_id}")

    try:
        use_streaming = max_samples is not None
        dataset = load_dataset(repo_id, language, split=split, streaming=use_streaming)

        save_path = output_dir / "common_voice" / language / split
        save_path.mkdir(parents=True, exist_ok=True)

        if not use_streaming:
            dataset.save_to_disk(str(save_path))
        else:
            import soundfile as sf
            audio_dir = save_path / "audio"
            audio_dir.mkdir(exist_ok=True)
            trans_lines: List[str] = []
            count = 0
            for sample in dataset:
                if count >= max_samples:
                    break
                try:
                    arr = sample["audio"]["array"]
                    sr  = sample["audio"]["sampling_rate"]
                    txt = sample.get("sentence", "").strip()
                    fname = f"cv_{language}_{count:05d}.wav"
                    sf.write(str(audio_dir / fname), arr, sr)
                    if txt:
                        trans_lines.append(f"{fname}\t{txt}")
                    count += 1
                    if count % 100 == 0:
                        logger.info(f"  Saved {count}/{max_samples} samples ...")
                except Exception as e:
                    logger.warning(f"  Skipping sample {count}: {e}")
            (save_path / "transcripts.txt").write_text(
                "\n".join(trans_lines), encoding="utf-8"
            )
            logger.info(f"Saved {count} Common Voice {language} samples -> {save_path}")

        return save_path

    except Exception as e:
        err = str(e).lower()
        if "gated" in err or "401" in err or "authentication" in err or "unauthorized" in err:
            logger.error(
                f"\n  Common Voice requires HuggingFace login.\n"
                f"  Run:  huggingface-cli login\n"
                f"  Then accept the terms at: https://huggingface.co/datasets/{repo_id}\n"
                f"  Then retry this command."
            )
        else:
            logger.error(f"Failed to download Common Voice {language}: {e}")
        raise


def download_common_voice_accent(
    repo_id: str,
    config: str,
    accent_filter: str,
    output_dir: Path,
    split: str = "test",
    max_samples: int = 500,
) -> Path:
    """Stream Common Voice and save only samples matching a specific accent.

    Args:
        repo_id: HuggingFace repo ID
        config: Language config ('en')
        accent_filter: Accent string to match (e.g. 'India')
        output_dir: Where to save audio + transcripts
        split: Dataset split
        max_samples: Max samples to collect

    Returns:
        Path to saved dataset directory
    """
    if not HF_AVAILABLE:
        raise RuntimeError("HuggingFace libraries required: pip install datasets soundfile")

    import soundfile as sf

    save_path = output_dir / "common_voice_indian" / split
    save_path.mkdir(parents=True, exist_ok=True)
    audio_dir = save_path / "audio"
    audio_dir.mkdir(exist_ok=True)

    logger.info(
        f"Streaming Common Voice '{config}' filtering accent='{accent_filter}' "
        f"(collecting up to {max_samples} samples) ..."
    )

    dataset = load_dataset(repo_id, config, split=split, streaming=True)

    trans_lines: List[str] = []
    count = 0
    scanned = 0

    for sample in dataset:
        scanned += 1
        accent = sample.get("accent", "") or ""
        # Match case-insensitively (e.g. "India", "india", "Indian English")
        if accent_filter.lower() not in accent.lower():
            if scanned % 1000 == 0:
                logger.info(f"  Scanned {scanned} samples, kept {count} Indian accent ...")
            continue

        try:
            arr = sample["audio"]["array"]
            sr  = sample["audio"]["sampling_rate"]
            txt = sample.get("sentence", "").strip()
            fname = f"cv_indian_{count:05d}.wav"
            sf.write(str(audio_dir / fname), arr, sr)
            if txt:
                trans_lines.append(f"{fname}\t{txt}")
            count += 1
            if count % 50 == 0:
                logger.info(f"  Saved {count}/{max_samples} Indian accent samples ...")
        except Exception as e:
            logger.warning(f"  Skipping sample: {e}")

        if count >= max_samples:
            break

    (save_path / "transcripts.txt").write_text("\n".join(trans_lines), encoding="utf-8")
    logger.success(
        f"Saved {count} Indian-accent Common Voice samples "
        f"(scanned {scanned} total) -> {save_path}"
    )
    return save_path


def list_datasets(dataset_type: Optional[str] = None) -> None:
    """List available datasets.

    Args:
        dataset_type: Filter by type ('tts', 'stt', or 'both')
    """
    print("\nAvailable Datasets:")
    print("=" * 80)

    for name, info in DATASETS.items():
        if dataset_type and info["type"] != dataset_type and info["type"] != "both":
            continue

        print(f"\n{name}:")
        print(f"  Type: {info['type'].upper()}")
        print(f"  Source: {info['source']}")
        print(f"  Languages: {', '.join(info['languages'])}")
        print(f"  Description: {info['description']}")


# Datasets that can be downloaded without specifying a language
NO_LANG_DATASETS = {
    "librispeech_test", "librispeech_test_other",
    "librispeech_train_100", "librispeech_train_360",
    "librispeech_dev_clean", "librispeech_dev_other",
    "musan", "ted_lium",
    "openslr_codeswitched", "openslr_codeswitched_test",
}

# Convenience bundle: all English customer-care datasets (small/medium size)
CUSTOMER_CARE_BUNDLE = [
    "librispeech_test",        # 346 MB — clean English baseline
    "librispeech_test_other",  # 328 MB — harder English
    "musan",                   # 10 GB  — noise for augmentation
]

# Indian accent bundle
# Only openslr_codeswitched works without login.
# svarah and common_voice_indian need: huggingface-cli login
INDIAN_ACCENT_BUNDLE_NO_LOGIN = [
    "openslr_codeswitched",    # Hindi-English telephone speech, ~90 h, NO login
]
INDIAN_ACCENT_BUNDLE_HF = [
    "svarah",                  # AI4Bharat, 9.6 h, 117 speakers — needs HF login
    "common_voice_indian",     # Common Voice India accent — needs HF login
]
INDIAN_ACCENT_BUNDLE = INDIAN_ACCENT_BUNDLE_NO_LOGIN + INDIAN_ACCENT_BUNDLE_HF


# ---------------------------------------------------------------------------
# Low-level helpers used by openslr_multi source
# ---------------------------------------------------------------------------
def download_file_direct(url: str, dest: Path, size_mb: float = 0, retries: int = 3) -> None:
    """Download a single file with progress, disk check, temp file, and retry."""
    if dest.exists():
        if verify_archive(dest):
            logger.info(f"  Already downloaded: {dest.name}")
            return
        else:
            logger.warning(f"  Corrupted archive found, re-downloading: {dest.name}")
            dest.unlink()

    if size_mb > 0:
        check_disk_space(size_mb, dest.parent)

    tmp = dest.with_suffix(dest.suffix + ".tmp")
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"  Downloading {dest.name} (attempt {attempt}/{retries}) ...")
            urlretrieve(url, tmp, reporthook=download_progress_hook)
            print()
            if not verify_archive(tmp):
                raise ValueError("Downloaded archive is corrupted")
            tmp.rename(dest)
            logger.info(f"  Saved: {dest.name}")
            return
        except Exception as e:
            if tmp.exists():
                tmp.unlink()
            if attempt < retries:
                logger.warning(f"  Attempt {attempt} failed ({e}), retrying ...")
            else:
                raise RuntimeError(f"Failed to download {dest.name} after {retries} attempts: {e}") from e


def extract_archive(archive: Path, dest_dir: Path) -> None:
    """Extract a .zip or .tar.gz archive into dest_dir."""
    import tarfile, zipfile
    if not archive.exists():
        raise FileNotFoundError(f"Archive not found: {archive}")
    if not verify_archive(archive):
        archive.unlink()
        raise ValueError(f"Archive is corrupted, deleted: {archive.name}. Re-run to re-download.")
    dest_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"  Extracting {archive.name} -> {dest_dir}")
    suffix = "".join(archive.suffixes).lower()
    if suffix.endswith(".tar.gz") or suffix.endswith(".tgz") or suffix == ".gz":
        with tarfile.open(archive, "r:gz") as tf:
            try:
                tf.extractall(dest_dir, filter="data")
            except TypeError:
                tf.extractall(dest_dir)  # Python < 3.12 fallback
    elif suffix == ".zip":
        with zipfile.ZipFile(archive, "r") as zf:
            zf.extractall(dest_dir)
    else:
        logger.warning(f"  Unknown archive format: {archive.name}")


def download_dataset(
    dataset_name: str,
    language: str,
    output_dir: Path,
    split: str = "train",
    max_samples: Optional[int] = None,
) -> Path:
    """Download a dataset by name.

    Args:
        dataset_name: Name of the dataset (or 'customer_care_all' for bundle)
        language: Language code ('en', 'hi', ...) — ignored for OpenSLR datasets
        output_dir: Output directory
        split: Dataset split (train / validation / test)
        max_samples: Maximum samples (HuggingFace streaming only)

    Returns:
        Path to downloaded dataset
    """
    # --- Bundle shortcuts ---
    if dataset_name == "customer_care_all":
        logger.info("Downloading customer-care bundle: " + ", ".join(CUSTOMER_CARE_BUNDLE))
        last_path = output_dir
        for name in CUSTOMER_CARE_BUNDLE:
            last_path = download_dataset(name, "en", output_dir, split, max_samples)
        return last_path

    if dataset_name == "indian_accent_all":
        logger.info("Downloading Indian accent bundle: " + ", ".join(INDIAN_ACCENT_BUNDLE))
        logger.info(
            "  No-login datasets : " + ", ".join(INDIAN_ACCENT_BUNDLE_NO_LOGIN) + "\n"
            "  Needs HF login    : " + ", ".join(INDIAN_ACCENT_BUNDLE_HF) + "\n"
            "  (Run 'huggingface-cli login' to enable gated datasets)"
        )
        last_path = output_dir
        for name in INDIAN_ACCENT_BUNDLE:
            try:
                last_path = download_dataset(name, "en", output_dir, split, max_samples)
            except PermissionError:
                logger.warning(
                    f"  Skipping '{name}' — login required. "
                    f"Run: huggingface-cli login"
                )
            except Exception as e:
                logger.warning(f"  Skipping '{name}' — {e}")
        return last_path

    if dataset_name not in DATASETS:
        available = ", ".join(sorted(DATASETS.keys()))
        raise ValueError(f"Unknown dataset: '{dataset_name}'. Available:\n  {available}")

    info = DATASETS[dataset_name]

    # Language check — skip for OpenSLR-only datasets
    if dataset_name not in NO_LANG_DATASETS:
        if language not in info["languages"]:
            available = ", ".join(info["languages"])
            raise ValueError(
                f"Language '{language}' not available for '{dataset_name}'. "
                f"Available: {available}"
            )

    size_note = f"  (~{info.get('size_mb', '?')} MB)" if "size_mb" in info else ""
    logger.info(f"Downloading '{dataset_name}' ({info['description']}){size_note}")

    # Disk space guard
    if "size_mb" in info:
        check_disk_space(info["size_mb"], output_dir)

    if info["source"] == "openslr":
        return download_from_openslr(info["url"], output_dir)

    elif info["source"] == "openslr_multi":
        # Download every part then merge into one folder
        dest_dir = output_dir / dataset_name
        dest_dir.mkdir(parents=True, exist_ok=True)
        for part_url in info["parts"]:
            part_file = output_dir / "archives" / Path(part_url).name
            part_file.parent.mkdir(parents=True, exist_ok=True)
            download_file_direct(part_url, part_file)
            extract_archive(part_file, dest_dir)
        logger.success(f"All parts extracted -> {dest_dir}")
        return dest_dir

    elif info["source"] == "huggingface":
        if dataset_name == "common_voice":
            return download_common_voice(language, output_dir, split, max_samples)
        else:
            return download_from_huggingface(
                info["repo_id"],
                output_dir,
                language=language,
                config=info.get("config"),
                split=split,
                streaming=(max_samples is not None),
                max_samples=max_samples,
            )

    elif info["source"] == "huggingface_accent":
        # Use dataset-level split override if defined (e.g. common_voice_indian needs "train")
        effective_split = info.get("split", split)
        return download_common_voice_accent(
            repo_id=info["repo_id"],
            config=info["config"],
            accent_filter=info["accent_filter"],
            output_dir=output_dir,
            split=effective_split,
            max_samples=max_samples or 500,
        )

    raise ValueError(f"Unknown source: {info['source']}")


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Download datasets for STT/TTS training (English customer-care + Indic)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
INDIAN ACCENT DATASETS:
    # BEST — AI4Bharat Svarah, 9.6 h, 117 speakers, 65 Indian districts (HF login)
    python download_datasets.py --dataset svarah --output data/raw

    # Hindi-English telephone code-switched speech, ~90 h, NO login needed
    python download_datasets.py --dataset openslr_codeswitched --output data/raw

    # Common Voice English filtered to Indian-accent speakers (HF login, slow scan)
    python download_datasets.py --dataset common_voice_indian --output data/raw --max-samples 300

    # Download all Indian accent datasets at once
    python download_datasets.py --dataset indian_accent_all --output data/raw

ENGLISH CUSTOMER-CARE DATASETS (no --lang needed):
    # Quick start: LibriSpeech test sets + MUSAN noise (~700 MB)
    python download_datasets.py --dataset customer_care_all --output data/raw

    # LibriSpeech test-clean only (346 MB, no login)
    python download_datasets.py --dataset librispeech_test --output data/raw

    # LibriSpeech test-other — harder/accented English (328 MB)
    python download_datasets.py --dataset librispeech_test_other --output data/raw

    # MUSAN noise dataset for audio augmentation (10 GB)
    python download_datasets.py --dataset musan --output data/raw

    # Common Voice English — multi-accent (500 samples, streaming)
    python download_datasets.py --dataset common_voice --lang en --output data/raw --max-samples 500

    # TED-LIUM 3 — lecture speech (50 GB, large download)
    python download_datasets.py --dataset ted_lium --output data/raw

INDIC DATASETS:
    # IndicTTS Hindi
    python download_datasets.py --dataset indicTTS --lang hi --output data/raw

    # Shrutilipi Tamil STT
    python download_datasets.py --dataset shrutilipi --lang ta --output data/raw

    # Common Voice Hindi (1000 samples)
    python download_datasets.py --dataset common_voice --lang hi --output data/raw --max-samples 1000

OTHER:
    # List all available datasets
    python download_datasets.py --list

    # List STT datasets only
    python download_datasets.py --list-type stt
        """,
    )
    parser.add_argument("--list", action="store_true", help="List all available datasets")
    parser.add_argument("--list-type", choices=["tts", "stt", "noise"], help="Filter list by type")
    parser.add_argument("--dataset", type=str, help="Dataset name to download")
    parser.add_argument(
        "--lang", type=str, default="en",
        help="Language code: en, hi, ta, te, bn, mr, gu, pa, ur (default: en)",
    )
    parser.add_argument("--output", type=str, default="data/raw", help="Output directory (default: data/raw)")
    parser.add_argument("--split", type=str, default="test", help="Dataset split: train/validation/test (default: test)")
    parser.add_argument(
        "--max-samples", type=int, default=None,
        help="Max samples for HuggingFace streaming downloads",
    )

    args = parser.parse_args()

    if args.list or args.list_type:
        list_datasets(args.list_type)
        return

    if not args.dataset:
        parser.print_help()
        return

    output_dir = Path(args.output)

    try:
        result_path = download_dataset(
            args.dataset,
            args.lang,
            output_dir,
            args.split,
            args.max_samples,
        )
        print(f"\nDownloaded successfully -> {result_path}")
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise


if __name__ == "__main__":
    main()
