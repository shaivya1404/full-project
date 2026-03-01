# TTS & STT Project - Master Context File

> **Purpose**: This file captures all project context so you can continue anytime.
> **Last Updated**: 2026-02-25

---

## Project Goal

Build production-quality **Text-to-Speech (TTS)** and **Speech-to-Text (STT)** for:
- **Languages**: English + Hindi
- **Voice Quality**: Human-like (NOT robotic)
- **Differentiator**: Custom dataset (not public data like college projects)

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| **STT Model** | ✅ TRAINED | Whisper Small + LoRA, Loss: 1.59 -> 0.97 |
| **STT Datasets** | ✅ DOWNLOADED | ~40,000 files, 18 GB, full pipeline ready |
| **STT Evaluation** | ⏳ Pending | eval script ready, model needs to be run |
| **TTS Dataset** | ⏳ Pending | Need 30-sec reference voice recording |
| **TTS Model** | ⏳ Ready to start | XTTS v2 voice cloning |
| **Deployment** | ⏳ Pending | Docker configs exist |

---

## STT - Completed Work

### Model Training (Kaggle, Feb 2026)
| Metric | Value |
|--------|-------|
| Base Model | Whisper Small |
| Method | LoRA Fine-tuning |
| Training Loss Start | 1.594 |
| Training Loss End | 0.971 |
| Improvement | 39% |
| Training Time | 24 minutes |
| Platform | Kaggle P100 GPU |
| Cost | $0 (Free) |

### STT Model Usage
```python
from peft import PeftModel
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import librosa, torch

# Load model
base = WhisperForConditionalGeneration.from_pretrained("openai/whisper-small")
model = PeftModel.from_pretrained(base, "./whisper-stt-finetuned")
processor = WhisperProcessor.from_pretrained("./whisper-stt-finetuned")

# Transcribe
audio, sr = librosa.load("audio.wav", sr=16000)
inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
with torch.no_grad():
    ids = model.generate(inputs.input_features, max_length=225)
text = processor.batch_decode(ids, skip_special_tokens=True)[0]
print(text)
```

---

## STT Datasets - Fully Downloaded (Feb 2026)

All stored in: `data/raw/`

### English Datasets (No login required)

| Dataset | Folder | Files | Size | Purpose |
|---------|--------|-------|------|---------|
| LibriSpeech test-clean | `data/raw/test-clean/` | 2,620 flac | 358 MB | Testing - clean English |
| LibriSpeech test-other | `data/raw/test-other/` | 2,939 flac | 344 MB | Testing - harder English |
| LibriSpeech dev-clean | `data/raw/dev-clean/` | ~2,700 flac | 350 MB | Validation - clean |
| LibriSpeech dev-other | `data/raw/dev-other/` | ~2,900 flac | 330 MB | Validation - harder |
| LibriSpeech train-clean-100 | `data/raw/train-clean-100/` | 28,539 flac | 6.3 GB | Training - 100h clean |

### Indian Accent Datasets (No login required)

| Dataset | Folder | Files | Size | Purpose |
|---------|--------|-------|------|---------|
| OpenSLR-104 Hindi-English | `data/raw/openslr_codeswitched/` | 551 wav | 11 GB | Indian accent train+test |

### Datasets Needing HF Login (Not yet downloaded)

| Dataset | Command | Size | Notes |
|---------|---------|------|-------|
| AI4Bharat Svarah | `--dataset svarah` | 950 MB | Best Indian English, 9.6h, 117 speakers |
| Common Voice Indian | `--dataset common_voice_indian` | 300 MB | India-accent filtered English |
| Common Voice Hindi | `--dataset common_voice --language hi` | varies | Hindi STT |
| FLEURS | `--dataset fleurs --language hi` | varies | Hindi + English high quality |
| Shrutilipi | `--dataset shrutilipi --language hi` | large | 6400+ hours Hindi STT |

To unlock HF datasets:
```bash
huggingface-cli login
# Accept dataset terms at HuggingFace website
# Then re-run the download command
```

### Total Dataset Stats
- **Total files**: ~40,000 audio files
- **Total size**: ~18 GB on disk
- **Coverage**: Clean English + Hard English + Indian accent English
- **Splits**: train / dev / test all available

---

## Download Script - `ml-service/data/download_datasets.py`

### How to Use
```bash
# List all available datasets
python ml-service/data/download_datasets.py --list

# Download a specific dataset
python ml-service/data/download_datasets.py --dataset librispeech_test --output data/raw

# Download Indian accent bundle (no login needed part runs, login-needed part skips)
python ml-service/data/download_datasets.py --dataset indian_accent_all --output data/raw

# Download with max samples (HF datasets only)
python ml-service/data/download_datasets.py --dataset common_voice --language hi --max-samples 500 --output data/raw
```

### Available Datasets (No Login)
| Name | Description |
|------|-------------|
| `librispeech_test` | 5h clean English test |
| `librispeech_test_other` | 5h harder English test |
| `librispeech_dev_clean` | validation clean English |
| `librispeech_dev_other` | validation harder English |
| `librispeech_train_100` | 100h clean English training |
| `librispeech_train_360` | 360h clean English training (large) |
| `openslr_codeswitched` | Hindi-English Indian accent (7.3GB train + 443MB test) |
| `openslr_codeswitched_test` | Indian accent test only (443MB) |
| `musan` | Noise augmentation data |
| `ted_lium` | 450h TED talks (very large, 50GB) |

### Available Datasets (HF Login Required)
| Name | Description |
|------|-------------|
| `svarah` | Indian English 9.6h (BEST Indian accent) |
| `common_voice_indian` | Common Voice filtered India accent |
| `common_voice` | Multi-language: en, hi, ta, te, bn, mr, gu, pa, ur |
| `fleurs` | Google FLEURS multilingual high quality |
| `shrutilipi` | 6400+ hours Hindi STT (BEST for Hindi) |
| `indic_superb` | 3000+ hours Indic languages benchmark |
| `voxpopuli` | European-accented English |

### Edge Cases Handled (Feb 2026 improvements)
- **Disk space check**: Fails early with clear message if not enough space (2.5x buffer)
- **Corrupted archive detection**: Auto-detects and re-downloads corrupted files
- **Partial download safety**: Downloads to `.tmp` file, renames only on success
- **Retry logic**: Auto-retries up to 3 times on network failure
- **Clean progress**: Prints every 5% (e.g., `5% 300 MB / 6091 MB`)
- **Gated dataset handling**: Skips HF-gated datasets gracefully with login instructions
- **tar filter**: No DeprecationWarning on Python 3.12+

---

## STT Evaluation Script - `ml-service/evaluation/stt_eval.py`

### How to Run
```bash
python ml-service/evaluation/stt_eval.py \
  --model-path whisper-stt-finetuned/ \
  --test-set data/raw/test-clean/ \
  --output results/eval_clean.json \
  --device cuda
```

### Metrics
- **WER** (Word Error Rate) - target: < 15% clean, < 25% noisy
- **CER** (Character Error Rate) - target: < 10% clean, < 15% noisy
- **RTF** (Real-Time Factor) - processing speed

### Test Sets Available
| Test Set | Path | Type |
|----------|------|------|
| Clean English | `data/raw/test-clean/` | LibriSpeech |
| Hard English | `data/raw/test-other/` | LibriSpeech |
| Indian accent | `data/raw/openslr_codeswitched/test/` | OpenSLR-104 |

---

## TTS - Next Phase

### Approach: XTTS v2 Voice Cloning
- **No training required** - Just need 30-second reference audio
- XTTS v2 clones voice instantly
- Supports Hindi + English

### What You Need
| Item | Requirement |
|------|-------------|
| Reference Audio | 30 seconds of YOUR voice |
| Quality | Clear, no background noise |
| Format | WAV (preferred) or MP3 |
| Content | Natural speech (read a paragraph) |

### Sample Text to Record
> "Hello, my name is [your name]. I am recording this audio to create a text to speech model. This sample will be used as a reference for voice cloning. The quality of the generated speech depends on this recording, so I am speaking clearly and naturally. Thank you for listening to this demonstration."

### TTS Steps
1. **Record 30 seconds** of your voice reading the sample text
2. **Save as** `data/tts/reference/reference_voice.wav`
3. **Upload to Kaggle** as dataset `tts-reference-audio`
4. **Run notebook** `notebooks/kaggle_tts_xtts.ipynb`
5. **Generate speech** in your cloned voice!

### TTS Code (Quick Test)
```python
from TTS.api import TTS
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

# English
tts.tts_to_file(
    text="Hello, this is my cloned voice!",
    file_path="output.wav",
    speaker_wav="reference_voice.wav",
    language="en"
)

# Hindi
tts.tts_to_file(
    text="नमस्ते, यह मेरी क्लोन आवाज़ है!",
    file_path="output_hindi.wav",
    speaker_wav="reference_voice.wav",
    language="hi"
)
```

---

## File Structure

```
stt-tts/
├── PROJECT_CONTEXT.md              <- This file (READ FIRST)
├── TRAINING_REPORT.md              <- STT training details
├── GCP_GPU_GUIDE.md                <- Cloud GPU setup
├── data/
│   ├── raw/                        <- All downloaded datasets
│   │   ├── train-clean-100/        <- 28,539 flac, 6.3 GB (LibriSpeech training)
│   │   ├── test-clean/             <- 2,620 flac, 358 MB (LibriSpeech test)
│   │   ├── test-other/             <- 2,939 flac, 344 MB (LibriSpeech test hard)
│   │   ├── dev-clean/              <- ~2,700 flac, 350 MB (validation)
│   │   ├── dev-other/              <- ~2,900 flac, 330 MB (validation hard)
│   │   ├── openslr_codeswitched/   <- 551 wav, 11 GB (Indian accent)
│   │   │   ├── test/               <- Test split (30 wav files)
│   │   │   └── train/              <- Train split (521 wav files)
│   │   └── archives/               <- Downloaded tar.gz files
│   ├── stt/
│   │   ├── extracted/              <- Original collected audio segments
│   │   └── combined/               <- Training manifests
│   └── tts/
│       └── reference/              <- Put reference_voice.wav here
├── ml-service/
│   ├── data/
│   │   └── download_datasets.py    <- Dataset download script (UPDATED)
│   ├── evaluation/
│   │   └── stt_eval.py             <- WER/CER evaluation script
│   ├── training/
│   │   ├── stt/                    <- STT training scripts
│   │   └── tts/                    <- TTS training scripts
│   ├── stt-service/                <- STT inference service
│   └── tts-service/                <- TTS inference service
└── notebooks/
    ├── kaggle_stt_training_v2.ipynb  <- STT training notebook (TESTED)
    └── kaggle_tts_xtts.ipynb         <- TTS voice cloning notebook (READY)
```

---

## Next Steps (In Order)

### COMPLETED
- [x] Collect STT data (4+ hours custom)
- [x] Train STT model on Kaggle (Whisper Small + LoRA)
- [x] Create TTS notebook (XTTS v2)
- [x] Build dataset download script
- [x] Download English STT datasets (LibriSpeech full suite)
- [x] Download Indian accent dataset (OpenSLR-104, 11 GB)
- [x] Add edge case handling to download script

### IN PROGRESS / TODO (STT)
- [ ] **Evaluate STT model** on test-clean / test-other (WER/CER)
- [ ] **HF login** -> download svarah, Common Voice Hindi, FLEURS
- [ ] Fine-tune Whisper on Indian accent data (openslr_codeswitched)
- [ ] Fine-tune Whisper on train-clean-100 for better English accuracy

### IN PROGRESS / TODO (TTS)
- [ ] **Record 30-second reference audio** (YOUR VOICE)
- [ ] Upload to Kaggle as dataset
- [ ] Run TTS notebook
- [ ] Test voice cloning in English + Hindi

### TODO (Deployment)
- [ ] Build API endpoints (FastAPI)
- [ ] Docker deployment
- [ ] Production setup

---

## Resume Instructions

### To evaluate STT model:
> "Continue TTS-STT project. Read PROJECT_CONTEXT.md. I want to evaluate my STT model on the downloaded datasets."

### To download more data (HF login):
> "Continue TTS-STT project. Read PROJECT_CONTEXT.md. I want to download svarah and Common Voice datasets using HF login."

### To fine-tune on Indian accent:
> "Continue TTS-STT project. Read PROJECT_CONTEXT.md. I want to fine-tune Whisper on the Indian accent data in data/raw/openslr_codeswitched/"

### To work on TTS:
> "Continue TTS-STT project. Read PROJECT_CONTEXT.md. I want to work on TTS voice cloning."

### To deploy:
> "Continue TTS-STT project. Read PROJECT_CONTEXT.md. I want to deploy the STT and TTS services."

---

## Technical Notes

### STT
- **Model**: Whisper Small + LoRA adapters
- **Sample Rate**: 16kHz
- **Max Label Length**: 440 tokens
- **Training**: 3 epochs, batch size 8
- **Kaggle Tips**: Use `processing_class` not `tokenizer`, filter labels > 440 tokens

### TTS
- **Model**: XTTS v2 (Coqui TTS)
- **Sample Rate**: 22.05kHz
- **Reference Audio**: 10-30 seconds recommended
- **Languages**: en, hi (+ 15 more supported)

### Download Script Notes
- **Windows**: Use forward slashes or raw strings for paths
- **Disk space**: Script checks 2.5x required size before downloading
- **Archives kept**: .tar.gz files kept alongside extracted folders (can delete to save space)
- **HF gated datasets**: Need `huggingface-cli login` + accept terms on HF website

---

## Session Log

### 2026-02-25
- Downloaded LibriSpeech train-clean-100 (28,539 files, 6.3 GB)
- Downloaded LibriSpeech dev-clean + dev-other (validation sets)
- Added edge case handling to download script:
  - Disk space pre-check (2.5x buffer)
  - Archive integrity verification
  - Temp file download with rename on success
  - Auto-retry up to 3 times on failure
  - Fixed tar DeprecationWarning (filter='data')
- Added new datasets: librispeech_train_360, librispeech_dev_clean, librispeech_dev_other
- Fixed progress output: prints every 5% with MB values (was spamming every 0.1%)

### 2026-02-20 to 2026-02-24
- Downloaded OpenSLR-104 Hindi-English code-switched data (551 wav, 11 GB)
- Downloaded LibriSpeech test-clean (2,620 files, 358 MB)
- Downloaded LibriSpeech test-other (2,939 files, 344 MB)
- Fixed multiple download issues:
  - HTTP 404 on wrong OpenSLR dataset (OpenSLR-53 is Bengali, not Indian English)
  - HF gated dataset auth error handling (svarah needs login)
  - Common Voice Indian empty test split (fixed to use train split)
  - Windows Unicode encoding errors (replaced arrow/ellipsis with ASCII)
  - trust_remote_code deprecation removed

### 2026-02-02
- Completed STT model training on Kaggle
- Training loss: 1.59 -> 0.97 (39% improvement)
- Created TRAINING_REPORT.md with full documentation
- Created TTS notebook (kaggle_tts_xtts.ipynb)

### 2026-01-27
- Decided: STT first, TTS later
- Created extraction pipeline
- Extracted 1,334 audio segments (~4 hours)
- Combined manifests ready for training
