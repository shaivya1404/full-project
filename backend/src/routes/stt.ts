import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sttProvider } from '../services/sttProvider';
import { logger } from '../utils/logger';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const ALLOWED_AUDIO_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mp3', 'audio/mpeg',
  'audio/flac',
  'audio/ogg',
  'audio/webm',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AUDIO_TYPES.includes(file.mimetype) || file.originalname.match(/\.(wav|mp3|flac|ogg|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (WAV, MP3, FLAC, OGG, WEBM) are allowed'));
    }
  },
});

// POST /api/stt/transcribe — Single file transcription
router.post('/transcribe', authenticate, upload.single('audio_file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', detail: 'audio_file is required' });
    }

    const languageHint = (req.query.language_hint as string) || (req.body.language_hint as string) || undefined;
    const jobId = uuidv4();

    const result = await sttProvider.transcribe(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      languageHint
    );

    res.json({
      job_id: jobId,
      text: result.text,
      language: result.language,
      confidence: result.confidence,
      timestamps: result.timestamps,
      meta: result.meta,
      modelUsed: result.modelUsed,
      provider: sttProvider.getProvider(),
      status: result.status,
    });
  } catch (error: any) {
    logger.error('STT transcribe error', error);
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message || 'Transcription failed';
    res.status(status).json({ status: 'error', detail });
  }
});

// POST /api/stt/batch-transcribe — Multiple files
router.post('/batch-transcribe', authenticate, upload.array('audio_files', 10), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ status: 'error', detail: 'audio_files[] is required' });
    }

    const languageHint = (req.query.language_hint as string) || (req.body.language_hint as string) || undefined;

    const results = await Promise.all(
      files.map(async (file) => {
        const jobId = uuidv4();
        try {
          const result = await sttProvider.transcribe(
            file.buffer,
            file.originalname,
            file.mimetype,
            languageHint
          );
          return { job_id: jobId, ...result };
        } catch (error: any) {
          return {
            job_id: jobId,
            text: '',
            language: '',
            confidence: 0,
            timestamps: [],
            meta: {},
            modelUsed: '',
            status: 'error' as const,
            detail: error.response?.data?.detail || error.message,
          };
        }
      })
    );

    res.json({ items: results, provider: sttProvider.getProvider() });
  } catch (error: any) {
    logger.error('STT batch-transcribe error', error);
    res.status(500).json({ status: 'error', detail: error.message });
  }
});

// GET /api/stt/health — Provider health check
router.get('/health', async (_req, res: Response) => {
  try {
    const health = await sttProvider.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(503).json({ status: 'unhealthy', provider: sttProvider.getProvider(), detail: error.message });
  }
});

export default router;
