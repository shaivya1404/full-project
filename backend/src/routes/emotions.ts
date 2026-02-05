import { Router, Request, Response, NextFunction } from 'express';
import { emotionDetectionService } from '../services/emotionDetectionService';
import { conversationStateService } from '../services/conversationStateService';
import { logger } from '../utils/logger';

const router = Router();

// Helper to extract teamId
const extractTeamId = (req: Request): string | undefined => {
  return (req as any).user?.teamId || req.body.teamId || req.query.teamId as string;
};

/**
 * GET /api/emotions/templates
 * List all emotion templates for a team
 */
router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = extractTeamId(req);

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const templates = await emotionDetectionService.getEmotionTemplates(teamId);

    res.json({ data: templates });
  } catch (error) {
    logger.error('Error getting emotion templates', error);
    next(error);
  }
});

/**
 * POST /api/emotions/templates
 * Create a new emotion template
 */
router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = extractTeamId(req);
    const { emotion, triggerPatterns, responseTemplate, toneGuidance, escalationThreshold } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    if (!emotion || !triggerPatterns || !responseTemplate) {
      return res.status(400).json({ message: 'emotion, triggerPatterns, and responseTemplate required' });
    }

    const template = await emotionDetectionService.createEmotionTemplate(teamId, {
      emotion,
      triggerPatterns,
      responseTemplate,
      toneGuidance,
      escalationThreshold,
    });

    res.status(201).json({ data: template });
  } catch (error) {
    logger.error('Error creating emotion template', error);
    next(error);
  }
});

/**
 * PUT /api/emotions/templates/:id
 * Update an emotion template
 */
router.put('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { emotion, triggerPatterns, responseTemplate, toneGuidance, escalationThreshold, isActive } = req.body;

    const { prisma } = await import('../db/client');

    const template = await prisma.emotionTemplate.update({
      where: { id },
      data: {
        ...(emotion && { emotion }),
        ...(triggerPatterns && { triggerPatterns: JSON.stringify(triggerPatterns) }),
        ...(responseTemplate && { responseTemplate }),
        ...(toneGuidance !== undefined && { toneGuidance }),
        ...(escalationThreshold !== undefined && { escalationThreshold }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ data: template });
  } catch (error) {
    logger.error('Error updating emotion template', error);
    next(error);
  }
});

/**
 * DELETE /api/emotions/templates/:id
 * Delete an emotion template (soft delete via isActive)
 */
router.delete('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { prisma } = await import('../db/client');

    await prisma.emotionTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Template deactivated' });
  } catch (error) {
    logger.error('Error deleting emotion template', error);
    next(error);
  }
});

/**
 * POST /api/emotions/templates/:id/effectiveness
 * Update template effectiveness based on outcome
 */
router.post('/templates/:id/effectiveness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { wasEffective } = req.body;

    if (wasEffective === undefined) {
      return res.status(400).json({ message: 'wasEffective required' });
    }

    await emotionDetectionService.updateTemplateEffectiveness(id, wasEffective);

    res.json({ message: 'Effectiveness updated' });
  } catch (error) {
    logger.error('Error updating template effectiveness', error);
    next(error);
  }
});

/**
 * POST /api/emotions/detect
 * Detect emotion from text
 */
router.post('/detect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'text required' });
    }

    const result = emotionDetectionService.detectEmotion(text);

    res.json({ data: result });
  } catch (error) {
    logger.error('Error detecting emotion', error);
    next(error);
  }
});

/**
 * GET /api/emotions/call/:callId/history
 * Get emotion history for a call
 */
router.get('/call/:callId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;

    const { prisma } = await import('../db/client');

    // Get call with conversation state
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { conversationState: true },
    });

    if (!call || !call.conversationState) {
      return res.status(404).json({ message: 'Call or conversation state not found' });
    }

    const emotionHistory = JSON.parse(call.conversationState.emotionHistory || '[]');

    res.json({
      data: {
        currentEmotion: call.conversationState.currentEmotion,
        emotionScore: call.conversationState.emotionScore,
        history: emotionHistory,
      },
    });
  } catch (error) {
    logger.error('Error getting emotion history', error);
    next(error);
  }
});

/**
 * GET /api/emotions/call/:streamSid/trend
 * Get emotion trend for active call
 */
router.get('/call/:streamSid/trend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;

    const trend = await emotionDetectionService.getEmotionTrend(streamSid);

    res.json({ data: trend });
  } catch (error) {
    logger.error('Error getting emotion trend', error);
    next(error);
  }
});

export default router;
