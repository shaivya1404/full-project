export interface AudioFormat {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  codec: string;
}

export const TWILIO_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 8000,
  channels: 1,
  bitDepth: 16,
  codec: 'mulaw',
};

export const OPENAI_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
  codec: 'pcm16',
};

export const STORAGE_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
  codec: 'pcm16',
};

export class AudioNormalizer {
  static decodeBase64(base64Audio: string): Buffer {
    return Buffer.from(base64Audio, 'base64');
  }

  static encodeBase64(audioBuffer: Buffer): string {
    return audioBuffer.toString('base64');
  }

  static decodeTwilioPCM(base64Audio: string): Buffer {
    const audioBuffer = this.decodeBase64(base64Audio);
    return this.mulawToPCM16(audioBuffer);
  }

  static mulawToPCM16(mulawBuffer: Buffer): Buffer {
    const pcm16Buffer = Buffer.alloc(mulawBuffer.length * 2);

    for (let i = 0; i < mulawBuffer.length; i++) {
      const mulawByte = mulawBuffer[i];
      const pcm16Value = this.mulawDecode(mulawByte);
      pcm16Buffer.writeInt16LE(pcm16Value, i * 2);
    }

    return pcm16Buffer;
  }

  static mulawDecode(mulawByte: number): number {
    const MULAW_BIAS = 33;
    const MULAW_MAX = 0x1fff;

    mulawByte = ~mulawByte;
    const sign = mulawByte & 0x80;
    const exponent = (mulawByte >> 4) & 0x07;
    const mantissa = mulawByte & 0x0f;

    let sample = mantissa << (exponent + 3);
    sample += MULAW_BIAS << exponent;
    if (exponent === 0) {
      sample += MULAW_BIAS;
    }

    if (sample > MULAW_MAX) {
      sample = MULAW_MAX;
    }

    return sign !== 0 ? -sample : sample;
  }

  static pcm16ToMulaw(pcm16Buffer: Buffer): Buffer {
    const mulawBuffer = Buffer.alloc(pcm16Buffer.length / 2);

    for (let i = 0; i < mulawBuffer.length; i++) {
      const pcm16Value = pcm16Buffer.readInt16LE(i * 2);
      mulawBuffer[i] = this.mulawEncode(pcm16Value);
    }

    return mulawBuffer;
  }

  static mulawEncode(pcm16Value: number): number {
    const MULAW_BIAS = 33;
    const MULAW_MAX = 0x1fff;
    const MULAW_CLIP = 32635;

    const sign = pcm16Value < 0 ? 0x80 : 0x00;
    let sample = Math.abs(pcm16Value);

    if (sample > MULAW_CLIP) {
      sample = MULAW_CLIP;
    }

    sample += MULAW_BIAS;

    let exponent = 7;
    for (let exp = 0; exp < 8; exp++) {
      if (sample <= MULAW_MAX >> (7 - exp)) {
        exponent = exp;
        break;
      }
    }

    const mantissa = (sample >> (exponent + 3)) & 0x0f;
    const mulawByte = ~(sign | (exponent << 4) | mantissa);

    return mulawByte & 0xff;
  }

  static convertToOpenAIFormat(twilioBase64: string): string {
    const pcm16Buffer = this.decodeTwilioPCM(twilioBase64);
    const resampledBuffer = this.resample(
      pcm16Buffer,
      TWILIO_AUDIO_FORMAT.sampleRate,
      OPENAI_AUDIO_FORMAT.sampleRate,
    );
    return this.encodeBase64(resampledBuffer);
  }

  static convertToStorageFormat(twilioBase64: string): Buffer {
    const pcm16Buffer = this.decodeTwilioPCM(twilioBase64);
    return this.resample(
      pcm16Buffer,
      TWILIO_AUDIO_FORMAT.sampleRate,
      STORAGE_AUDIO_FORMAT.sampleRate,
    );
  }

  static resample(buffer: Buffer, fromRate: number, toRate: number): Buffer {
    if (fromRate === toRate) {
      return buffer;
    }

    const ratio = toRate / fromRate;
    const samplesIn = buffer.length / 2;
    const samplesOut = Math.floor(samplesIn * ratio);
    const outputBuffer = Buffer.alloc(samplesOut * 2);

    for (let i = 0; i < samplesOut; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, samplesIn - 1);
      const t = srcIndex - srcIndexFloor;

      const sample1 = buffer.readInt16LE(srcIndexFloor * 2);
      const sample2 = buffer.readInt16LE(srcIndexCeil * 2);

      const interpolatedSample = Math.round(sample1 * (1 - t) + sample2 * t);
      outputBuffer.writeInt16LE(interpolatedSample, i * 2);
    }

    return outputBuffer;
  }

  static createWavHeader(
    dataLength: number,
    sampleRate: number,
    channels: number,
    bitDepth: number,
  ): Buffer {
    const header = Buffer.alloc(44);
    const byteRate = (sampleRate * channels * bitDepth) / 8;
    const blockAlign = (channels * bitDepth) / 8;

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);

    return header;
  }

  static bufferToWav(
    pcmBuffer: Buffer,
    sampleRate: number = STORAGE_AUDIO_FORMAT.sampleRate,
    channels: number = STORAGE_AUDIO_FORMAT.channels,
    bitDepth: number = STORAGE_AUDIO_FORMAT.bitDepth,
  ): Buffer {
    const wavHeader = this.createWavHeader(pcmBuffer.length, sampleRate, channels, bitDepth);
    return Buffer.concat([wavHeader, pcmBuffer]);
  }

  static extractPCMFromWav(wavBuffer: Buffer): Buffer {
    if (wavBuffer.length < 44) {
      throw new Error('Invalid WAV file: too short');
    }

    const riff = wavBuffer.toString('ascii', 0, 4);
    const wave = wavBuffer.toString('ascii', 8, 12);

    if (riff !== 'RIFF' || wave !== 'WAVE') {
      throw new Error('Invalid WAV file: missing RIFF/WAVE headers');
    }

    return wavBuffer.slice(44);
  }
}
