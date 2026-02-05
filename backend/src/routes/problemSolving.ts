import { Router, Request, Response, NextFunction } from 'express';
import { rootCauseService } from '../services/rootCauseService';
import { proactiveProblemService } from '../services/proactiveProblemService';
import { actionAuthorityService } from '../services/actionAuthorityService';
import { smartSuggestionService } from '../services/smartSuggestionService';
import { customerEducationService } from '../services/customerEducationService';
import { logger } from '../utils/logger';

const router = Router();

// Helper to extract teamId
const extractTeamId = (req: Request): string | undefined => {
  return (req as any).user?.teamId || req.body.teamId || req.query.teamId as string;
};

// ==================== ROOT CAUSE ANALYSIS ====================

/**
 * POST /api/problem-solving/analyze
 * Analyze conversation to identify root cause
 */
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transcript, context } = req.body;

    if (!transcript) {
      return res.status(400).json({ message: 'transcript required' });
    }

    const analysis = rootCauseService.analyzeConversation(transcript, context);

    res.json({ data: analysis });
  } catch (error) {
    logger.error('Error analyzing conversation', error);
    next(error);
  }
});

/**
 * POST /api/problem-solving/analyze/severity
 * Analyze issue severity
 */
router.post('/analyze/severity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analysis, customerContext } = req.body;

    if (!analysis) {
      return res.status(400).json({ message: 'analysis required' });
    }

    const severity = rootCauseService.analyzeSeverity(analysis, customerContext);
    const recommendedActions = rootCauseService.getRecommendedActions(analysis);

    res.json({
      data: {
        severity,
        recommendedActions,
      },
    });
  } catch (error) {
    logger.error('Error analyzing severity', error);
    next(error);
  }
});

/**
 * GET /api/problem-solving/history/:customerId
 * Get related past issues for a customer
 */
router.get('/history/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const { problemType } = req.query;

    const pastIssues = await rootCauseService.getRelatedPastIssues(
      customerId,
      problemType as any
    );

    res.json({ data: pastIssues });
  } catch (error) {
    logger.error('Error getting past issues', error);
    next(error);
  }
});

// ==================== PROACTIVE PROBLEMS ====================

/**
 * GET /api/problem-solving/proactive/:customerId
 * Detect potential problems for a customer
 */
router.get('/proactive/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const teamId = extractTeamId(req);
    const { phone } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const problems = await proactiveProblemService.detectProblems(
      customerId,
      teamId,
      phone as string | undefined
    );

    const proactiveMessage = proactiveProblemService.generateProactiveMessage(problems);

    res.json({
      data: {
        problems,
        proactiveMessage,
      },
    });
  } catch (error) {
    logger.error('Error detecting proactive problems', error);
    next(error);
  }
});

/**
 * GET /api/problem-solving/risk-profile/:customerId
 * Get customer risk profile
 */
router.get('/risk-profile/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const teamId = extractTeamId(req);

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const riskProfile = await proactiveProblemService.buildRiskProfile(customerId, teamId);

    res.json({ data: riskProfile });
  } catch (error) {
    logger.error('Error getting risk profile', error);
    next(error);
  }
});

// ==================== ACTION AUTHORITY ====================

/**
 * POST /api/problem-solving/action/check
 * Check if an action can be performed
 */
router.post('/action/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actionType, context } = req.body;

    if (!actionType) {
      return res.status(400).json({ message: 'actionType required' });
    }

    const canPerform = actionAuthorityService.canPerformAction(actionType, context || {});

    res.json({ data: canPerform });
  } catch (error) {
    logger.error('Error checking action authority', error);
    next(error);
  }
});

/**
 * POST /api/problem-solving/action/execute
 * Execute an action
 */
router.post('/action/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId, actionType, entityId, entityType, parameters, reason } = req.body;

    if (!callId || !actionType || !entityId) {
      return res.status(400).json({ message: 'callId, actionType, and entityId required' });
    }

    const result = await actionAuthorityService.executeAction(
      {
        type: actionType,
        entityId,
        entityType: entityType || 'order',
        parameters: parameters || {},
        reason: reason || 'Customer request',
        requestedBy: 'ai',
      },
      callId
    );

    res.json({ data: result });
  } catch (error) {
    logger.error('Error executing action', error);
    next(error);
  }
});

/**
 * GET /api/problem-solving/action/available/:entityType
 * Get available actions for an entity type
 */
router.get('/action/available/:entityType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType } = req.params;
    const { status } = req.query;

    const actions = actionAuthorityService.getAvailableActions(entityType, status as string);

    res.json({ data: actions });
  } catch (error) {
    logger.error('Error getting available actions', error);
    next(error);
  }
});

// ==================== SMART SUGGESTIONS ====================

/**
 * POST /api/problem-solving/suggestions
 * Generate smart suggestions
 */
router.post('/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = extractTeamId(req);
    const { customerId, currentOrderId, callReason, customerSentiment, conversationStage } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const suggestions = await smartSuggestionService.generateSuggestions({
      customerId,
      currentOrderId,
      callReason,
      customerSentiment,
      conversationStage,
      teamId,
    });

    res.json({ data: suggestions });
  } catch (error) {
    logger.error('Error generating suggestions', error);
    next(error);
  }
});

/**
 * GET /api/problem-solving/recommendations/:customerId
 * Get product recommendations for a customer
 */
router.get('/recommendations/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const { limit } = req.query;

    const recommendations = await smartSuggestionService.getProductRecommendations(
      customerId,
      limit ? parseInt(limit as string) : 5
    );

    res.json({ data: recommendations });
  } catch (error) {
    logger.error('Error getting recommendations', error);
    next(error);
  }
});

/**
 * POST /api/problem-solving/suggestions/should-suggest
 * Check if it's appropriate to make a suggestion
 */
router.post('/suggestions/should-suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationStage, customerSentiment, problemResolved } = req.body;

    const result = smartSuggestionService.shouldMakeSuggestion(
      conversationStage || 'unknown',
      customerSentiment ?? 0.5,
      problemResolved ?? true
    );

    res.json({ data: result });
  } catch (error) {
    logger.error('Error checking suggestion timing', error);
    next(error);
  }
});

// ==================== CUSTOMER EDUCATION ====================

/**
 * GET /api/problem-solving/education/topics
 * Get available education topics
 */
router.get('/education/topics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topics = customerEducationService.getAvailableTopics();
    res.json({ data: topics });
  } catch (error) {
    logger.error('Error getting education topics', error);
    next(error);
  }
});

/**
 * GET /api/problem-solving/education/topic/:topicKey
 * Get education content by topic key
 */
router.get('/education/topic/:topicKey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topicKey } = req.params;
    const content = customerEducationService.getContent(topicKey);

    if (!content) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    res.json({ data: content });
  } catch (error) {
    logger.error('Error getting education content', error);
    next(error);
  }
});

/**
 * POST /api/problem-solving/education/start
 * Start an education session
 */
router.post('/education/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, callId, topicKey } = req.body;

    if (!customerId || !callId || !topicKey) {
      return res.status(400).json({ message: 'customerId, callId, and topicKey required' });
    }

    const result = customerEducationService.startSession(customerId, callId, topicKey);

    if (!result) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    res.status(201).json({
      data: {
        session: result.session,
        content: result.content,
        firstStep: result.content.steps[0],
      },
    });
  } catch (error) {
    logger.error('Error starting education session', error);
    next(error);
  }
});

/**
 * POST /api/problem-solving/education/:callId/next
 * Move to next step in education
 */
router.post('/education/:callId/next', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;

    const result = customerEducationService.nextStep(callId);

    if (!result) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({
      data: {
        step: result.step,
        isComplete: result.isComplete,
        session: result.session,
      },
    });
  } catch (error) {
    logger.error('Error advancing education session', error);
    next(error);
  }
});

/**
 * GET /api/problem-solving/education/:callId/current
 * Get current step in education
 */
router.get('/education/:callId/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;

    const result = customerEducationService.getCurrentStep(callId);

    if (!result) {
      return res.status(404).json({ message: 'No active session' });
    }

    const progress = customerEducationService.getProgress(callId);

    res.json({
      data: {
        step: result.step,
        session: result.session,
        progress,
      },
    });
  } catch (error) {
    logger.error('Error getting current step', error);
    next(error);
  }
});

/**
 * POST /api/problem-solving/education/:callId/end
 * End education session
 */
router.post('/education/:callId/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.params;
    const { feedback } = req.body;

    customerEducationService.endSession(callId, feedback);

    res.json({ message: 'Session ended' });
  } catch (error) {
    logger.error('Error ending education session', error);
    next(error);
  }
});

/**
 * POST /api/problem-solving/education/detect-confusion
 * Detect customer confusion from transcript
 */
router.post('/education/detect-confusion', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ message: 'transcript required' });
    }

    const confusion = customerEducationService.detectConfusion(transcript);

    res.json({ data: confusion });
  } catch (error) {
    logger.error('Error detecting confusion', error);
    next(error);
  }
});

/**
 * POST /api/problem-solving/education/find-topic
 * Find relevant topic based on question
 */
router.post('/education/find-topic', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ message: 'question required' });
    }

    const result = customerEducationService.findRelevantTopic(question);

    res.json({ data: result });
  } catch (error) {
    logger.error('Error finding topic', error);
    next(error);
  }
});

export default router;
