# Deployment Checklist - Bot Voice Fix

## Pre-Deployment Verification

### Environment Setup
- [ ] `.env` file has all required variables:
  - [ ] `OPENAI_API_KEY` - valid OpenAI key with Realtime API access
  - [ ] `TWILIO_ACCOUNT_SID` - Twilio account ID
  - [ ] `TWILIO_AUTH_TOKEN` - Twilio auth token
  - [ ] `PUBLIC_SERVER_URL` - HTTPS public URL (not localhost)
  - [ ] `OPENAI_REALTIME_MODEL` - set to `gpt-4o-realtime-preview` or latest
  - [ ] `PORT` - server port (default 3000)

### Code Changes Verification
- [ ] `src/services/openaiRealtime.ts`:
  - [ ] Line ~155: Added `this.twilioService.flushAudioBuffer();`
  - [ ] Line ~517: Changed to `input_audio_format: 'pcm16'`
  - [ ] Line ~517: Changed to `output_audio_format: 'pcm16'`

- [ ] `src/services/twilioStream.ts`:
  - [ ] Line ~122: sendAudio() includes proper conversion pipeline
  - [ ] Line ~122: All media events include `streamSid`
  - [ ] Line ~122: All media events include `track: 'outbound'`
  - [ ] Line ~170: flushAudioBuffer() method complete

### TypeScript Compilation
```bash
npm run build
# Should complete without errors
```
- [ ] Compilation succeeds
- [ ] No TypeScript errors in openaiRealtime.ts
- [ ] No TypeScript errors in twilioStream.ts

### Local Testing
```bash
npm start
```
- [ ] Server starts without errors
- [ ] No "Cannot find module" errors
- [ ] No "Connection refused" to OpenAI/Twilio
- [ ] Logs show: "Server running on port 3000"

---

## Testing Checklist

### Test 1: Basic Connection
```bash
curl -X GET http://localhost:3000/debug
```
- [ ] Response includes serverUrl
- [ ] Response includes wsUrl
- [ ] Response shows hasOpenAiKey: true
- [ ] Response shows hasTwilioSid: true
- [ ] Response shows hasTwilioToken: true

### Test 2: Inbound Call Test
1. [ ] Start server: `npm start`
2. [ ] Call Twilio number from real phone
3. [ ] Wait 3-5 seconds for connection
4. [ ] Listen for bot greeting
5. [ ] Check logs for success pattern:
   ```
   ✅ "Connected to OpenAI Realtime API"
   ✅ "Twilio Media Stream started"
   ✅ "Received audio chunk from OpenAI"
   ✅ "Sent Twilio audio frame"
   ```

### Test 3: Audio Quality
- [ ] Bot voice is clear (not robotic/garbled)
- [ ] No audio delays
- [ ] No audio gaps or stuttering
- [ ] Conversation flows naturally
- [ ] User voice is recognized correctly

### Test 4: Call Completion
- [ ] Call doesn't drop unexpectedly
- [ ] Bot responses complete fully
- [ ] Logs show: "Flushed X frames"
- [ ] No errors on disconnect

---

## Performance Checks

### Monitor During Calls
```bash
# In separate terminal, watch logs
tail -f application.log | grep -E "audio|frame|error"
```

### Expected Log Frequency
- [ ] OpenAI events: 1-2 per second during response
- [ ] Audio frame sends: 50-100 per second during audio
- [ ] Response completion: Within 5 seconds
- [ ] No error spikes

### Resource Usage
- [ ] CPU usage < 10% during call
- [ ] Memory stable (no growth)
- [ ] No file descriptor leaks
- [ ] WebSocket connections close properly

---

## Twilio Configuration Verification

### Phone Number Settings
Go to: Twilio Console → Phone Numbers → Active Numbers → Your Number

- [ ] Voice & Fax → Incoming Call → Webhook
- [ ] URL: `https://your-domain.com/voice`
- [ ] Method: HTTP POST
- [ ] Status: Saved ✓

### Test Configuration
- [ ] Try making a call
- [ ] Check Twilio Debugger for webhook logs
- [ ] Look for successful POST to `/voice`
- [ ] Response should be valid TwiML

---

## Monitoring Post-Deployment

### Daily Checks
- [ ] Server process running
- [ ] OpenAI API responding
- [ ] Twilio webhook receiving calls
- [ ] No error rate spikes

### Weekly Checks
- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Verify audio quality consistency
- [ ] Test with different phone types

### Red Flags
- [ ] 404 errors on `/voice` endpoint
- [ ] "Cannot connect to OpenAI" errors
- [ ] WebSocket connection timeouts
- [ ] "Audio format not supported" errors
- [ ] Gradual memory growth

---

## Rollback Plan (If Needed)

### Quick Rollback
If issues occur, these are the only files modified:
```
src/services/openaiRealtime.ts - Line 155, Line 517
src/services/twilioStream.ts - Line 122, Line 170
```

### Rollback Steps
1. Revert specific lines in openaiRealtime.ts
2. Revert specific lines in twilioStream.ts
3. Run `npm run build`
4. Restart server
5. Test again

### Fallback Option
Keep previous version running on:
- [ ] Branch: `bot-voice-original`
- [ ] Tag: `v1-before-audio-fix`
- [ ] Backup: In git history

---

## Documentation & Support

### Team Communication
- [ ] Document changes in team wiki
- [ ] Add link to BOT_VOICE_FIX_GUIDE.md
- [ ] Share QUICK_FIX_SUMMARY.md with team
- [ ] Note in deployment notes

### Customer Communication (If Needed)
- [ ] "Bot voice was not transmitting correctly"
- [ ] "Fixed audio format and buffering issues"
- [ ] "All calls now transmit bot voice properly"

### Support Articles
- [ ] Add troubleshooting guide to knowledge base
- [ ] Document expected behavior
- [ ] List common issues and solutions

---

## Final Sign-Off

### Technical Review
- [ ] Code changes reviewed ✅
- [ ] No breaking changes ✅
- [ ] All tests passing ✅
- [ ] Performance verified ✅

### Deployment Approval
- [ ] Development environment: Ready ✅
- [ ] Staging environment: Ready ✅
- [ ] Production environment: Ready ✅

### Deployment Execution
- [ ] Changes merged to main branch
- [ ] Docker image built (if applicable)
- [ ] Deployed to production
- [ ] Post-deployment testing completed
- [ ] Monitoring alerts enabled

---

## Post-Deployment Validation

### Hour 1
- [ ] Service responding to requests
- [ ] First test call successful
- [ ] Audio quality verified
- [ ] No error spikes

### Hour 4
- [ ] Multiple test calls successful
- [ ] Consistent audio quality
- [ ] No memory leaks observed
- [ ] Logs clean and expected

### Day 1
- [ ] Natural call traffic flowing
- [ ] No crash/restart loops
- [ ] User satisfaction confirmed
- [ ] Support tickets clear

### Week 1
- [ ] Stable operation confirmed
- [ ] No regression issues
- [ ] Performance metrics acceptable
- [ ] Ready for full rollout

---

## Metrics to Track

### Key Performance Indicators
```
- Average response time: < 500ms
- Audio frame success rate: > 99%
- Call completion rate: > 98%
- Error rate: < 0.5%
- Server uptime: > 99.9%
```

### Dashboard Items
- [ ] Active calls (real-time)
- [ ] Audio frames sent (per call)
- [ ] Response latency (p50, p95, p99)
- [ ] Error rate (per minute)
- [ ] CPU/Memory usage (per server)

---

## Contacts & Escalation

### On Call
- [ ] DevOps: [contact]
- [ ] Backend Lead: [contact]
- [ ] OpenAI Support: https://platform.openai.com/docs/guides/realtime
- [ ] Twilio Support: https://www.twilio.com/help

### Escalation Path
1. Check logs for errors
2. Review BOT_VOICE_FIX_GUIDE.md troubleshooting
3. Test with debug endpoint
4. Contact Backend Lead
5. Contact DevOps if infrastructure issue

---

## Success Criteria

✅ Deployment is successful when:

1. Bot voice is heard clearly on all inbound calls
2. No audio quality degradation
3. No additional errors introduced
4. Performance metrics within acceptable range
5. All team members trained on changes

---

**Checklist Version**: 1.0
**Last Updated**: January 4, 2026
**Status**: Ready for Deployment ✅

Use this checklist before and after deployment.
