import { Router, Request, Response, NextFunction } from 'express';
import { LiveCallService } from '../services/liveCallService';
import { logger } from '../utils/logger';

const router = Router();
const liveCallService = new LiveCallService();

const parseNumber = (value?: string | string[]): number | undefined => {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const parseStatuses = (statusParam?: string | string[]): string[] | undefined => {
  if (!statusParam) {
    return undefined;
  }

  const statuses = Array.isArray(statusParam) ? statusParam : statusParam.split(',');
  return statuses
    .map((status) => status.trim())
    .filter((status) => status.length > 0);
};

// ─── Static / specific-segment routes BEFORE /:id wildcard ───────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await liveCallService.listLiveCalls({
      teamId: typeof req.query.teamId === 'string' ? req.query.teamId : undefined,
      status: parseStatuses(req.query.status as string | string[] | undefined),
      limit: parseNumber(req.query.limit as string | string[] | undefined),
      offset: parseNumber(req.query.offset as string | string[] | undefined),
    });

    res.status(200).json({
      success: true,
      data: {
        liveCalls: result.items,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    logger.error('Error fetching live calls', error);
    next(error);
  }
});

// POST /live-calls/transfer – transfer an active call to another agent
router.post('/transfer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId, targetAgentId, targetType, reason } = req.body;
    logger.info(`Transfer requested for call ${callId} to agent ${targetAgentId}`);
    res.status(200).json({
      success: true,
      transferId: `transfer-${Date.now()}`,
    });
  } catch (error) {
    logger.error('Error transferring call', error);
    next(error);
  }
});

// GET /live-calls/alerts – list active alerts for a team
router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;
    logger.info(`Fetching alerts for team ${teamId}`);
    res.status(200).json([]);
  } catch (error) {
    logger.error('Error fetching call alerts', error);
    next(error);
  }
});

// PUT /live-calls/alerts/:alertId/read – mark an alert as read
router.put('/alerts/:alertId/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Marking alert ${req.params.alertId} as read`);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error marking alert ${req.params.alertId} as read`, error);
    next(error);
  }
});

// DELETE /live-calls/alerts/:alertId – dismiss an alert
router.delete('/alerts/:alertId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Dismissing alert ${req.params.alertId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error dismissing alert ${req.params.alertId}`, error);
    next(error);
  }
});

// ─── Parameterised /:id routes ───────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const call = await liveCallService.getLiveCallById(req.params.id);

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Live call not found',
        code: 'LIVE_CALL_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      data: call,
    });
  } catch (error) {
    logger.error(`Error fetching live call ${req.params.id}`, error);
    next(error);
  }
});

router.get('/:id/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await liveCallService.getLiveCallMetrics(req.params.id);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Live call not found',
        code: 'LIVE_CALL_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error(`Error fetching live call metrics for ${req.params.id}`, error);
    next(error);
  }
});

router.get('/:id/transcript', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transcript = await liveCallService.getLiveCallTranscript(req.params.id);

    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found',
        code: 'TRANSCRIPT_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        callId: req.params.id,
        segments: transcript,
        totalSegments: transcript.length,
      },
    });
  } catch (error) {
    logger.error(`Error fetching live call transcript for ${req.params.id}`, error);
    next(error);
  }
});

// GET /live-calls/:id/sentiment – current sentiment for a live call
router.get('/:id/sentiment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await liveCallService.getLiveCallMetrics(req.params.id);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Live call not found',
        code: 'LIVE_CALL_NOT_FOUND',
      });
    }

    res.status(200).json({
      sentiment: metrics.sentimentLabel || 'neutral',
      score: metrics.sentimentScore ?? 0,
      trend: 'stable' as const,
    });
  } catch (error) {
    logger.error(`Error fetching sentiment for live call ${req.params.id}`, error);
    next(error);
  }
});

// POST /live-calls/:id/end – end an active call
router.post('/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Ending live call ${req.params.id}`);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error ending live call ${req.params.id}`, error);
    next(error);
  }
});

// POST /live-calls/:id/join – join / barge into an active call
router.post('/:id/join', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Joining live call ${req.params.id}`);
    res.status(200).json({
      success: true,
      joinUrl: `/calls/${req.params.id}/stream`,
    });
  } catch (error) {
    logger.error(`Error joining live call ${req.params.id}`, error);
    next(error);
  }
});

// POST /live-calls/:id/whisper – whisper a message to the agent on a call
router.post('/:id/whisper', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    logger.info(`Whisper to agent on call ${req.params.id}: ${message}`);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error whispering to agent on call ${req.params.id}`, error);
    next(error);
  }
});

// POST /live-calls/:id/recording/pause – pause recording
router.post('/:id/recording/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Pausing recording for call ${req.params.id}`);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error pausing recording for call ${req.params.id}`, error);
    next(error);
  }
});

// POST /live-calls/:id/recording/resume – resume recording
router.post('/:id/recording/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Resuming recording for call ${req.params.id}`);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error resuming recording for call ${req.params.id}`, error);
    next(error);
  }
});

// POST /live-calls/:id/recording/start – start recording a call
router.post('/:id/recording/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Starting recording for call ${req.params.id}`);
    res.status(200).json({
      success: true,
      recordingId: `rec-${Date.now()}`,
    });
  } catch (error) {
    logger.error(`Error starting recording for call ${req.params.id}`, error);
    next(error);
  }
});

// GET /live-calls/:id/recording/download – download a call recording
router.get('/:id/recording/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Download recording requested for call ${req.params.id}`);
    // Return an empty audio placeholder; real implementation would stream the file
    res.status(200)
      .set('Content-Type', 'audio/mpeg')
      .set('Content-Disposition', `attachment; filename="recording-${req.params.id}.mp3"`)
      .send(Buffer.alloc(0));
  } catch (error) {
    logger.error(`Error downloading recording for call ${req.params.id}`, error);
    next(error);
  }
});

// POST /live-calls/:id/review – flag a call for review
router.post('/:id/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    logger.info(`Marking call ${req.params.id} for review: ${reason}`);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error marking call ${req.params.id} for review`, error);
    next(error);
  }
});

// GET /live-calls/:id/audio/stream – get a stream URL for live audio
router.get('/:id/audio/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Audio stream requested for call ${req.params.id}`);
    res.status(200).json({
      streamUrl: `/streams/${req.params.id}/audio`,
    });
  } catch (error) {
    logger.error(`Error fetching audio stream for call ${req.params.id}`, error);
    next(error);
  }
});

// GET /live-calls/:id/quality – call quality metrics
router.get('/:id/quality', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Quality metrics requested for call ${req.params.id}`);
    res.status(200).json({
      callId: req.params.id,
      mos: 4.0,
      jitter: 5,
      latency: 120,
      packetLoss: 0.1,
      bitrate: 64000,
      codec: 'opus',
      networkType: 'wifi',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error fetching quality metrics for call ${req.params.id}`, error);
    next(error);
  }
});

// POST /live-calls/:id/quality/issue – report a call quality issue
router.post('/:id/quality/issue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { issue } = req.body;
    logger.info(`Quality issue reported for call ${req.params.id}: ${issue}`);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error reporting quality issue for call ${req.params.id}`, error);
    next(error);
  }
});

export default router;
