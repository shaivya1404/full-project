import { Router, Request, Response } from 'express';
import { complaintService } from '../services/complaintService';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// ═══════════════════════════════════════════════════════════════════════════
// COMPLAINTS CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/complaints
 * Create a new complaint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const complaint = await complaintService.createComplaint(req.body);
    res.status(201).json({ data: complaint });
  } catch (error) {
    logger.error('Error creating complaint', error);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
});

/**
 * GET /api/complaints
 * List complaints with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      teamId, status, priority, category, assignedTo,
      customerId, search, dateFrom, dateTo, slaBreach,
      limit, offset,
    } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }

    const result = await complaintService.listComplaints(
      {
        teamId: teamId as string,
        status: status as string,
        priority: priority as string,
        category: category as string,
        assignedTo: assignedTo as string,
        customerId: customerId as string,
        search: search as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        slaBreach: slaBreach === 'true',
      },
      limit ? parseInt(limit as string) : 50,
      offset ? parseInt(offset as string) : 0
    );

    res.json({ data: result.complaints, total: result.total });
  } catch (error) {
    logger.error('Error listing complaints', error);
    res.status(500).json({ error: 'Failed to list complaints' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SPECIFIC ROUTES (must come BEFORE /:id to avoid being swallowed)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/complaints/ticket/:ticketNumber
 * Get a complaint by ticket number
 */
router.get('/ticket/:ticketNumber', async (req: Request, res: Response) => {
  try {
    const complaint = await complaintService.getByTicketNumber(req.params.ticketNumber);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    res.json({ data: complaint });
  } catch (error) {
    logger.error('Error getting complaint by ticket', error);
    res.status(500).json({ error: 'Failed to get complaint' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SLA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/complaints/sla/check
 * Check SLA breaches
 */
router.post('/sla/check', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.body;
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    const breachedCount = await complaintService.checkSlaBreaches(teamId);
    res.json({ data: { breachedCount } });
  } catch (error) {
    logger.error('Error checking SLA', error);
    res.status(500).json({ error: 'Failed to check SLA' });
  }
});

/**
 * GET /api/complaints/sla/breached
 * Get SLA-breached complaints
 */
router.get('/sla/breached', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    const complaints = await complaintService.getSlaBreachedComplaints(teamId as string);
    res.json({ data: complaints });
  } catch (error) {
    logger.error('Error getting breached complaints', error);
    res.status(500).json({ error: 'Failed to get breached complaints' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/complaints/categories
 * Get complaint categories
 */
router.get('/categories/list', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    const categories = await complaintService.getCategories(teamId as string);
    res.json({ data: categories });
  } catch (error) {
    logger.error('Error getting categories', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * POST /api/complaints/categories
 * Create a complaint category
 */
router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { teamId, ...data } = req.body;
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    const category = await complaintService.createCategory(teamId, data);
    res.status(201).json({ data: category });
  } catch (error) {
    logger.error('Error creating category', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * PUT /api/complaints/categories/:id
 * Update a complaint category
 */
router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const category = await complaintService.updateCategory(req.params.id, req.body);
    res.json({ data: category });
  } catch (error) {
    logger.error('Error updating category', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

/**
 * DELETE /api/complaints/categories/:id
 * Delete a complaint category
 */
router.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    await complaintService.deleteCategory(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    logger.error('Error deleting category', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/complaints/stats
 * Get complaint statistics
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { teamId, dateFrom, dateTo } = req.query;
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    const stats = await complaintService.getStats(
      teamId as string,
      dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo ? new Date(dateTo as string) : undefined
    );
    res.json({ data: stats });
  } catch (error) {
    logger.error('Error getting complaint stats', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC :id ROUTES (must come AFTER all specific routes above)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/complaints/:id
 * Get a complaint by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const complaint = await complaintService.getComplaint(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    res.json({ data: complaint });
  } catch (error) {
    logger.error('Error getting complaint', error);
    res.status(500).json({ error: 'Failed to get complaint' });
  }
});

/**
 * PUT /api/complaints/:id
 * Update a complaint
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.firstName || 'Agent';
    const complaint = await complaintService.updateComplaint(
      req.params.id,
      req.body,
      userId,
      userName
    );
    res.json({ data: complaint });
  } catch (error) {
    logger.error('Error updating complaint', error);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ASSIGNMENT & RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/complaints/:id/assign
 * Assign complaint to an agent
 */
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { agentId, agentName } = req.body;
    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }
    const userId = (req as any).user?.id;
    const complaint = await complaintService.assignComplaint(
      req.params.id,
      agentId,
      agentName || 'Agent',
      userId
    );
    res.json({ data: complaint });
  } catch (error) {
    logger.error('Error assigning complaint', error);
    res.status(500).json({ error: 'Failed to assign complaint' });
  }
});

/**
 * POST /api/complaints/:id/resolve
 * Resolve a complaint
 */
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { resolution, resolutionType, compensationAmount } = req.body;
    if (!resolution || !resolutionType) {
      return res.status(400).json({ error: 'resolution and resolutionType are required' });
    }
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.firstName || 'Agent';
    const complaint = await complaintService.resolveComplaint(
      req.params.id,
      resolution,
      resolutionType,
      userId,
      userName,
      compensationAmount
    );
    res.json({ data: complaint });
  } catch (error) {
    logger.error('Error resolving complaint', error);
    res.status(500).json({ error: 'Failed to resolve complaint' });
  }
});

/**
 * POST /api/complaints/:id/close
 * Close a complaint
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.firstName || 'Agent';
    const complaint = await complaintService.closeComplaint(req.params.id, userId, userName);
    res.json({ data: complaint });
  } catch (error) {
    logger.error('Error closing complaint', error);
    res.status(500).json({ error: 'Failed to close complaint' });
  }
});

/**
 * POST /api/complaints/:id/reopen
 * Reopen a complaint
 */
router.post('/:id/reopen', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.firstName || 'Agent';
    const complaint = await complaintService.reopenComplaint(req.params.id, reason, userId, userName);
    res.json({ data: complaint });
  } catch (error) {
    logger.error('Error reopening complaint', error);
    res.status(500).json({ error: 'Failed to reopen complaint' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/complaints/:id/comments
 * Add a comment to a complaint
 */
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { content, isInternal } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.firstName || 'Agent';
    const comment = await complaintService.addComment(
      req.params.id,
      userId,
      userName,
      'agent',
      content,
      isInternal
    );
    res.status(201).json({ data: comment });
  } catch (error) {
    logger.error('Error adding comment', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/complaints/:id/comments
 * Get comments for a complaint
 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const includeInternal = req.query.includeInternal !== 'false';
    const comments = await complaintService.getComments(req.params.id, includeInternal);
    res.json({ data: comments });
  } catch (error) {
    logger.error('Error getting comments', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/complaints/:id/feedback
 * Record customer feedback
 */
router.post('/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { satisfied, score, comment } = req.body;
    if (satisfied === undefined || !score) {
      return res.status(400).json({ error: 'satisfied and score are required' });
    }
    const complaint = await complaintService.recordFeedback(req.params.id, satisfied, score, comment);
    res.json({ data: complaint });
  } catch (error) {
    logger.error('Error recording feedback', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

export default router;
