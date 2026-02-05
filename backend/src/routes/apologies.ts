import { Router, Request, Response, NextFunction } from 'express';
import { apologyIntelligenceService } from '../services/apologyIntelligenceService';
import { logger } from '../utils/logger';

const router = Router();

// Helper to extract teamId
const extractTeamId = (req: Request): string | undefined => {
  return (req as any).user?.teamId || req.body.teamId || req.query.teamId as string;
};

/**
 * GET /api/apologies/templates
 * List all apology templates for a team
 */
router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = extractTeamId(req);
    const { situation } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const templates = await apologyIntelligenceService.getApologyTemplates(
      teamId,
      situation as string | undefined
    );

    res.json({ data: templates });
  } catch (error) {
    logger.error('Error getting apology templates', error);
    next(error);
  }
});

/**
 * POST /api/apologies/templates
 * Create a new apology template
 */
router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = extractTeamId(req);
    const { situation, isSpecific, template, followUpAction } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    if (!situation || !template) {
      return res.status(400).json({ message: 'situation and template required' });
    }

    const apologyTemplate = await apologyIntelligenceService.createApologyTemplate(teamId, {
      situation,
      isSpecific,
      template,
      followUpAction,
    });

    res.status(201).json({ data: apologyTemplate });
  } catch (error) {
    logger.error('Error creating apology template', error);
    next(error);
  }
});

/**
 * PUT /api/apologies/templates/:id
 * Update an apology template
 */
router.put('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { situation, isSpecific, template, followUpAction, isActive } = req.body;

    const { prisma } = await import('../db/client');

    const apologyTemplate = await prisma.apologyTemplate.update({
      where: { id },
      data: {
        ...(situation && { situation }),
        ...(isSpecific !== undefined && { isSpecific }),
        ...(template && { template }),
        ...(followUpAction !== undefined && { followUpAction }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ data: apologyTemplate });
  } catch (error) {
    logger.error('Error updating apology template', error);
    next(error);
  }
});

/**
 * DELETE /api/apologies/templates/:id
 * Delete an apology template (soft delete via isActive)
 */
router.delete('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { prisma } = await import('../db/client');

    await prisma.apologyTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Template deactivated' });
  } catch (error) {
    logger.error('Error deleting apology template', error);
    next(error);
  }
});

/**
 * POST /api/apologies/templates/:id/effectiveness
 * Update template effectiveness based on customer reaction
 */
router.post('/templates/:id/effectiveness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { customerReaction } = req.body;

    if (!customerReaction || !['positive', 'neutral', 'negative'].includes(customerReaction)) {
      return res.status(400).json({ message: 'customerReaction required (positive/neutral/negative)' });
    }

    await apologyIntelligenceService.updateTemplateEffectiveness(id, customerReaction);

    res.json({ message: 'Effectiveness updated' });
  } catch (error) {
    logger.error('Error updating apology template effectiveness', error);
    next(error);
  }
});

/**
 * GET /api/apologies/situations
 * Get list of predefined apology situations
 */
router.get('/situations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const situations = apologyIntelligenceService.getSituations();

    res.json({
      data: situations.map(s => ({
        value: s,
        label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      })),
    });
  } catch (error) {
    logger.error('Error getting apology situations', error);
    next(error);
  }
});

/**
 * POST /api/apologies/detect
 * Detect if apology situation exists in text
 */
router.post('/detect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ message: 'transcript required' });
    }

    const situation = apologyIntelligenceService.detectApologySituation(transcript);

    res.json({
      data: {
        situationDetected: !!situation,
        situation,
      },
    });
  } catch (error) {
    logger.error('Error detecting apology situation', error);
    next(error);
  }
});

/**
 * POST /api/apologies/generate
 * Generate an apology for a given situation
 */
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = extractTeamId(req);
    const { streamSid, situation, useSpecific } = req.body;

    if (!teamId || !streamSid || !situation) {
      return res.status(400).json({ message: 'teamId, streamSid, and situation required' });
    }

    const apology = await apologyIntelligenceService.generateApology(
      streamSid,
      teamId,
      situation,
      useSpecific !== false
    );

    res.json({ data: apology });
  } catch (error) {
    logger.error('Error generating apology', error);
    next(error);
  }
});

/**
 * POST /api/apologies/check
 * Check if apology is appropriate for context
 */
router.post('/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid, transcript, isRepeatIssue, callCount, waitTime } = req.body;

    if (!streamSid || !transcript) {
      return res.status(400).json({ message: 'streamSid and transcript required' });
    }

    const decision = apologyIntelligenceService.isApologyAppropriate(streamSid, {
      transcript,
      isRepeatIssue,
      callCount,
      waitTime,
    });

    res.json({ data: decision });
  } catch (error) {
    logger.error('Error checking apology appropriateness', error);
    next(error);
  }
});

export default router;
