import { Router, Request, Response } from 'express';
import { loyaltyService, RewardType } from '../services/loyaltyService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// PROGRAM ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/loyalty/program
 * Get loyalty program for team
 */
router.get('/program', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const program = await loyaltyService.getOrCreateProgram(teamId);
    res.json({ data: program });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching program',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/loyalty/program
 * Update loyalty program settings
 */
router.put('/program', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const program = await loyaltyService.updateProgram(teamId, req.body);
    res.json({ data: program });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating program',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/loyalty/program/analytics
 * Get program analytics
 */
router.get('/program/analytics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const analytics = await loyaltyService.getProgramAnalytics(teamId);
    res.json({ data: analytics });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/loyalty/tiers
 * Create a tier
 */
router.post('/tiers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { programId, name, minPoints, maxPoints, multiplier, benefits, color, icon, tierOrder } = req.body;

    if (!programId || !name || minPoints === undefined) {
      return res.status(400).json({ message: 'programId, name, and minPoints are required' });
    }

    const tier = await loyaltyService.createTier({
      programId,
      name,
      minPoints,
      maxPoints,
      multiplier,
      benefits,
      color,
      icon,
      tierOrder,
    });

    res.status(201).json({ data: tier });
  } catch (error) {
    res.status(500).json({
      message: 'Error creating tier',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/loyalty/tiers/:id
 * Update a tier
 */
router.put('/tiers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tier = await loyaltyService.updateTier(req.params.id, req.body);
    res.json({ data: tier });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating tier',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/loyalty/tiers/:id
 * Delete a tier
 */
router.delete('/tiers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await loyaltyService.deleteTier(req.params.id);
    res.json({ message: 'Tier deleted' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting tier',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER LOYALTY ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/loyalty/customers/:customerId
 * Get customer loyalty summary
 */
router.get('/customers/:customerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const summary = await loyaltyService.getCustomerSummary(req.params.customerId, teamId);
    res.json({ data: summary });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching customer loyalty',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/loyalty/customers/:customerId/transactions
 * Get customer transaction history
 */
router.get('/customers/:customerId/transactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const result = await loyaltyService.getTransactionHistory(
      req.params.customerId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({ data: result.transactions, total: result.total });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching transactions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/loyalty/customers/:customerId/rewards
 * Get available rewards for customer
 */
router.get('/customers/:customerId/rewards', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const rewards = await loyaltyService.getAvailableRewards(req.params.customerId, teamId);
    res.json({ data: rewards });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching rewards',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/loyalty/customers/:customerId/earn
 * Earn points from order
 */
router.post('/customers/:customerId/earn', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { orderId, orderAmount } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    if (!orderId || orderAmount === undefined) {
      return res.status(400).json({ message: 'orderId and orderAmount are required' });
    }

    const transaction = await loyaltyService.earnPoints(
      req.params.customerId,
      teamId,
      orderId,
      orderAmount
    );

    res.json({
      data: transaction,
      message: transaction ? `Earned ${transaction.points} points` : 'No points earned',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error earning points',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/loyalty/customers/:customerId/redeem
 * Redeem a reward
 */
router.post('/customers/:customerId/redeem', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { rewardId } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    if (!rewardId) {
      return res.status(400).json({ message: 'rewardId is required' });
    }

    const redemption = await loyaltyService.redeemReward(req.params.customerId, teamId, rewardId);

    res.json({
      data: redemption,
      message: `Redeemed ${redemption.reward.name}. Code: ${redemption.code}`,
    });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : 'Error redeeming reward',
    });
  }
});

/**
 * POST /api/loyalty/customers/:customerId/bonus
 * Award bonus points
 */
router.post('/customers/:customerId/bonus', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { points, type, description } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    if (!points || !type) {
      return res.status(400).json({ message: 'points and type are required' });
    }

    const loyalty = await loyaltyService.getOrCreateCustomerLoyalty(req.params.customerId, teamId);
    const result = await loyaltyService.awardBonus(
      loyalty.id,
      points,
      type,
      description || 'Manual bonus'
    );

    res.json({
      data: result,
      message: `Awarded ${points} bonus points`,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error awarding bonus',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REWARD ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/loyalty/rewards
 * List rewards for program
 */
router.get('/rewards', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { activeOnly = 'true' } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const program = await loyaltyService.getOrCreateProgram(teamId);
    const rewards = await loyaltyService.listRewards(program.id, activeOnly === 'true');

    res.json({ data: rewards });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching rewards',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/loyalty/rewards
 * Create a reward
 */
router.post('/rewards', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    const program = await loyaltyService.getOrCreateProgram(teamId);

    const {
      name,
      description,
      type,
      value,
      pointsCost,
      minOrderAmount,
      maxDiscount,
      productId,
      validDays,
      maxRedemptions,
      startDate,
      endDate,
    } = req.body;

    if (!name || !type || value === undefined || pointsCost === undefined) {
      return res.status(400).json({ message: 'name, type, value, and pointsCost are required' });
    }

    const reward = await loyaltyService.createReward({
      programId: program.id,
      name,
      description,
      type: type as RewardType,
      value,
      pointsCost,
      minOrderAmount,
      maxDiscount,
      productId,
      validDays,
      maxRedemptions,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.status(201).json({ data: reward });
  } catch (error) {
    res.status(500).json({
      message: 'Error creating reward',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/loyalty/rewards/:id
 * Update a reward
 */
router.put('/rewards/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const reward = await loyaltyService.updateReward(req.params.id, req.body);
    res.json({ data: reward });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating reward',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/loyalty/rewards/:id
 * Delete a reward
 */
router.delete('/rewards/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await loyaltyService.deleteReward(req.params.id);
    res.json({ message: 'Reward deleted' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting reward',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REDEMPTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/loyalty/redemptions/apply
 * Apply a redemption code to an order
 */
router.post('/redemptions/apply', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, orderId } = req.body;

    if (!code || !orderId) {
      return res.status(400).json({ message: 'code and orderId are required' });
    }

    const result = await loyaltyService.applyRedemption(code, orderId);

    res.json({
      data: result,
      message: `Applied ${result.reward.name}`,
    });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : 'Error applying redemption',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REFERRAL ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/loyalty/referrals/process
 * Process a referral signup
 */
router.post('/referrals/process', authMiddleware, async (req: Request, res: Response) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { newCustomerId, referralCode } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID required' });
    }

    if (!newCustomerId || !referralCode) {
      return res.status(400).json({ message: 'newCustomerId and referralCode are required' });
    }

    const result = await loyaltyService.processReferral(newCustomerId, referralCode, teamId);

    if (!result) {
      return res.status(400).json({ message: 'Invalid referral code' });
    }

    res.json({
      data: result,
      message: 'Referral processed successfully',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error processing referral',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MAINTENANCE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/loyalty/expire-points
 * Process expired points (for cron job)
 */
router.post('/expire-points', authMiddleware, async (req: Request, res: Response) => {
  try {
    const totalExpired = await loyaltyService.processExpiredPoints();
    res.json({ message: `Expired ${totalExpired} points` });
  } catch (error) {
    res.status(500).json({
      message: 'Error processing expired points',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
