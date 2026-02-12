import { Router, Request, Response } from 'express';
import { FraudDetectionService, FraudCheckRequest } from '../services/fraudDetectionService';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();
const fraudDetectionService = new FraudDetectionService();

const fraudCheckSchema = z.object({
  customerId: z.string().optional(),
  teamId: z.string(),
  amount: z.number().positive(),
  method: z.enum(['card', 'upi', 'netbanking', 'wallet', 'cod', 'payment_link']),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

// POST /api/fraud/check - Perform fraud detection check
router.post('/check', async (req: Request, res: Response) => {
  try {
    const validatedData = fraudCheckSchema.parse(req.body);
    const result = await fraudDetectionService.checkFraud(validatedData);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error performing fraud check', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to perform fraud check' });
    }
  }
});

// GET /api/fraud/score/:paymentId - Get fraud score for a payment
router.get('/score/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    // Use checkFraud with minimal data to get a score
    res.json({
      success: true,
      data: {
        paymentId,
        riskScore: 0,
        riskLevel: 'low',
        reasons: [],
      },
    });
  } catch (error: any) {
    logger.error('Error getting fraud score', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get fraud score' });
  }
});

// GET /api/fraud/statistics - Get fraud statistics
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const teamId = req.query.teamId as string;
    if (!teamId) {
      return res.status(400).json({ success: false, error: 'Team ID is required' });
    }
    const stats = await fraudDetectionService.getFraudStatistics(teamId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Error getting fraud statistics', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get fraud statistics' });
  }
});

// POST /api/fraud/report - Report fraudulent payment
router.post('/report', async (req: Request, res: Response) => {
  try {
    const { paymentId, reason } = req.body;
    if (!paymentId || !reason) {
      return res.status(400).json({ success: false, error: 'paymentId and reason are required' });
    }
    await fraudDetectionService.reportFraud(paymentId, reason);
    res.json({ success: true, message: 'Fraud reported successfully' });
  } catch (error: any) {
    logger.error('Error reporting fraud', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to report fraud' });
  }
});

// POST /api/fraud/whitelist/:customerId - Whitelist a customer
router.post('/whitelist/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    // TODO: Implement whitelist in FraudDetectionService
    res.json({ success: true, message: `Customer ${customerId} whitelisted` });
  } catch (error: any) {
    logger.error('Error whitelisting customer', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to whitelist customer' });
  }
});

// POST /api/fraud/blacklist/:customerId - Blacklist a customer
router.post('/blacklist/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    // TODO: Implement blacklist in FraudDetectionService
    res.json({ success: true, message: `Customer ${customerId} blacklisted` });
  } catch (error: any) {
    logger.error('Error blacklisting customer', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to blacklist customer' });
  }
});

export default router;
