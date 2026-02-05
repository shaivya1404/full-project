import { Router, Request, Response } from 'express';
import { followUpSequenceService, TriggerEvent, ActionType } from '../services/followUpSequenceService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// SEQUENCE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/follow-up/sequences
 * List all sequences for team
 */
router.get('/sequences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { campaignId } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const sequences = await followUpSequenceService.listSequences(
      teamId,
      campaignId as string | undefined
    );

    res.json({ data: sequences });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching sequences',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/follow-up/sequences/:id
 * Get sequence by ID
 */
router.get('/sequences/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sequence = await followUpSequenceService.getSequence(req.params.id);

    if (!sequence) {
      return res.status(404).json({ message: 'Sequence not found' });
    }

    res.json({ data: sequence });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching sequence',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/follow-up/sequences
 * Create a new sequence
 */
router.post('/sequences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { name, description, campaignId, triggerEvent, isActive, priority, maxExecutions, cooldownHours } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    if (!name || !triggerEvent) {
      return res.status(400).json({ message: 'Name and triggerEvent are required' });
    }

    const sequence = await followUpSequenceService.createSequence({
      teamId,
      name,
      description,
      campaignId,
      triggerEvent: triggerEvent as TriggerEvent,
      isActive,
      priority,
      maxExecutions,
      cooldownHours,
    });

    res.status(201).json({ data: sequence });
  } catch (error) {
    res.status(500).json({
      message: 'Error creating sequence',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/follow-up/sequences/:id
 * Update a sequence
 */
router.put('/sequences/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, triggerEvent, isActive, priority, maxExecutions, cooldownHours } = req.body;

    const sequence = await followUpSequenceService.updateSequence(req.params.id, {
      name,
      description,
      triggerEvent,
      isActive,
      priority,
      maxExecutions,
      cooldownHours,
    });

    res.json({ data: sequence });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating sequence',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/follow-up/sequences/:id
 * Delete a sequence
 */
router.delete('/sequences/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await followUpSequenceService.deleteSequence(req.params.id);
    res.json({ message: 'Sequence deleted' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting sequence',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/follow-up/sequences/:id/analytics
 * Get sequence analytics
 */
router.get('/sequences/:id/analytics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const analytics = await followUpSequenceService.getSequenceAnalytics(req.params.id);
    res.json({ data: analytics });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STEP ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/follow-up/sequences/:sequenceId/steps
 * Add a step to sequence
 */
router.post('/sequences/:sequenceId/steps', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sequenceId } = req.params;
    const {
      stepOrder,
      actionType,
      delayMinutes,
      delayType,
      specificTime,
      templateContent,
      subject,
      callbackPriority,
      conditions,
      skipIfContacted,
    } = req.body;

    if (!actionType || stepOrder === undefined) {
      return res.status(400).json({ message: 'actionType and stepOrder are required' });
    }

    const step = await followUpSequenceService.addStep({
      sequenceId,
      stepOrder,
      actionType: actionType as ActionType,
      delayMinutes,
      delayType,
      specificTime,
      templateContent,
      subject,
      callbackPriority,
      conditions,
      skipIfContacted,
    });

    res.status(201).json({ data: step });
  } catch (error) {
    res.status(500).json({
      message: 'Error adding step',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/follow-up/steps/:id
 * Update a step
 */
router.put('/steps/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const step = await followUpSequenceService.updateStep(req.params.id, req.body);
    res.json({ data: step });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating step',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/follow-up/steps/:id
 * Delete a step
 */
router.delete('/steps/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await followUpSequenceService.deleteStep(req.params.id);
    res.json({ message: 'Step deleted' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting step',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/follow-up/sequences/:sequenceId/reorder
 * Reorder steps
 */
router.post('/sequences/:sequenceId/reorder', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { stepIds } = req.body;

    if (!Array.isArray(stepIds)) {
      return res.status(400).json({ message: 'stepIds array required' });
    }

    await followUpSequenceService.reorderSteps(req.params.sequenceId, stepIds);
    res.json({ message: 'Steps reordered' });
  } catch (error) {
    res.status(500).json({
      message: 'Error reordering steps',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/follow-up/trigger
 * Manually trigger a follow-up for a contact
 */
router.post('/trigger', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { triggerEvent, contactId, callLogId, campaignId } = req.body;

    if (!triggerEvent || !contactId) {
      return res.status(400).json({ message: 'triggerEvent and contactId are required' });
    }

    const executions = await followUpSequenceService.triggerSequence(
      triggerEvent as TriggerEvent,
      contactId,
      callLogId,
      campaignId
    );

    res.json({
      data: executions,
      message: executions?.length ? `Triggered ${executions.length} sequence(s)` : 'No matching sequences',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error triggering sequence',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/follow-up/executions/:id/cancel
 * Cancel an execution
 */
router.post('/executions/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    await followUpSequenceService.cancelExecution(req.params.id, reason || 'Manually cancelled');
    res.json({ message: 'Execution cancelled' });
  } catch (error) {
    res.status(500).json({
      message: 'Error cancelling execution',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/follow-up/process
 * Process scheduled steps (for cron job)
 */
router.post('/process', authMiddleware, async (req: Request, res: Response) => {
  try {
    const processed = await followUpSequenceService.processScheduledSteps();
    res.json({ message: `Processed ${processed} steps` });
  } catch (error) {
    res.status(500).json({
      message: 'Error processing steps',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/follow-up/template-variables
 * Get available template variables
 */
router.get('/template-variables', authMiddleware, (req: Request, res: Response) => {
  res.json({ data: followUpSequenceService.getTemplateVariables() });
});

export default router;
