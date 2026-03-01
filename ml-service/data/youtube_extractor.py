#!/usr/bin/env python3
"""YouTube/Movie Audio Extractor for STT Training Data.

Extracts clean speech segments from YouTube videos and movies.

Pipeline:
1. Download video/audio (yt-dlp)
2. Extract audio track
3. Apply noise reduction (DeepFilterNet)
4. Detect speech segments (Silero VAD)
5. Extract subtitles/transcripts
6. Create training manifest

Usage:
    # Single YouTube video
    python youtube_extractor.py --url "https://youtube.com/watch?v=xxx" --output data/stt

    # YouTube playlist
    python youtube_extractor.py --playlist "https://youtube.com/playlist?list=xxx" --output data/stt

    # Local movie file
    python youtube_extractor.py --file movie.mp4 --output data/stt

    # Batch from URL list
    python youtube_extractor.py --url-list urls.txt --output data/stt
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from loguru import logger

try:
    import soundfile as sf
except ImportError:
    sf = None
    logger.warning("soundfile not installed. Run: pip install soundfile")

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("torch not installed. Run: pip install torch")


@dataclass
class SpeechSegment:
    """A detected speech segment."""
    start_time: float  # seconds
    end_time: float    # seconds
    text: Optional[str] = None
    confidence: float = 1.0


@dataclass
class ExtractedSample:
    """An extracted audio sample with transcript."""
    audio_path: str
    text: str
    language: str
    duration: float
    source: str
    speaker_id: str = "unknown"


class YouTubeExtractor:
    """Extract clean speech from YouTube videos for STT training."""

    def __init__(
        self,
        output_dir: Path,
        language: str = "hi",
        min_duration: float = 1.0,
        max_duration: float = 30.0,
        sample_rate: int = 16000,
        apply_noise_reduction: bool = True,
    ):
        """Initialize extractor.

        Args:
            output_dir: Directory to save extracted audio
            language: Target language code (hi, en)
            min_duration: Minimum segment duration in seconds
            max_duration: Maximum segment duration in seconds
            sample_rate: Target sample rate for audio
            apply_noise_reduction: Whether to apply DeepFilterNet
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.language = language
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.sample_rate = sample_rate
        self.apply_noise_reduction = apply_noise_reduction

        # Create subdirectories
        self.audio_dir = self.output_dir / "audio"
        self.audio_dir.mkdir(exist_ok=True)

        # Load models lazily
        self._vad_model = None
        self._vad_utils = None
        self._denoiser = None

    def _get_vad_model(self):
        """Load Silero VAD model."""
        if self._vad_model is None:
            if not TORCH_AVAILABLE:
                raise RuntimeError("torch required for VAD")

            logger.info("Loading Silero VAD model...")
            self._vad_model, self._vad_utils = torch.hub.load(
                repo_or_dir='snakers4/silero-vad',
                model='silero_vad',
                force_reload=False,
                trust_repo=True,
            )
        return self._vad_model, self._vad_utils

    def _get_denoiser(self):
        """Load DeepFilterNet denoiser."""
        if self._denoiser is None and self.apply_noise_reduction:
            try:
                from df.enhance import enhance, init_df
                self._denoiser = init_df()
                logger.info("DeepFilterNet loaded")
            except ImportError:
                logger.warning("DeepFilterNet not available. Skipping noise reduction.")
                self.apply_noise_reduction = False
        return self._denoiser

    def download_youtube(
        self,
        url: str,
        output_path: Optional[Path] = None,
    ) -> Tuple[Path, Optional[Path]]:
        """Download YouTube video audio and subtitles.

        Args:
            url: YouTube URL
            output_path: Optional output path

        Returns:
            Tuple of (audio_path, subtitle_path or None)
        """
        if output_path is None:
            output_path = self.output_dir / "raw"
        output_path.mkdir(parents=True, exist_ok=True)

        # Check if yt-dlp is installed
        try:
            subprocess.run(["yt-dlp", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise RuntimeError("yt-dlp not installed. Run: pip install yt-dlp")

        logger.info(f"Downloading: {url}")

        # Download audio
        audio_template = str(output_path / "%(id)s.%(ext)s")
        cmd_audio = [
            "yt-dlp",
            "-x",  # Extract audio
            "--audio-format", "wav",
            "--audio-quality", "0",
            "-o", audio_template,
            "--no-playlist",  # Single video only
            url,
        ]

        result = subprocess.run(cmd_audio, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"yt-dlp error: {result.stderr}")
            raise RuntimeError(f"Failed to download: {url}")

        # Find downloaded audio file
        audio_files = list(output_path.glob("*.wav"))
        if not audio_files:
            raise RuntimeError("No audio file found after download")
        audio_path = audio_files[-1]  # Most recent

        # Download subtitles
        sub_template = str(output_path / "%(id)s.%(ext)s")
        cmd_subs = [
            "yt-dlp",
            "--write-auto-sub",
            "--sub-lang", f"{self.language},en",
            "--sub-format", "srt",
            "--skip-download",
            "-o", sub_template,
            "--no-playlist",
            url,
        ]

        subprocess.run(cmd_subs, capture_output=True, text=True)

        # Find subtitle file
        sub_files = list(output_path.glob("*.srt")) + list(output_path.glob("*.vtt"))
        sub_path = sub_files[-1] if sub_files else None

        logger.info(f"Downloaded audio: {audio_path}")
        if sub_path:
            logger.info(f"Downloaded subtitles: {sub_path}")

        return audio_path, sub_path

    def extract_audio_from_file(self, video_path: Path) -> Path:
        """Extract audio from local video file.

        Args:
            video_path: Path to video file

        Returns:
            Path to extracted audio
        """
        output_path = self.output_dir / "raw" / f"{video_path.stem}.wav"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-vn",  # No video
            "-acodec", "pcm_s16le",
            "-ar", str(self.sample_rate),
            "-ac", "1",  # Mono
            str(output_path),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg error: {result.stderr}")

        return output_path

    def apply_denoising(self, audio: np.ndarray) -> np.ndarray:
        """Apply noise reduction to audio.

        Args:
            audio: Audio array

        Returns:
            Denoised audio
        """
        if not self.apply_noise_reduction:
            return audio

        denoiser = self._get_denoiser()
        if denoiser is None:
            return audio

        try:
            from df.enhance import enhance
            model, df_state, _ = denoiser

            # DeepFilterNet expects specific format
            audio_tensor = torch.from_numpy(audio).float().unsqueeze(0)
            enhanced = enhance(model, df_state, audio_tensor)
            return enhanced.squeeze().numpy()
        except Exception as e:
            logger.warning(f"Denoising failed: {e}")
            return audio

    def detect_speech_segments(
        self,
        audio: np.ndarray,
        sample_rate: int = 16000,
    ) -> List[SpeechSegment]:
        """Detect speech segments using Silero VAD.

        Args:
            audio: Audio array
            sample_rate: Sample rate

        Returns:
            List of speech segments
        """
        model, utils = self._get_vad_model()
        get_speech_timestamps = utils[0]

        # Convert to tensor
        audio_tensor = torch.from_numpy(audio).float()

        # Get speech timestamps
        speech_timestamps = get_speech_timestamps(
            audio_tensor,
            model,
            sampling_rate=sample_rate,
            min_speech_duration_ms=int(self.min_duration * 1000),
            max_speech_duration_s=self.max_duration,
            min_silence_duration_ms=300,
            speech_pad_ms=100,
        )

        segments = []
        for ts in speech_timestamps:
            start = ts['start'] / sample_rate
            end = ts['end'] / sample_rate
            duration = end - start

            if self.min_duration <= duration <= self.max_duration:
                segments.append(SpeechSegment(start_time=start, end_time=end))

        logger.info(f"Detected {len(segments)} speech segments")
        return segments

    def parse_srt(self, srt_path: Path) -> List[SpeechSegment]:
        """Parse SRT subtitle file.

        Args:
            srt_path: Path to SRT file

        Returns:
            List of segments with text
        """
        segments = []

        with open(srt_path, "r", encoding="utf-8") as f:
            content = f.read()

        # SRT format: index, timestamp, text, blank line
        pattern = r'(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n(.+?)(?=\n\n|\Z)'
        matches = re.findall(pattern, content, re.DOTALL)

        for match in matches:
            _, start_str, end_str, text = match

            # Parse timestamp
            def parse_time(ts: str) -> float:
                h, m, s = ts.replace(',', '.').split(':')
                return int(h) * 3600 + int(m) * 60 + float(s)

            start = parse_time(start_str)
            end = parse_time(end_str)

            # Clean text
            text = re.sub(r'<[^>]+>', '', text)  # Remove HTML tags
            text = text.replace('\n', ' ').strip()

            if text and (end - start) >= self.min_duration:
                segments.append(SpeechSegment(
                    start_time=start,
                    end_time=end,
                    text=text,
                ))

        logger.info(f"Parsed {len(segments)} subtitle segments")
        return segments

    def extract_segments(
        self,
        audio_path: Path,
        segments: List[SpeechSegment],
        source_name: str,
    ) -> List[ExtractedSample]:
        """Extract audio segments and save them.

        Args:
            audio_path: Path to full audio file
            segments: List of segments to extract
            source_name: Source identifier

        Returns:
            List of extracted samples
        """
        if sf is None:
            raise RuntimeError("soundfile required")

        # Load full audio
        audio, sr = sf.read(audio_path, dtype='float32')

        # Resample if needed
        if sr != self.sample_rate:
            try:
                import librosa
                audio = librosa.resample(audio, orig_sr=sr, target_sr=self.sample_rate)
                sr = self.sample_rate
            except ImportError:
                logger.warning("librosa not available for resampling")

        # Convert to mono
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        # Apply denoising to full audio once
        logger.info("Applying noise reduction...")
        audio = self.apply_denoising(audio)

        samples = []
        for idx, seg in enumerate(segments):
            # Extract segment
            start_sample = int(seg.start_time * sr)
            end_sample = int(seg.end_time * sr)
            segment_audio = audio[start_sample:end_sample]

            # Skip if too short after extraction
            duration = len(segment_audio) / sr
            if duration < self.min_duration:
                continue

            # Save segment
            filename = f"{source_name}_{idx:04d}.wav"
            output_path = self.audio_dir / filename
            sf.write(output_path, segment_audio, sr)

            samples.append(ExtractedSample(
                audio_path=str(output_path.relative_to(self.output_dir)),
                text=seg.text or "",  # Empty if no transcript
                language=self.language,
                duration=duration,
                source=source_name,
            ))

        logger.info(f"Extracted {len(samples)} segments")
        return samples

    def process_youtube_url(self, url: str) -> List[ExtractedSample]:
        """Process a single YouTube URL.

        Args:
            url: YouTube URL

        Returns:
            List of extracted samples
        """
        # Download
        audio_path, sub_path = self.download_youtube(url)

        # Get source name from URL
        video_id = re.search(r'(?:v=|/)([a-zA-Z0-9_-]{11})', url)
        source_name = video_id.group(1) if video_id else audio_path.stem

        # Load audio for VAD
        audio, sr = sf.read(audio_path, dtype='float32')
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        # Get segments from subtitles or VAD
        if sub_path:
            segments = self.parse_srt(sub_path)
        else:
            logger.info("No subtitles found, using VAD...")
            segments = self.detect_speech_segments(audio, sr)

        # Extract segments
        samples = self.extract_segments(audio_path, segments, source_name)

        return samples

    def process_local_file(
        self,
        video_path: Path,
        subtitle_path: Optional[Path] = None,
    ) -> List[ExtractedSample]:
        """Process a local video/audio file.

        Args:
            video_path: Path to video/audio file
            subtitle_path: Optional path to subtitle file

        Returns:
            List of extracted samples
        """
        # Extract audio if video
        if video_path.suffix.lower() in ['.mp4', '.mkv', '.avi', '.mov', '.webm']:
            audio_path = self.extract_audio_from_file(video_path)
        else:
            audio_path = video_path

        source_name = video_path.stem

        # Load audio
        audio, sr = sf.read(audio_path, dtype='float32')
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        # Get segments
        if subtitle_path and subtitle_path.exists():
            segments = self.parse_srt(subtitle_path)
        else:
            segments = self.detect_speech_segments(audio, sr)

        # Extract
        samples = self.extract_segments(audio_path, segments, source_name)

        return samples

    def save_manifest(self, samples: List[ExtractedSample], manifest_name: str = "manifest.jsonl"):
        """Save samples to JSONL manifest.

        Args:
            samples: List of extracted samples
            manifest_name: Output filename
        """
        manifest_path = self.output_dir / manifest_name

        with open(manifest_path, "w", encoding="utf-8") as f:
            for sample in samples:
                line = json.dumps({
                    "audio_filepath": sample.audio_path,
                    "text": sample.text,
                    "language": sample.language,
                    "duration": sample.duration,
                    "source": sample.source,
                }, ensure_ascii=False)
                f.write(line + "\n")

        logger.info(f"Manifest saved: {manifest_path} ({len(samples)} samples)")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract speech from YouTube/movies for STT training",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Single YouTube video (Hindi)
    python youtube_extractor.py --url "https://youtube.com/watch?v=xxx" --output data/stt --lang hi

    # YouTube playlist
    python youtube_extractor.py --playlist "https://youtube.com/playlist?list=xxx" --output data/stt

    # Local movie file
    python youtube_extractor.py --file movie.mp4 --subtitle movie.srt --output data/stt

    # Multiple URLs from file (one per line)
    python youtube_extractor.py --url-list urls.txt --output data/stt
        """,
    )

    # Input options (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--url", type=str, help="Single YouTube URL")
    input_group.add_argument("--playlist", type=str, help="YouTube playlist URL")
    input_group.add_argument("--file", type=str, help="Local video/audio file")
    input_group.add_argument("--url-list", type=str, help="File with URLs (one per line)")

    # Options
    parser.add_argument("--output", type=str, required=True, help="Output directory")
    parser.add_argument("--lang", type=str, default="hi", help="Language code (hi, en)")
    parser.add_argument("--subtitle", type=str, help="Subtitle file for local video")
    parser.add_argument("--min-duration", type=float, default=1.0, help="Min segment duration (seconds)")
    parser.add_argument("--max-duration", type=float, default=30.0, help="Max segment duration (seconds)")
    parser.add_argument("--no-denoise", action="store_true", help="Skip noise reduction")

    args = parser.parse_args()

    # Initialize extractor
    extractor = YouTubeExtractor(
        output_dir=Path(args.output),
        language=args.lang,
        min_duration=args.min_duration,
        max_duration=args.max_duration,
        apply_noise_reduction=not args.no_denoise,
    )

    all_samples = []

    # Process based on input type
    if args.url:
        samples = extractor.process_youtube_url(args.url)
        all_samples.extend(samples)

    elif args.playlist:
        # Get video URLs from playlist
        cmd = ["yt-dlp", "--flat-playlist", "--print", "url", args.playlist]
        result = subprocess.run(cmd, capture_output=True, text=True)
        urls = result.stdout.strip().split("\n")

        for url in urls:
            if url.strip():
                try:
                    samples = extractor.process_youtube_url(url.strip())
                    all_samples.extend(samples)
                except Exception as e:
                    logger.error(f"Failed to process {url}: {e}")

    elif args.file:
        subtitle_path = Path(args.subtitle) if args.subtitle else None
        samples = extractor.process_local_file(Path(args.file), subtitle_path)
        all_samples.extend(samples)

    elif args.url_list:
        with open(args.url_list, "r") as f:
            urls = [line.strip() for line in f if line.strip()]

        for url in urls:
            try:
                samples = extractor.process_youtube_url(url)
                all_samples.extend(samples)
            except Exception as e:
                logger.error(f"Failed to process {url}: {e}")

    # Save manifest
    if all_samples:
        extractor.save_manifest(all_samples)
        print(f"\nExtracted {len(all_samples)} samples to {args.output}")
        print(f"Total duration: {sum(s.duration for s in all_samples) / 3600:.2f} hours")
    else:
        print("No samples extracted")


if __name__ == "__main__":
    main()
