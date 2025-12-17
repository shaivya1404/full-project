import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
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

// GET /api/recordings/:recordingId - Get recording by ID
router.get('/:recordingId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recordingId } = req.params;
    const download = req.query.download === 'true';
    const { callRepository: repo, storageService: storage } = getRepositories();

    const recording = await repo.getRecordingById(recordingId);
    if (!recording) {
      return res.status(404).json({
        message: 'Recording not found',
        code: 'RECORDING_NOT_FOUND',
      } as ErrorResponse);
    }

    const filePath = recording.filePath;
    const fileExists = await storage.fileExists(filePath);
    if (!fileExists) {
      return res.status(404).json({
        message: 'Recording file not found on storage',
        code: 'FILE_NOT_FOUND',
      } as ErrorResponse);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    if (download) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="recording-${recordingId}.${recording.format || 'wav'}"`,
      );
    } else {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Accept-Ranges', 'bytes');
    }

    res.setHeader('Content-Length', fileSize);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (error) => {
      logger.error('Error streaming recording', error);
      if (!res.headersSent) {
        res.status(500).json({
          message: 'Error streaming recording',
          code: 'STREAM_ERROR',
        } as ErrorResponse);
      }
    });
  } catch (error) {
    logger.error('Error handling recording request', error);
    next(error);
  }
});

export default router;
