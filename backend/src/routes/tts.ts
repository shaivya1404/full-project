import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ttsProvider } from '../services/ttsProvider';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/tts/synthesize — Text to speech
router.post('/synthesize', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, language, voice_id, speed, emotion } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ status: 'error', detail: 'text is required' });
    }
    if (!language || typeof language !== 'string') {
      return res.status(400).json({ status: 'error', detail: 'language is required' });
    }

    const jobId = uuidv4();

    const result = await ttsProvider.synthesize(
      text,
      language,
      voice_id,
      speed ? parseFloat(speed) : undefined,
      emotion
    );

    res.json({
      job_id: jobId,
      audio_base64: result.audioBase64,
      audio_url: result.audioUrl,
      duration: result.duration,
      provider: ttsProvider.getProvider(),
      status: result.status,
      meta: result.meta,
    });
  } catch (error: any) {
    logger.error('TTS synthesize error', error);
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message || 'Synthesis failed';
    res.status(status).json({ status: 'error', detail });
  }
});

// POST /api/tts/synthesize-batch — Batch synthesis
router.post('/synthesize-batch', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', detail: 'items[] array is required' });
    }

    if (items.length > 20) {
      return res.status(400).json({ status: 'error', detail: 'Maximum 20 items per batch' });
    }

    const results = await Promise.all(
      items.map(async (item: any) => {
        const jobId = uuidv4();
        try {
          const result = await ttsProvider.synthesize(
            item.text,
            item.language,
            item.voice_id,
            item.speed ? parseFloat(item.speed) : undefined,
            item.emotion
          );
          return {
            job_id: jobId,
            audio_base64: result.audioBase64,
            audio_url: result.audioUrl,
            duration: result.duration,
            status: result.status,
            meta: result.meta,
          };
        } catch (error: any) {
          return {
            job_id: jobId,
            audio_base64: '',
            duration: 0,
            status: 'error' as const,
            detail: error.response?.data?.detail || error.message,
          };
        }
      })
    );

    res.json({ items: results, provider: ttsProvider.getProvider() });
  } catch (error: any) {
    logger.error('TTS batch-synthesize error', error);
    res.status(500).json({ status: 'error', detail: error.message });
  }
});

// GET /api/tts/voices — List available voices
router.get('/voices', authenticate, async (_req: Request, res: Response) => {
  try {
    const voices = await ttsProvider.getVoices();
    res.json({ voices, provider: ttsProvider.getProvider() });
  } catch (error: any) {
    logger.error('TTS voices error', error);
    res.status(500).json({ status: 'error', detail: error.message });
  }
});

// GET /api/tts/health — Provider health check
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await ttsProvider.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(503).json({ status: 'unhealthy', provider: ttsProvider.getProvider(), detail: error.message });
  }
});

export default router;
