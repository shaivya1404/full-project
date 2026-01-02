import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { KnowledgeService } from '../services/knowledgeService';
import { PromptService } from '../services/promptService';
import { logger } from '../utils/logger';

const router = Router();
let knowledgeService: KnowledgeService;
let promptService: PromptService;

const getServices = () => {
  if (!knowledgeService) {
    knowledgeService = new KnowledgeService();
  }
  if (!promptService) {
    promptService = new PromptService();
  }
  return { knowledgeService, promptService };
};

interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
}

// POST /api/calls/:id/knowledge-context - Get knowledge context for a call
router.post('/calls/:id/knowledge-context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { teamId, campaignId, templateId } = req.body;

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { knowledgeService: ks } = getServices();
    const knowledgeContext = await ks.getKnowledgeContext(id, teamId);

    res.status(200).json({
      data: knowledgeContext,
      metadata: {
        callId: id,
        teamId,
        campaignId,
        templateId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting knowledge context', error);
    next(error);
  }
});

// GET /api/calls/:id/knowledge-used - Get knowledge referenced in call
router.get('/calls/:id/knowledge-used', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { knowledgeService: ks } = getServices();

    // This would need to be implemented in the repository
    const knowledgeUsed = await ks.getKnowledgeUsedForCall(id);

    res.status(200).json({
      data: knowledgeUsed,
    });
  } catch (error) {
    logger.error('Error getting knowledge used in call', error);
    next(error);
  }
});

// POST /api/knowledge-base/relevant-search - Search for relevant knowledge
router.post('/knowledge-base/relevant-search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, teamId, limit } = req.body;

    if (!query || !teamId) {
      return res.status(400).json({
        message: 'Query and team ID are required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { knowledgeService: ks } = getServices();
    const results = await ks.searchRelevantKnowledge(query, teamId, limit || 5);

    res.status(200).json({
      data: results,
      metadata: {
        query,
        teamId,
        limit: limit || 5,
        resultCount: results.length,
      },
    });
  } catch (error) {
    logger.error('Error searching relevant knowledge', error);
    next(error);
  }
});

// PATCH /api/campaigns/:id/system-prompt - Update campaign AI prompt
router.patch('/campaigns/:id/system-prompt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { script, templateId } = req.body;

    if (!script) {
      return res.status(400).json({
        message: 'Script is required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { promptService: ps } = getServices();
    await ps.updateCampaignPrompt(id, script, templateId);

    res.status(200).json({
      message: 'Campaign system prompt updated successfully',
      data: {
        campaignId: id,
        script,
        templateId,
      },
    });
  } catch (error) {
    logger.error('Error updating campaign system prompt', error);
    next(error);
  }
});

// GET /api/campaigns/:id/system-prompt - Get campaign prompt
router.get('/campaigns/:id/system-prompt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { promptService: ps } = getServices();

    const promptData = await ps.getCampaignPrompt(id);

    res.status(200).json({
      data: promptData,
    });
  } catch (error) {
    logger.error('Error getting campaign prompt', error);
    next(error);
  }
});

// GET /api/knowledge-base/templates - Get available prompt templates
router.get('/knowledge-base/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promptService: ps } = getServices();
    const templates = ps.getAvailableTemplates();

    res.status(200).json({
      data: templates,
    });
  } catch (error) {
    logger.error('Error getting prompt templates', error);
    next(error);
  }
});

// POST /api/knowledge-base/confidence-score - Calculate confidence score for response
router.post('/knowledge-base/confidence-score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { knowledgeContext, responseSources } = req.body;

    if (!knowledgeContext || !responseSources) {
      return res.status(400).json({
        message: 'Knowledge context and response sources are required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { knowledgeService: ks } = getServices();
    const confidenceScore = ks.calculateConfidenceScore(knowledgeContext, responseSources);

    res.status(200).json({
      data: confidenceScore,
    });
  } catch (error) {
    logger.error('Error calculating confidence score', error);
    next(error);
  }
});

// POST /api/knowledge-base/track-unanswered - Track unanswered question
router.post('/knowledge-base/track-unanswered', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        message: 'Question is required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { knowledgeService: ks } = getServices();
    await ks.trackUnansweredQuestion(question);

    res.status(200).json({
      message: 'Unanswered question tracked successfully',
    });
  } catch (error) {
    logger.error('Error tracking unanswered question', error);
    next(error);
  }
});

// GET /api/knowledge-base/unanswered-questions - Get unanswered questions
router.get('/knowledge-base/unanswered-questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    // This would need to be implemented in the repository
    const unansweredQuestions = await knowledgeService!.getUnansweredQuestions(
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.status(200).json({
      data: unansweredQuestions.questions,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: unansweredQuestions.total,
      },
    });
  } catch (error) {
    logger.error('Error getting unanswered questions', error);
    next(error);
  }
});

// GET /api/knowledge-base/analytics - Get knowledge usage analytics
router.get('/knowledge-base/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, startDate, endDate } = req.query;

    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    // This would need to be implemented in the repository
    const analytics = await knowledgeService!.getKnowledgeAnalytics(
      teamId,
      startDate as string,
      endDate as string
    );

    res.status(200).json({
      data: analytics,
    });
  } catch (error) {
    logger.error('Error getting knowledge analytics', error);
    next(error);
  }
});

// POST /api/calls/:id/initialize-knowledge - Initialize knowledge for call
router.post('/calls/:id/initialize-knowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { teamId, campaignId, templateId } = req.body;

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { promptService: ps } = getServices();
    const dynamicPrompt = await ps.generateDynamicPrompt(id, teamId, campaignId, templateId);

    res.status(200).json({
      message: 'Knowledge initialized for call successfully',
      data: {
        callId: id,
        teamId,
        campaignId,
        templateId,
        dynamicPrompt,
      },
    });
  } catch (error) {
    logger.error('Error initializing knowledge for call', error);
    next(error);
  }
});

export default router;