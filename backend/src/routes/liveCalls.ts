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

export default router;
