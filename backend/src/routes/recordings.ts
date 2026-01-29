import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { CallRepository } from '../db/repositories/callRepository';
import { StorageService } from '../services/storageService';
import { logger } from '../utils/logger';

const router = Router();

let callRepository: CallRepository;
let storageService: StorageService;

const getRepositories = () => {
  if (!callRepository) {
    callRepository = new CallRepository();
  }
  if (!storageService) {
    storageService = new StorageService();
  }
  return { callRepository, storageService };
};

interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
}

// GET /api/recordings/recent - Return last 5 recordings from database (no auth)
// MUST be before /:recordingId to avoid being caught by the dynamic route
router.get('/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callRepository: repo } = getRepositories();

    // Query the last 5 recordings from database, ordered by creation date
    const recordings = await repo.getRecentRecordings(5);

    const result = recordings.map((rec) => ({
      id: rec.id,
      callId: rec.callId,
      filename: path.basename(rec.filePath),
      filePath: rec.filePath,
      format: rec.format,
      codec: rec.codec,
      sampleRate: rec.sampleRate,
      duration: rec.duration,
      sizeBytes: rec.sizeBytes,
      createdAt: rec.createdAt,
    }));

    res.status(200).json({ recordings: result });
  } catch (error) {
    logger.error('Error listing recent recordings', error);
    next(error);
  }
});

// GET /api/recordings/download/:filename - Download recording file by filename (public, no auth required)
// MUST be before /:recordingId to avoid being caught by the dynamic route
router.get(
  '/download/:filename',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filename } = req.params;
      // simple sanitization: no path traversal
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: 'Invalid filename', code: 'INVALID_FILENAME' } as ErrorResponse);
      }

      const recordingsDir = config.RECORDING_STORAGE_PATH;
      const filePath = path.join(recordingsDir, filename);

      const { storageService: storage } = getRepositories();
      const exists = await storage.fileExists(filePath);
      if (!exists) {
        return res.status(404).json({ message: 'Recording file not found', code: 'FILE_NOT_FOUND' } as ErrorResponse);
      }

      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', stat.size.toString());
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`);

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', (error) => {
        logger.error('Error streaming recording by filename', error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming recording', code: 'STREAM_ERROR' } as ErrorResponse);
        }
      });
    } catch (error) {
      logger.error('Error handling recording download request', error);
      next(error);
    }
  },
);

// GET /api/recordings/:recordingId - Get recording by ID

export default router;

