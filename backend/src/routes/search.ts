import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { searchService, SearchOptions } from '../services/searchService';
import { logger } from '../utils/logger';

const router = Router();

// Global search
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      q,
      types,
      limit = '20',
      offset = '0',
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const options: SearchOptions = {
      query: q.trim(),
      teamId: req.teamId,
      limit: Math.min(parseInt(limit as string) || 20, 100),
      offset: parseInt(offset as string) || 0,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
    };

    if (types && typeof types === 'string') {
      options.types = types.split(',') as any;
    }

    if (dateFrom) {
      options.dateFrom = new Date(dateFrom as string);
    }

    if (dateTo) {
      options.dateTo = new Date(dateTo as string);
    }

    const results = await searchService.search(options);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error in global search', error);
    next(error);
  }
});

// Quick search (limited results for autocomplete)
router.get('/quick', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json({
        success: true,
        data: { results: [], total: 0, facets: { type: {} }, took: 0 },
      });
    }

    const results = await searchService.search({
      query: q.trim(),
      teamId: req.teamId,
      limit: 10,
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error in quick search', error);
    next(error);
  }
});

export default router;
