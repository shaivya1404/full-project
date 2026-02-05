import { Router, Request, Response, NextFunction } from 'express';
import { customerMemoryService } from '../services/customerMemoryService';
import { logger } from '../utils/logger';

const router = Router();

// Helper to extract teamId
const extractTeamId = (req: Request): string | undefined => {
  return (req as any).user?.teamId || req.body.teamId || req.query.teamId as string;
};

/**
 * GET /api/memory/:customerId
 * Get all memories for a customer
 */
router.get('/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const teamId = extractTeamId(req);
    const { factType, activeOnly } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const memories = await customerMemoryService.getFacts(customerId, teamId, {
      factType: factType as any,
      activeOnly: activeOnly !== 'false',
    });

    res.json({ data: memories });
  } catch (error) {
    logger.error('Error getting customer memories', error);
    next(error);
  }
});

/**
 * GET /api/memory/:customerId/summary
 * Get memory summary for AI context
 */
router.get('/:customerId/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const teamId = extractTeamId(req);

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const summary = await customerMemoryService.getMemorySummary(customerId, teamId);
    const naturalSummary = await customerMemoryService.generateNaturalSummary(customerId, teamId);

    res.json({
      data: summary,
      naturalLanguage: naturalSummary,
    });
  } catch (error) {
    logger.error('Error getting memory summary', error);
    next(error);
  }
});

/**
 * POST /api/memory/:customerId
 * Add a new memory/fact
 */
router.post('/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const teamId = extractTeamId(req);
    const { factType, factKey, factValue, source, expiresAt } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    if (!factType || !factKey || !factValue || !source) {
      return res.status(400).json({ message: 'factType, factKey, factValue, and source required' });
    }

    const memory = await customerMemoryService.storeFact(customerId, teamId, {
      factType,
      factKey,
      factValue,
      source,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json({ data: memory });
  } catch (error) {
    logger.error('Error storing customer memory', error);
    next(error);
  }
});

/**
 * PUT /api/memory/:customerId/:memoryId
 * Update a memory
 */
router.put('/:customerId/:memoryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memoryId } = req.params;
    const { factValue, confidence, expiresAt } = req.body;

    const memory = await customerMemoryService.updateFact(memoryId, {
      factValue,
      confidence,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    res.json({ data: memory });
  } catch (error) {
    logger.error('Error updating customer memory', error);
    next(error);
  }
});

/**
 * DELETE /api/memory/:customerId/:memoryId
 * Deactivate a memory (soft delete)
 */
router.delete('/:customerId/:memoryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memoryId } = req.params;

    await customerMemoryService.expireFact(memoryId);

    res.json({ message: 'Memory deactivated' });
  } catch (error) {
    logger.error('Error deactivating customer memory', error);
    next(error);
  }
});

/**
 * GET /api/memory/:customerId/promises
 * Get unfulfilled promises
 */
router.get('/:customerId/promises', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const teamId = extractTeamId(req);

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const promises = await customerMemoryService.checkUnfulfilledPromises(customerId, teamId);

    res.json({ data: promises });
  } catch (error) {
    logger.error('Error getting unfulfilled promises', error);
    next(error);
  }
});

/**
 * POST /api/memory/:customerId/promises/:memoryId/fulfill
 * Mark a promise as fulfilled
 */
router.post('/:customerId/promises/:memoryId/fulfill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memoryId } = req.params;

    await customerMemoryService.fulfillPromise(memoryId);

    res.json({ message: 'Promise marked as fulfilled' });
  } catch (error) {
    logger.error('Error fulfilling promise', error);
    next(error);
  }
});

export default router;
