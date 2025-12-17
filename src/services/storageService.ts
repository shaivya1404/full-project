import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { AudioNormalizer } from '../utils/audioNormalizer';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

export interface SaveRecordingOptions {
  streamSid: string;
  format?: 'wav' | 'pcm';
  audioData: Buffer;
}

export interface SaveRecordingResult {
  filePath: string;
  sizeBytes: number;
  duration?: number;
}

export class StorageService {
  private basePath: string;

  constructor() {
    this.basePath = config.RECORDING_STORAGE_PATH;
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await stat(this.basePath);
    } catch (error) {
      logger.info(`Creating storage directory at ${this.basePath}`);
      await mkdir(this.basePath, { recursive: true });
    }
  }

  async saveRecording(options: SaveRecordingOptions): Promise<SaveRecordingResult> {
    const { streamSid, format = 'wav', audioData } = options;

    const timestamp = Date.now();
    const filename = `${streamSid}_${timestamp}.${format}`;
    const filePath = path.join(this.basePath, filename);

    let dataToWrite = audioData;
    if (format === 'wav' && !this.isWavFile(audioData)) {
      dataToWrite = AudioNormalizer.bufferToWav(audioData);
    }

    await writeFile(filePath, dataToWrite);

    const stats = await stat(filePath);
    const duration = this.calculateDuration(dataToWrite, format);

    logger.info(`Recording saved to ${filePath} (${stats.size} bytes)`);

    return {
      filePath,
      sizeBytes: stats.size,
      duration,
    };
  }

  async appendToRecording(filePath: string, audioData: Buffer): Promise<void> {
    try {
      const existingData = await promisify(fs.readFile)(filePath);

      let dataToAppend = audioData;
      if (this.isWavFile(existingData)) {
        const existingPCM = AudioNormalizer.extractPCMFromWav(existingData);
        const combinedPCM = Buffer.concat([existingPCM, audioData]);
        dataToAppend = AudioNormalizer.bufferToWav(combinedPCM);
      } else {
        dataToAppend = Buffer.concat([existingData, audioData]);
      }

      await writeFile(filePath, dataToAppend);
    } catch (error) {
      logger.error(`Failed to append to recording at ${filePath}`, error);
      throw error;
    }
  }

  async saveTranscript(streamSid: string, transcript: string): Promise<string> {
    const timestamp = Date.now();
    const filename = `${streamSid}_${timestamp}_transcript.txt`;
    const filePath = path.join(this.basePath, filename);

    await writeFile(filePath, transcript, 'utf-8');
    logger.info(`Transcript saved to ${filePath}`);

    return filePath;
  }

  async saveMetadata(streamSid: string, metadata: Record<string, unknown>): Promise<string> {
    const timestamp = Date.now();
    const filename = `${streamSid}_${timestamp}_metadata.json`;
    const filePath = path.join(this.basePath, filename);

    await writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
    logger.info(`Metadata saved to ${filePath}`);

    return filePath;
  }

  private isWavFile(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    const riff = buffer.toString('ascii', 0, 4);
    const wave = buffer.toString('ascii', 8, 12);
    return riff === 'RIFF' && wave === 'WAVE';
  }

  private calculateDuration(buffer: Buffer, format: string): number {
    try {
      if (format === 'wav') {
        if (buffer.length < 44) return 0;
        const sampleRate = buffer.readUInt32LE(24);
        const byteRate = buffer.readUInt32LE(28);
        const dataSize = buffer.readUInt32LE(40);
        return dataSize / byteRate;
      } else if (format === 'pcm') {
        const sampleRate = 16000;
        const bytesPerSample = 2;
        const channels = 1;
        return buffer.length / (sampleRate * bytesPerSample * channels);
      }
    } catch (error) {
      logger.error('Failed to calculate audio duration', error);
    }
    return 0;
  }

  getFilePath(filename: string): string {
    return path.join(this.basePath, filename);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await promisify(fs.unlink)(filePath);
      logger.info(`Deleted file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to delete file: ${filePath}`, error);
      throw error;
    }
  }
}
