import { Router, Request, Response } from 'express';
import { smsService } from '../services/smsService';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// ═══════════════════════════════════════════════════════════════════════════
// SEND SMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/sms/send
 * Send an SMS message
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { to, message, teamId, orderId, customerId, templateType } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    const result = await smsService.sendSms({
      to,
      message,
      teamId,
      orderId,
      customerId,
      templateType,
    });

    res.json({ data: result });
  } catch (error) {
    logger.error('Error sending SMS', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

/**
 * POST /api/sms/send-template
 * Send SMS using a template
 */
router.post('/send-template', async (req: Request, res: Response) => {
  try {
    const { templateType, to, variables, teamId, orderId, customerId } = req.body;

    if (!templateType || !to) {
      return res.status(400).json({ error: 'Template type and phone number are required' });
    }

    const result = await smsService.sendTemplatedSms(templateType, to, variables || {}, {
      teamId,
      orderId,
      customerId,
    });

    res.json({ data: result });
  } catch (error) {
    logger.error('Error sending templated SMS', error);
    res.status(500).json({ error: 'Failed to send templated SMS' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ORDER NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/sms/order/:orderId/confirmation
 */
router.post('/order/:orderId/confirmation', async (req: Request, res: Response) => {
  try {
    const result = await smsService.sendOrderConfirmation(req.params.orderId);
    if (!result) {
      return res.status(404).json({ error: 'Order not found or no phone number' });
    }
    res.json({ data: result });
  } catch (error) {
    logger.error('Error sending order confirmation', error);
    res.status(500).json({ error: 'Failed to send order confirmation' });
  }
});

/**
 * POST /api/sms/order/:orderId/ready
 */
router.post('/order/:orderId/ready', async (req: Request, res: Response) => {
  try {
    const result = await smsService.sendOrderReady(req.params.orderId);
    if (!result) {
      return res.status(404).json({ error: 'Order not found or no phone number' });
    }
    res.json({ data: result });
  } catch (error) {
    logger.error('Error sending order ready notification', error);
    res.status(500).json({ error: 'Failed to send order ready notification' });
  }
});

/**
 * POST /api/sms/order/:orderId/out-for-delivery
 */
router.post('/order/:orderId/out-for-delivery', async (req: Request, res: Response) => {
  try {
    const { trackingLink } = req.body;
    const result = await smsService.sendOutForDelivery(req.params.orderId, trackingLink);
    if (!result) {
      return res.status(404).json({ error: 'Order not found or no phone number' });
    }
    res.json({ data: result });
  } catch (error) {
    logger.error('Error sending delivery notification', error);
    res.status(500).json({ error: 'Failed to send delivery notification' });
  }
});

/**
 * POST /api/sms/order/:orderId/delivered
 */
router.post('/order/:orderId/delivered', async (req: Request, res: Response) => {
  try {
    const { feedbackLink } = req.body;
    const result = await smsService.sendOrderDelivered(req.params.orderId, feedbackLink);
    if (!result) {
      return res.status(404).json({ error: 'Order not found or no phone number' });
    }
    res.json({ data: result });
  } catch (error) {
    logger.error('Error sending delivery confirmation', error);
    res.status(500).json({ error: 'Failed to send delivery confirmation' });
  }
});

/**
 * POST /api/sms/order/:orderId/cancelled
 */
router.post('/order/:orderId/cancelled', async (req: Request, res: Response) => {
  try {
    const { cancelReason } = req.body;
    const result = await smsService.sendOrderCancelled(req.params.orderId, cancelReason);
    if (!result) {
      return res.status(404).json({ error: 'Order not found or no phone number' });
    }
    res.json({ data: result });
  } catch (error) {
    logger.error('Error sending cancellation notification', error);
    res.status(500).json({ error: 'Failed to send cancellation notification' });
  }
});

/**
 * POST /api/sms/order/:orderId/payment-received
 */
router.post('/order/:orderId/payment-received', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    const result = await smsService.sendPaymentReceived(req.params.orderId, amount);
    if (!result) {
      return res.status(404).json({ error: 'Order not found or no phone number' });
    }
    res.json({ data: result });
  } catch (error) {
    logger.error('Error sending payment notification', error);
    res.status(500).json({ error: 'Failed to send payment notification' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/sms/templates/:teamId
 * Get all SMS templates for a team
 */
router.get('/templates/:teamId', async (req: Request, res: Response) => {
  try {
    const templates = await smsService.getTemplates(req.params.teamId);
    res.json({ data: templates });
  } catch (error) {
    logger.error('Error getting SMS templates', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * PUT /api/sms/templates/:teamId/:type
 * Create or update a template
 */
router.put('/templates/:teamId/:type', async (req: Request, res: Response) => {
  try {
    const { content, name } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Template content is required' });
    }

    const template = await smsService.saveTemplate(
      req.params.teamId,
      req.params.type as any,
      content,
      name
    );
    res.json({ data: template });
  } catch (error) {
    logger.error('Error saving SMS template', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

/**
 * DELETE /api/sms/templates/:teamId/:type
 * Reset a template to default
 */
router.delete('/templates/:teamId/:type', async (req: Request, res: Response) => {
  try {
    await smsService.resetTemplate(req.params.teamId, req.params.type as any);
    res.json({ message: 'Template reset to default' });
  } catch (error) {
    logger.error('Error resetting SMS template', error);
    res.status(500).json({ error: 'Failed to reset template' });
  }
});

/**
 * GET /api/sms/template-variables
 * Get available template variables
 */
router.get('/template-variables', async (_req: Request, res: Response) => {
  res.json({ data: smsService.getTemplateVariables() });
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/sms/logs/:teamId
 * Get SMS logs for a team
 */
router.get('/logs/:teamId', async (req: Request, res: Response) => {
  try {
    const { limit, offset, status, orderId, customerId } = req.query;

    const result = await smsService.getLogs(req.params.teamId, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      status: status as string,
      orderId: orderId as string,
      customerId: customerId as string,
    });

    res.json({ data: result.logs, total: result.total });
  } catch (error) {
    logger.error('Error getting SMS logs', error);
    res.status(500).json({ error: 'Failed to get SMS logs' });
  }
});

export default router;
