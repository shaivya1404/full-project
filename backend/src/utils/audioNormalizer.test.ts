import {
  AudioNormalizer,
  TWILIO_AUDIO_FORMAT,
  OPENAI_AUDIO_FORMAT,
  STORAGE_AUDIO_FORMAT,
} from './audioNormalizer';

describe('AudioNormalizer', () => {
  describe('Base64 encoding/decoding', () => {
    it('should encode and decode base64 correctly', () => {
      const testData = Buffer.from('Hello, World!', 'utf-8');
      const encoded = AudioNormalizer.encodeBase64(testData);
      const decoded = AudioNormalizer.decodeBase64(encoded);

      expect(decoded.toString('utf-8')).toBe('Hello, World!');
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      const encoded = AudioNormalizer.encodeBase64(emptyBuffer);
      const decoded = AudioNormalizer.decodeBase64(encoded);

      expect(decoded.length).toBe(0);
    });
  });

  describe('Mu-law encoding/decoding', () => {
    it('should encode PCM16 to mu-law', () => {
      const pcm16Buffer = Buffer.alloc(4);
      pcm16Buffer.writeInt16LE(1000, 0);
      pcm16Buffer.writeInt16LE(-1000, 2);

      const mulawBuffer = AudioNormalizer.pcm16ToMulaw(pcm16Buffer);

      expect(mulawBuffer.length).toBe(2);
      expect(mulawBuffer[0]).toBeGreaterThanOrEqual(0);
      expect(mulawBuffer[0]).toBeLessThanOrEqual(255);
      expect(mulawBuffer[1]).toBeGreaterThanOrEqual(0);
      expect(mulawBuffer[1]).toBeLessThanOrEqual(255);
    });

    it('should decode mu-law to PCM16', () => {
      const mulawBuffer = Buffer.from([0x00, 0x80, 0x55, 0xaa]);
      const pcm16Buffer = AudioNormalizer.mulawToPCM16(mulawBuffer);

      expect(pcm16Buffer.length).toBe(8);
    });

    it('should handle round-trip mu-law conversion', () => {
      const originalPCM = Buffer.alloc(10);
      for (let i = 0; i < 5; i++) {
        originalPCM.writeInt16LE(i * 1000, i * 2);
      }

      const mulaw = AudioNormalizer.pcm16ToMulaw(originalPCM);
      const pcm16 = AudioNormalizer.mulawToPCM16(mulaw);

      expect(pcm16.length).toBe(originalPCM.length);
    });

    it('should handle extreme values in mu-law encoding', () => {
      const pcm16Buffer = Buffer.alloc(4);
      pcm16Buffer.writeInt16LE(32767, 0);
      pcm16Buffer.writeInt16LE(-32768, 2);

      const mulawBuffer = AudioNormalizer.pcm16ToMulaw(pcm16Buffer);

      expect(mulawBuffer.length).toBe(2);
    });
  });

  describe('Twilio PCM decoding', () => {
    it('should decode Twilio PCM from base64', () => {
      const mulawBuffer = Buffer.from([0x00, 0x80, 0x55, 0xaa]);
      const base64 = mulawBuffer.toString('base64');

      const pcm16Buffer = AudioNormalizer.decodeTwilioPCM(base64);

      expect(pcm16Buffer.length).toBe(8);
    });

    it('should handle empty Twilio audio', () => {
      const emptyBase64 = Buffer.alloc(0).toString('base64');
      const result = AudioNormalizer.decodeTwilioPCM(emptyBase64);

      expect(result.length).toBe(0);
    });
  });

  describe('Format conversion', () => {
    it('should convert Twilio format to OpenAI format', () => {
      const mulawBuffer = Buffer.alloc(80);
      for (let i = 0; i < 80; i++) {
        mulawBuffer[i] = i % 256;
      }
      const base64 = mulawBuffer.toString('base64');

      const result = AudioNormalizer.convertToOpenAIFormat(base64);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should convert Twilio format to storage format', () => {
      const mulawBuffer = Buffer.alloc(80);
      for (let i = 0; i < 80; i++) {
        mulawBuffer[i] = i % 256;
      }
      const base64 = mulawBuffer.toString('base64');

      const result = AudioNormalizer.convertToStorageFormat(base64);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Resampling', () => {
    it('should resample audio correctly', () => {
      const inputBuffer = Buffer.alloc(160);
      for (let i = 0; i < 80; i++) {
        inputBuffer.writeInt16LE(Math.sin(i * 0.1) * 1000, i * 2);
      }

      const resampled = AudioNormalizer.resample(inputBuffer, 8000, 16000);

      expect(resampled.length).toBe(320);
    });

    it('should return same buffer when resampling to same rate', () => {
      const inputBuffer = Buffer.alloc(160);
      const resampled = AudioNormalizer.resample(inputBuffer, 8000, 8000);

      expect(resampled).toBe(inputBuffer);
    });

    it('should downsample audio', () => {
      const inputBuffer = Buffer.alloc(480);
      const resampled = AudioNormalizer.resample(inputBuffer, 24000, 8000);

      expect(resampled.length).toBe(160);
    });

    it('should handle edge cases in resampling', () => {
      const inputBuffer = Buffer.alloc(2);
      inputBuffer.writeInt16LE(1000, 0);

      const resampled = AudioNormalizer.resample(inputBuffer, 8000, 16000);

      expect(resampled.length).toBeGreaterThan(0);
    });
  });

  describe('WAV file operations', () => {
    it('should create valid WAV header', () => {
      const dataLength = 1000;
      const header = AudioNormalizer.createWavHeader(dataLength, 16000, 1, 16);

      expect(header.length).toBe(44);
      expect(header.toString('ascii', 0, 4)).toBe('RIFF');
      expect(header.toString('ascii', 8, 12)).toBe('WAVE');
      expect(header.toString('ascii', 12, 16)).toBe('fmt ');
      expect(header.toString('ascii', 36, 40)).toBe('data');
      expect(header.readUInt32LE(24)).toBe(16000);
      expect(header.readUInt16LE(22)).toBe(1);
      expect(header.readUInt16LE(34)).toBe(16);
    });

    it('should convert PCM buffer to WAV', () => {
      const pcmBuffer = Buffer.alloc(1000);
      for (let i = 0; i < 500; i++) {
        pcmBuffer.writeInt16LE(Math.sin(i * 0.1) * 1000, i * 2);
      }

      const wavBuffer = AudioNormalizer.bufferToWav(pcmBuffer);

      expect(wavBuffer.length).toBe(1044);
      expect(wavBuffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wavBuffer.toString('ascii', 8, 12)).toBe('WAVE');
    });

    it('should extract PCM from WAV', () => {
      const pcmBuffer = Buffer.alloc(1000);
      const wavBuffer = AudioNormalizer.bufferToWav(pcmBuffer);
      const extractedPCM = AudioNormalizer.extractPCMFromWav(wavBuffer);

      expect(extractedPCM.length).toBe(1000);
    });

    it('should throw error for invalid WAV file', () => {
      const invalidBuffer = Buffer.from('INVALID', 'ascii');

      expect(() => {
        AudioNormalizer.extractPCMFromWav(invalidBuffer);
      }).toThrow('Invalid WAV file');
    });

    it('should throw error for WAV file that is too short', () => {
      const shortBuffer = Buffer.alloc(10);

      expect(() => {
        AudioNormalizer.extractPCMFromWav(shortBuffer);
      }).toThrow('Invalid WAV file: too short');
    });

    it('should create WAV with custom parameters', () => {
      const pcmBuffer = Buffer.alloc(1000);
      const wavBuffer = AudioNormalizer.bufferToWav(pcmBuffer, 44100, 2, 24);

      expect(wavBuffer.length).toBe(1044);
      expect(wavBuffer.readUInt32LE(24)).toBe(44100);
      expect(wavBuffer.readUInt16LE(22)).toBe(2);
      expect(wavBuffer.readUInt16LE(34)).toBe(24);
    });
  });

  describe('Audio format constants', () => {
    it('should have correct Twilio audio format', () => {
      expect(TWILIO_AUDIO_FORMAT.sampleRate).toBe(8000);
      expect(TWILIO_AUDIO_FORMAT.channels).toBe(1);
      expect(TWILIO_AUDIO_FORMAT.bitDepth).toBe(16);
      expect(TWILIO_AUDIO_FORMAT.codec).toBe('mulaw');
    });

    it('should have correct OpenAI audio format', () => {
      expect(OPENAI_AUDIO_FORMAT.sampleRate).toBe(24000);
      expect(OPENAI_AUDIO_FORMAT.channels).toBe(1);
      expect(OPENAI_AUDIO_FORMAT.bitDepth).toBe(16);
      expect(OPENAI_AUDIO_FORMAT.codec).toBe('pcm16');
    });

    it('should have correct storage audio format', () => {
      expect(STORAGE_AUDIO_FORMAT.sampleRate).toBe(16000);
      expect(STORAGE_AUDIO_FORMAT.channels).toBe(1);
      expect(STORAGE_AUDIO_FORMAT.bitDepth).toBe(16);
      expect(STORAGE_AUDIO_FORMAT.codec).toBe('pcm16');
    });
  });
});
