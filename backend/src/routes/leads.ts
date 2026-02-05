import { Router, Request, Response } from 'express';
import { leadScoringService } from '../services/leadScoringService';
import { logger } from '../utils/logger';

const router = Router();

// Get hot leads
router.get('/hot', async (req: Request, res: Response) => {
  try {
    const { campaignId, limit } = req.query;
    const leads = await leadScoringService.getHotLeads(
      campaignId as string,
      limit ? parseInt(limit as string, 10) : 50
    );

    res.status(200).json({ data: leads });
  } catch (error) {
    logger.error('Error getting hot leads', error);
    res.status(500).json({
      message: 'Error getting hot leads',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get leads by tier
router.get('/tier/:tier', async (req: Request, res: Response) => {
  try {
    const { tier } = req.params;
    const { campaignId, page, limit } = req.query;

    if (!['hot', 'warm', 'cold', 'unknown'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier' });
    }

    const result = await leadScoringService.getLeadsByTier(
      tier as any,
      campaignId as string,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 20
    );

    res.status(200).json({ data: result.leads, total: result.total });
  } catch (error) {
    logger.error('Error getting leads by tier', error);
    res.status(500).json({
      message: 'Error getting leads',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get lead score details
router.get('/:contactId/score', async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const scoreDetails = await leadScoringService.calculateLeadScore(contactId);

    res.status(200).json({ data: scoreDetails });
  } catch (error) {
    logger.error('Error getting lead score', error);
    res.status(500).json({
      message: 'Error getting lead score',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Recalculate lead score
router.post('/:contactId/recalculate', async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const scoreDetails = await leadScoringService.calculateLeadScore(contactId);

    res.status(200).json({ data: scoreDetails });
  } catch (error) {
    logger.error('Error recalculating lead score', error);
    res.status(500).json({
      message: 'Error recalculating lead score',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Bulk recalculate scores for a campaign
router.post('/campaign/:campaignId/recalculate', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await leadScoringService.bulkRecalculateScores(campaignId);

    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error bulk recalculating scores', error);
    res.status(500).json({
      message: 'Error bulk recalculating scores',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get lead analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { teamId, campaignId } = req.query;
    const analytics = await leadScoringService.getLeadAnalytics(
      teamId as string,
      campaignId as string
    );

    res.status(200).json({ data: analytics });
  } catch (error) {
    logger.error('Error getting lead analytics', error);
    res.status(500).json({
      message: 'Error getting lead analytics',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Detect buying signals in text
router.post('/detect-signals', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const signals = leadScoringService.detectBuyingSignals(text);

    res.status(200).json({ data: { signals } });
  } catch (error) {
    logger.error('Error detecting signals', error);
    res.status(500).json({
      message: 'Error detecting signals',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Score a call outcome
router.post('/score-call/:callLogId', async (req: Request, res: Response) => {
  try {
    const { callLogId } = req.params;
    await leadScoringService.scoreCallOutcome(callLogId);

    res.status(200).json({ message: 'Call outcome scored' });
  } catch (error) {
    logger.error('Error scoring call outcome', error);
    res.status(500).json({
      message: 'Error scoring call outcome',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

export default router;
