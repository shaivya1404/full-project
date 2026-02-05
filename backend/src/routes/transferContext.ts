import { Router, Request, Response, NextFunction } from 'express';
import { transferContextService } from '../services/transferContextService';
import { aiAgentCoordinator } from '../services/aiAgentCoordinator';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/transfer/:transferLogId/context
 * Get transfer context by transfer log ID
 */
router.get('/:transferLogId/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transferLogId } = req.params;

    const context = await transferContextService.getTransferContext(transferLogId);

    if (!context) {
      return res.status(404).json({ message: 'Transfer context not found' });
    }

    res.json({ data: context });
  } catch (error) {
    logger.error('Error getting transfer context', error);
    next(error);
  }
});

/**
 * GET /api/transfer/call/:callId/context
 * Get transfer context by call ID (for agent dashboard)
 */
router.get('/call/:callId/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;

    const context = await transferContextService.getContextForAgent(callId);

    if (!context) {
      return res.status(404).json({ message: 'Transfer context not found for this call' });
    }

    res.json({ data: context });
  } catch (error) {
    logger.error('Error getting transfer context for agent', error);
    next(error);
  }
});

/**
 * POST /api/transfer/:callId/build
 * Build transfer context for a call
 */
router.post('/:callId/build', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;
    const { transferLogId, streamSid, reason } = req.body;

    if (!transferLogId) {
      return res.status(400).json({ message: 'transferLogId required' });
    }

    const context = await transferContextService.buildTransferContext(callId, transferLogId);

    res.status(201).json({ data: context });
  } catch (error) {
    logger.error('Error building transfer context', error);
    next(error);
  }
});

/**
 * POST /api/transfer/:callId/initiate
 * Initiate warm transfer with full context
 */
router.post('/:callId/initiate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;
    const { streamSid, reason, teamId } = req.body;

    if (!streamSid || !reason) {
      return res.status(400).json({ message: 'streamSid and reason required' });
    }

    const agentContext = await aiAgentCoordinator.initiateWarmTransfer(
      callId,
      streamSid,
      reason,
      teamId
    );

    if (!agentContext) {
      return res.status(500).json({ message: 'Failed to build transfer context' });
    }

    res.json({
      data: agentContext,
      message: 'Transfer initiated with full context',
    });
  } catch (error) {
    logger.error('Error initiating warm transfer', error);
    next(error);
  }
});

/**
 * GET /api/transfer/:callId/live
 * Get live context during call (before transfer)
 */
router.get('/:callId/live', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;

    const context = await transferContextService.getContextForAgent(callId);

    res.json({ data: context || null });
  } catch (error) {
    logger.error('Error getting live context', error);
    next(error);
  }
});

/**
 * PUT /api/transfer/:callId/live
 * Update live context during call
 */
router.put('/:callId/live', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;
    const { attemptedSolutions, currentEmotion, frustrationLevel } = req.body;

    await transferContextService.updateLiveContext(callId, {
      attemptedSolutions,
      currentEmotion,
      frustrationLevel,
    });

    res.json({ message: 'Live context updated' });
  } catch (error) {
    logger.error('Error updating live context', error);
    next(error);
  }
});

export default router;
