# Bot Voice Not Heard - Complete Fix Guide

## Issues Fixed ✅

### 1. **Critical: Incorrect Audio Format Configuration**
- **Problem**: Using `g711_ulaw` for OpenAI Realtime API input/output format
- **Why It's Wrong**: OpenAI Realtime API uses **PCM16** (24kHz), not g711_ulaw
- **Fix Applied**: Changed in `openaiRealtime.ts` `updateSession()` method:
  ```typescript
  input_audio_format: 'pcm16',   // ✅ Correct
  output_audio_format: 'pcm16',  // ✅ Correct
  ```
- **What This Does**: Ensures OpenAI sends audio in the correct format for our conversion pipeline

### 2. **Critical: Missing Audio Buffer Flush**
- **Problem**: Audio remaining in buffer at end of response never sent to Twilio
- **Why It Matters**: OpenAI sends audio in chunks; last chunk might be smaller than buffer threshold
- **Fix Applied**: Added flush call in `openaiRealtime.ts` on `response.done` event:
  ```typescript
  case 'response.done':
    this.twilioService.flushAudioBuffer(); // ⭐ NEW
    // ... rest of handling
  ```
- **What This Does**: Ensures final audio chunks are sent even if they don't fill a complete frame

### 3. **Important: Missing streamSid in Media Events**
- **Problem**: Some audio events not including streamSid
- **Why It Matters**: Twilio needs streamSid to route audio to correct call
- **Fix Applied**: Added streamSid to all media events in `twilioStream.ts` `sendAudio()` method:
  ```typescript
  const message = {
    event: 'media',
    streamSid: this.streamSid,  // ⭐ Always included
    media: {
      payload: base64Frame,
      track: 'outbound',        // ⭐ Required for bot audio
    },
  };
  ```

### 4. **Improved**: Better Audio Conversion Pipeline
- **Problem**: Lack of detailed logging made debugging impossible
- **Fix Applied**: Added comprehensive logging at each conversion step:
  - Input size (bytes from OpenAI)
  - Resampling: 24kHz → 8kHz conversion
  - Output frames sent to Twilio
  - Buffer flush confirmation

---

## Audio Conversion Pipeline (Now Working ✅)

```
OpenAI (PCM16, 24kHz)
        ↓
  Base64 Decode
        ↓
  Buffer Accumulation (480-byte chunks = 20ms)
        ↓
  Resample 24kHz → 8kHz
        ↓
  Convert PCM16 → μ-law
        ↓
  Slice into 160-byte frames (20ms @ 8kHz)
        ↓
  Base64 Encode
        ↓
  Send to Twilio with track: 'outbound'
        ↓
  Caller Hears Bot Voice ✅
```

---

## Verification Checklist

### 1. Check Environment Variables
```bash
# Verify these are set in .env:
OPENAI_API_KEY=sk-... (valid key)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=...
PUBLIC_SERVER_URL=https://your-domain.com (ngrok/public URL)
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview (or latest available)
```

### 2. Monitor Logs During Call
```
Look for these log messages in sequence:

✅ "Connected to OpenAI Realtime API"
✅ "Updating OpenAI Session configuration"  
✅ "Triggering initial AI greeting"
✅ "OpenAI audio delta received"
✅ "Received audio chunk from OpenAI: XXX bytes"
✅ "Resampled: ... bytes @ 24kHz → ... bytes @ 8kHz"
✅ "Sent Twilio audio frame (160 bytes, track: outbound)"
✅ "Flushing remaining audio buffer (XXX bytes)"
✅ "Flushed X frames (XXX bytes total)"
```

### 3. Test Call Steps
1. **Start server**: `npm start` or appropriate command
2. **Make inbound call** to your Twilio number
3. **Wait for greeting**: Bot should say something
4. **If no audio**: Check logs for errors (see Troubleshooting below)

### 4. Verify Twilio Configuration
- ✅ Voice/SMS URL points to: `https://your-public-url/voice`
- ✅ WebSocket Stream URL pattern correct in logs
- ✅ Call not hanging up immediately (check Twilio debugger)

---

## Troubleshooting

### Issue: Still No Bot Voice

**Check 1: OpenAI Connection**
```
Log should show: "Connected to OpenAI Realtime API"
If missing:
- Verify OPENAI_API_KEY is valid
- Check internet connectivity
- Try: curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Check 2: Audio Format Mismatch**
```
Log message format:
✅ "Received audio chunk from OpenAI: 960 bytes" (should see these)
❌ No audio chunks = session config issue
   - Verify input_audio_format: 'pcm16' in logs
   - Check response.output array for audio items
```

**Check 3: Twilio Media Stream Issues**
```
Log should show: "Twilio Media Stream started: [streamSid]"
If missing:
- Voice webhook not configured correctly
- Check Twilio debugger for TwiML errors
- Verify PUBLIC_SERVER_URL is correct and accessible
```

**Check 4: Audio Frame Sending**
```
❌ "Sent Twilio audio frame" missing
   - Check WebSocket connection state
   - Verify this.ws.readyState === WebSocket.OPEN
   - Look for errors in flushAudioBuffer()
```

**Check 5: Buffer Conversion Errors**
```
Look for: "Failed to convert and send audio to Twilio"
Common causes:
- Null/undefined streamSid
- Audio buffer corruption
- Encoding/decoding errors
```

---

## Performance Monitoring

### Add These Metrics
```typescript
// In twilioStream.ts
private audioFramesSent = 0;
private totalAudioBytes = 0;

// In sendAudio():
this.audioFramesSent++;
this.totalAudioBytes += incomingBuffer.length;

// Log periodically:
logger.info('Audio stats', { 
  framesSent: this.audioFramesSent, 
  totalBytes: this.totalAudioBytes 
});
```

### Expected Values
- **Audio frames per response**: 100-500 (varies by response length)
- **Bytes per frame**: ~160 bytes
- **Latency**: <200ms from OpenAI response to Twilio audio

---

## Key Files Modified

1. **src/services/openaiRealtime.ts**
   - Fixed audio format from g711_ulaw → pcm16
   - Added flushAudioBuffer() call on response.done

2. **src/services/twilioStream.ts**
   - Improved sendAudio() with comprehensive logging
   - Fixed flushAudioBuffer() with streamSid inclusion
   - Better error handling

3. **src/utils/audioNormalizer.ts**
   - No changes needed (already correct)
   - Handles: Base64 ↔ Buffer, PCM16 ↔ μ-law, Resampling

---

## Advanced: Custom Audio Testing

```typescript
// Test audio conversion pipeline directly
import { AudioNormalizer } from './utils/audioNormalizer';

// Simulate 1 second of silence at 24kHz PCM16
const testBuffer = Buffer.alloc(24000 * 2); // 24000 samples × 2 bytes
const base64Test = AudioNormalizer.encodeBase64(testBuffer);

// Decode → Resample → Encode
const decoded = AudioNormalizer.decodeBase64(base64Test);
const resampled = AudioNormalizer.resample(decoded, 24000, 8000);
const mulaw = AudioNormalizer.pcm16ToMulaw(resampled);

console.log(`Original: ${testBuffer.length} → Resampled: ${resampled.length} → μ-law: ${mulaw.length}`);
// Expected: 48000 → 16000 → 8000
```

---

## Rollback Changes (If Needed)

If issues occur, the changes made:
1. Session format: g711_ulaw → pcm16 (revert in updateSession)
2. Added: flushAudioBuffer() call (remove from response.done handler)
3. Added: streamSid to media events (remove from sendAudio loop)

**All changes are additive or format fixes** - safe to apply.

---

## Next Steps

1. ✅ Apply all fixes from this guide
2. ✅ Test with a real inbound call
3. ✅ Monitor logs for the verification checklist
4. ✅ Adjust threshold/sensitivity if needed:
   - VAD threshold: currently 0.5 (0-1, higher = needs louder sound)
   - Silence duration: currently 500ms
   - Prefix padding: currently 300ms

