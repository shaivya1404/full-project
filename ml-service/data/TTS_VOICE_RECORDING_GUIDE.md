# TTS Voice Recording Guide

## You Only Need 30 Seconds of Audio!

XTTS v2 uses **voice cloning** - you don't need hours of data. Just one clean 30-second recording.

---

## Recording Requirements

| Requirement | Specification |
|-------------|---------------|
| **Duration** | 30 seconds (minimum 10 seconds) |
| **Format** | WAV or MP3 |
| **Quality** | Clear, no background noise |
| **Content** | Any natural speech |

---

## How to Record (3 Options)

### Option 1: Phone Recording (Easiest)
1. Go to a quiet room
2. Use Voice Recorder app on your phone
3. Hold phone 15-20 cm from mouth
4. Read the script below naturally
5. Save and transfer to computer

### Option 2: Computer Recording
1. Use free software: Audacity (https://www.audacityteam.org/)
2. Settings: 22050 Hz or 44100 Hz, Mono, 16-bit
3. Use any microphone (even laptop mic in quiet room)
4. Record the script below

### Option 3: Online Recording
1. Go to: https://online-voice-recorder.com/
2. Allow microphone access
3. Record and download

---

## Recording Script (Read This)

### English Version (30 seconds):
```
Hello, my name is [YOUR NAME]. I am recording this sample for voice synthesis.
The weather today is quite pleasant, and I hope you are having a wonderful day.
Please feel free to ask me any questions. I would be happy to help you with
whatever you need. Thank you for listening to this recording.
```

### Hindi Version (30 seconds):
```
नमस्ते, मेरा नाम [आपका नाम] है। मैं यह रिकॉर्डिंग आवाज़ संश्लेषण के लिए कर रहा हूं।
आज का मौसम काफी अच्छा है, और मुझे आशा है कि आपका दिन अच्छा जा रहा है।
कृपया मुझसे कोई भी सवाल पूछें। मुझे आपकी मदद करने में खुशी होगी।
इस रिकॉर्डिंग को सुनने के लिए धन्यवाद।
```

### Mixed Hindi-English (30 seconds):
```
Hello, मेरा नाम [आपका नाम] है। I am recording this for voice synthesis.
आज weather काफी pleasant है। I hope आपका दिन अच्छा जा रहा है।
Please feel free to ask me any questions. मुझे आपकी help करने में खुशी होगी।
Thank you for listening. धन्यवाद।
```

---

## Recording Tips

✅ **DO:**
- Record in quiet room (no AC, fan, TV)
- Speak naturally (not too fast, not too slow)
- Keep consistent distance from mic
- Record in one take if possible

❌ **DON'T:**
- Don't whisper or shout
- Don't record near windows (traffic noise)
- Don't eat or drink while recording
- Don't clear throat in the middle

---

## After Recording

1. Save file as: `reference_voice.wav`
2. Put it in: `data/tts/reference/`
3. That's it! The model will clone this voice.

---

## File Location

```
tts-stt/
└── data/
    └── tts/
        └── reference/
            └── reference_voice.wav   <-- Put your 30-sec recording here
```

---

## Testing Your Recording

Run this to check quality:
```bash
python ml-service/data/audio_validator.py --file data/tts/reference/reference_voice.wav
```

Good recording will show:
- Duration: 10-60 seconds ✓
- SNR: > 20 dB ✓
- Clipping: None ✓
- Silence ratio: < 30% ✓
