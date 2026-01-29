import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { StorageService } from './storageService';
import { AudioNormalizer } from '../utils/audioNormalizer';

const mkdir = promisify(fs.mkdir);
const rmdir = promisify(fs.rmdir);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

jest.mock('../config/env', () => ({
  config: {
    RECORDING_STORAGE_PATH: '/tmp/test-recordings',
  },
}));

describe('StorageService', () => {
  let service: StorageService;
  const testPath = '/tmp/test-recordings';

  beforeEach(async () => {
    try {
      await mkdir(testPath, { recursive: true });
    } catch (error) {
      // Directory may already exist
    }
    service = new StorageService();
  });

  afterEach(async () => {
    try {
      const files = await readdir(testPath);
      for (const file of files) {
        await unlink(path.join(testPath, file));
      }
      await rmdir(testPath);
    } catch (error) {
      // Ignore errors
    }
  });

  describe('Recording operations', () => {
    it('should save a PCM recording', async () => {
      const pcmBuffer = Buffer.alloc(1000);
      for (let i = 0; i < 500; i++) {
        pcmBuffer.writeInt16LE(Math.sin(i * 0.1) * 1000, i * 2);
      }

      const result = await service.saveRecording({
        streamSid: 'test_stream_1',
        format: 'pcm',
        audioData: pcmBuffer,
      });

      expect(result.filePath).toContain('test_stream_1');
      expect(result.filePath).toContain('.pcm');
      expect(result.sizeBytes).toBe(1000);
      expect(await service.fileExists(result.filePath)).toBe(true);
    });

    it('should save a WAV recording', async () => {
      const pcmBuffer = Buffer.alloc(1000);
      const wavBuffer = AudioNormalizer.bufferToWav(pcmBuffer);

      const result = await service.saveRecording({
        streamSid: 'test_stream_2',
        format: 'wav',
        audioData: wavBuffer,
      });

      expect(result.filePath).toContain('test_stream_2');
      expect(result.filePath).toContain('.wav');
      expect(result.sizeBytes).toBe(1044);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should convert PCM to WAV when saving', async () => {
      const pcmBuffer = Buffer.alloc(1000);

      const result = await service.saveRecording({
        streamSid: 'test_stream_3',
        format: 'wav',
        audioData: pcmBuffer,
      });

      expect(result.filePath).toContain('.wav');

      const savedData = await readFile(result.filePath);
      expect(savedData.toString('ascii', 0, 4)).toBe('RIFF');
      expect(savedData.toString('ascii', 8, 12)).toBe('WAVE');
    });

    it('should append to existing recording', async () => {
      const pcmBuffer1 = Buffer.alloc(500);
      const pcmBuffer2 = Buffer.alloc(500);

      const result = await service.saveRecording({
        streamSid: 'test_stream_4',
        format: 'pcm',
        audioData: pcmBuffer1,
      });

      await service.appendToRecording(result.filePath, pcmBuffer2);

      const savedData = await readFile(result.filePath);
      expect(savedData.length).toBe(1000);
    });

    it('should calculate duration for WAV files', async () => {
      const pcmBuffer = Buffer.alloc(16000 * 2);
      const wavBuffer = AudioNormalizer.bufferToWav(pcmBuffer, 16000, 1, 16);

      const result = await service.saveRecording({
        streamSid: 'test_stream_5',
        format: 'wav',
        audioData: wavBuffer,
      });

      expect(result.duration).toBeCloseTo(1.0, 1);
    });
  });

  describe('Transcript operations', () => {
    it('should save a transcript', async () => {
      const transcript = 'Hello, this is a test transcript.';

      const filePath = await service.saveTranscript('test_stream_6', transcript);

      expect(filePath).toContain('test_stream_6');
      expect(filePath).toContain('_transcript.txt');
      expect(await service.fileExists(filePath)).toBe(true);

      const savedContent = await readFile(filePath, 'utf-8');
      expect(savedContent).toBe(transcript);
    });
  });

  describe('Metadata operations', () => {
    it('should save metadata as JSON', async () => {
      const metadata = {
        language: 'en-US',
        duration: 120,
        sentiment: 'positive',
      };

      const filePath = await service.saveMetadata('test_stream_7', metadata);

      expect(filePath).toContain('test_stream_7');
      expect(filePath).toContain('_metadata.json');
      expect(await service.fileExists(filePath)).toBe(true);

      const savedContent = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(savedContent);
      expect(parsed).toEqual(metadata);
    });
  });

  describe('File operations', () => {
    it('should check if file exists', async () => {
      const pcmBuffer = Buffer.alloc(100);
      const result = await service.saveRecording({
        streamSid: 'test_stream_8',
        format: 'pcm',
        audioData: pcmBuffer,
      });

      expect(await service.fileExists(result.filePath)).toBe(true);
      expect(await service.fileExists('/nonexistent/file.wav')).toBe(false);
    });

    it('should delete a file', async () => {
      const pcmBuffer = Buffer.alloc(100);
      const result = await service.saveRecording({
        streamSid: 'test_stream_9',
        format: 'pcm',
        audioData: pcmBuffer,
      });

      expect(await service.fileExists(result.filePath)).toBe(true);

      await service.deleteFile(result.filePath);

      expect(await service.fileExists(result.filePath)).toBe(false);
    });

    it('should get file path', () => {
      const filename = 'test_file.wav';
      const filePath = service.getFilePath(filename);

      expect(filePath).toContain('test_file.wav');
      expect(filePath).toContain(testPath);
    });
  });

  describe('Error handling', () => {
    it('should throw error when deleting non-existent file', async () => {
      await expect(service.deleteFile('/nonexistent/file.wav')).rejects.toThrow();
    });

    it('should throw error when appending to non-existent file', async () => {
      await expect(
        service.appendToRecording('/nonexistent/file.wav', Buffer.alloc(100)),
      ).rejects.toThrow();
    });
  });
});
