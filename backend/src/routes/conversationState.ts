import { Router, Request, Response, NextFunction } from 'express';
import { conversationStateService } from '../services/conversationStateService';
import { loopDetectionService } from '../services/loopDetectionService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/conversation/:streamSid/state
 * Get current conversation state
 */
router.get('/:streamSid/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;

    const state = await conversationStateService.getState(streamSid);

    if (!state) {
      return res.status(404).json({ message: 'Conversation state not found' });
    }

    res.json({ data: state });
  } catch (error) {
    logger.error('Error getting conversation state', error);
    next(error);
  }
});

/**
 * GET /api/conversation/:streamSid/progress
 * Get conversation progress summary
 */
router.get('/:streamSid/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;

    const progress = conversationStateService.getProgressSummary(streamSid);

    res.json({ data: progress });
  } catch (error) {
    logger.error('Error getting conversation progress', error);
    next(error);
  }
});

/**
 * GET /api/conversation/:streamSid/fields
 * Get collected fields
 */
router.get('/:streamSid/fields', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;

    const fields = conversationStateService.getCollectedFields(streamSid);
    const summary = conversationStateService.getCollectionSummary(streamSid);

    res.json({
      data: fields,
      summary,
    });
  } catch (error) {
    logger.error('Error getting collected fields', error);
    next(error);
  }
});

/**
 * GET /api/conversation/:streamSid/loop-status
 * Get loop detection status
 */
router.get('/:streamSid/loop-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;

    const loopStatus = loopDetectionService.detectLoop(streamSid);

    res.json({ data: loopStatus });
  } catch (error) {
    logger.error('Error getting loop status', error);
    next(error);
  }
});

/**
 * GET /api/conversation/:streamSid/emotion
 * Get emotion tracking data
 */
router.get('/:streamSid/emotion', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;

    const state = await conversationStateService.getState(streamSid);
    const trend = conversationStateService.getEmotionTrend(streamSid);

    res.json({
      data: {
        currentEmotion: state?.currentEmotion || 'neutral',
        emotionScore: state?.emotionScore || 0.5,
        history: state?.emotionHistory || [],
        trend,
      },
    });
  } catch (error) {
    logger.error('Error getting emotion data', error);
    next(error);
  }
});

/**
 * POST /api/conversation/:callId/initialize
 * Initialize conversation state for a call
 */
router.post('/:callId/initialize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;
    const { streamSid, customerId } = req.body;

    if (!streamSid) {
      return res.status(400).json({ message: 'streamSid required' });
    }

    const state = await conversationStateService.initializeState(callId, streamSid, customerId);
    loopDetectionService.initializeTracking(streamSid);

    res.status(201).json({ data: state });
  } catch (error) {
    logger.error('Error initializing conversation state', error);
    next(error);
  }
});

/**
 * POST /api/conversation/:streamSid/field
 * Mark a field as collected
 */
router.post('/:streamSid/field', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;
    const { fieldName, value } = req.body;

    if (!fieldName) {
      return res.status(400).json({ message: 'fieldName required' });
    }

    conversationStateService.markFieldCollected(streamSid, fieldName, value);

    res.json({ message: 'Field marked as collected' });
  } catch (error) {
    logger.error('Error marking field collected', error);
    next(error);
  }
});

/**
 * POST /api/conversation/:streamSid/stage
 * Update conversation stage
 */
router.post('/:streamSid/stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({ message: 'stage required' });
    }

    conversationStateService.updateStage(streamSid, stage);
    loopDetectionService.trackStageChange(streamSid);

    const progress = conversationStateService.getProgressSummary(streamSid);

    res.json({ data: progress });
  } catch (error) {
    logger.error('Error updating conversation stage', error);
    next(error);
  }
});

/**
 * POST /api/conversation/:streamSid/sync
 * Sync state to database
 */
router.post('/:streamSid/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;

    await conversationStateService.syncToDatabase(streamSid);

    res.json({ message: 'State synced to database' });
  } catch (error) {
    logger.error('Error syncing conversation state', error);
    next(error);
  }
});

export default router;
