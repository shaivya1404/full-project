import { Router, Request, Response } from 'express';
import { objectionService } from '../services/objectionService';
import { logger } from '../utils/logger';

const router = Router();

// Get objection types
router.get('/types', async (req: Request, res: Response) => {
  try {
    const types = objectionService.getObjectionTypes();
    res.status(200).json({ data: types });
  } catch (error) {
    logger.error('Error getting objection types', error);
    res.status(500).json({
      message: 'Error getting objection types',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get templates for a team
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const templates = await objectionService.getTemplates(teamId as string);
    res.status(200).json({ data: templates });
  } catch (error) {
    logger.error('Error getting templates', error);
    res.status(500).json({
      message: 'Error getting templates',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Create template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { teamId, objectionType, keywords, suggestedResponse } = req.body;

    if (!teamId || !objectionType || !keywords || !suggestedResponse) {
      return res.status(400).json({
        message: 'teamId, objectionType, keywords, and suggestedResponse are required'
      });
    }

    const template = await objectionService.createTemplate(
      teamId,
      objectionType,
      keywords,
      suggestedResponse
    );

    res.status(201).json({ data: template });
  } catch (error) {
    logger.error('Error creating template', error);
    res.status(500).json({
      message: 'Error creating template',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Update template
router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { keywords, suggestedResponse, isActive } = req.body;

    const template = await objectionService.updateTemplate(id, {
      keywords,
      suggestedResponse,
      isActive
    });

    res.status(200).json({ data: template });
  } catch (error) {
    logger.error('Error updating template', error);
    res.status(500).json({
      message: 'Error updating template',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Delete template
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await objectionService.deleteTemplate(id);

    res.status(200).json({ message: 'Template deleted' });
  } catch (error) {
    logger.error('Error deleting template', error);
    res.status(500).json({
      message: 'Error deleting template',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Detect objection in text
router.post('/detect', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'text is required' });
    }

    const result = objectionService.detectObjection(text);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error detecting objection', error);
    res.status(500).json({
      message: 'Error detecting objection',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get suggested response
router.get('/suggest', async (req: Request, res: Response) => {
  try {
    const { teamId, objectionType } = req.query;

    if (!teamId || !objectionType) {
      return res.status(400).json({ message: 'teamId and objectionType are required' });
    }

    const response = await objectionService.getSuggestedResponse(
      teamId as string,
      objectionType as string
    );

    res.status(200).json({ data: { suggestedResponse: response } });
  } catch (error) {
    logger.error('Error getting suggested response', error);
    res.status(500).json({
      message: 'Error getting suggested response',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Log objection from a call
router.post('/log', async (req: Request, res: Response) => {
  try {
    const { callLogId, objectionType, objectionText, responseUsed } = req.body;

    if (!callLogId || !objectionType) {
      return res.status(400).json({ message: 'callLogId and objectionType are required' });
    }

    await objectionService.logObjection(callLogId, objectionType, objectionText, responseUsed);

    res.status(201).json({ message: 'Objection logged' });
  } catch (error) {
    logger.error('Error logging objection', error);
    res.status(500).json({
      message: 'Error logging objection',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Resolve objection
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { responseUsed } = req.body;

    await objectionService.resolveObjection(id, responseUsed);

    res.status(200).json({ message: 'Objection resolved' });
  } catch (error) {
    logger.error('Error resolving objection', error);
    res.status(500).json({
      message: 'Error resolving objection',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get objection analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { teamId, startDate, endDate } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const analytics = await objectionService.getObjectionAnalytics(
      teamId as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.status(200).json({ data: analytics });
  } catch (error) {
    logger.error('Error getting objection analytics', error);
    res.status(500).json({
      message: 'Error getting objection analytics',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Update template success rate
router.post('/templates/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { wasSuccessful } = req.body;

    if (wasSuccessful === undefined) {
      return res.status(400).json({ message: 'wasSuccessful is required' });
    }

    await objectionService.updateTemplateSuccess(id, wasSuccessful);

    res.status(200).json({ message: 'Feedback recorded' });
  } catch (error) {
    logger.error('Error updating template success', error);
    res.status(500).json({
      message: 'Error updating template success',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

export default router;
