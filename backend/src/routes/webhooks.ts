import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { z } from 'zod';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();

const createWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
});

// Available webhook events
const WEBHOOK_EVENTS = [
  'call.started',
  'call.completed',
  'call.transferred',
  'order.created',
  'order.updated',
  'order.completed',
  'order.cancelled',
  'payment.initiated',
  'payment.completed',
  'payment.failed',
  'payment.refunded',
  'campaign.started',
  'campaign.completed',
  'customer.created',
  'customer.updated',
];

// List available webhook events
router.get('/events', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      events: WEBHOOK_EVENTS,
    },
  });
});

// List team webhooks
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team context is required',
      });
    }

    const webhooks = await prisma.webhook.findMany({
      where: { teamId: req.teamId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: webhooks.map((w) => ({
        id: w.id,
        url: w.url,
        events: JSON.parse(w.events),
        enabled: w.enabled,
        description: w.description,
        lastCalledAt: w.lastCalledAt,
        lastStatus: w.lastStatus,
        failCount: w.failCount,
        createdAt: w.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error listing webhooks', error);
    next(error);
  }
});

// Create webhook
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createWebhookSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook data',
        details: validation.error.format(),
      });
    }

    if (!req.teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team context is required',
      });
    }

    const { url, events, description, enabled } = validation.data;

    // Validate events
    const invalidEvents = events.filter((e) => !WEBHOOK_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid events: ${invalidEvents.join(', ')}`,
      });
    }

    // Generate secret for signature verification
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        teamId: req.teamId,
        url,
        secret,
        events: JSON.stringify(events),
        description,
        enabled,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: webhook.id,
        url: webhook.url,
        secret: webhook.secret, // Only returned on creation
        events,
        enabled: webhook.enabled,
        description: webhook.description,
        createdAt: webhook.createdAt,
      },
      message: 'Webhook created. Save the secret - it will not be shown again.',
    });
  } catch (error) {
    logger.error('Error creating webhook', error);
    next(error);
  }
});

// Get webhook details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook.findFirst({
      where: { id, teamId: req.teamId || undefined },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
      });
    }

    // Get recent logs
    const logs = await prisma.webhookLog.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      data: {
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        enabled: webhook.enabled,
        description: webhook.description,
        lastCalledAt: webhook.lastCalledAt,
        lastStatus: webhook.lastStatus,
        failCount: webhook.failCount,
        createdAt: webhook.createdAt,
        logs: logs.map((l) => ({
          id: l.id,
          event: l.event,
          statusCode: l.statusCode,
          duration: l.duration,
          error: l.error,
          createdAt: l.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Error getting webhook', error);
    next(error);
  }
});

// Update webhook
router.put('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validation = updateWebhookSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook data',
        details: validation.error.format(),
      });
    }

    const webhook = await prisma.webhook.findFirst({
      where: { id, teamId: req.teamId || undefined },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
      });
    }

    const { url, events, description, enabled } = validation.data;

    // Validate events if provided
    if (events) {
      const invalidEvents = events.filter((e) => !WEBHOOK_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid events: ${invalidEvents.join(', ')}`,
        });
      }
    }

    const updated = await prisma.webhook.update({
      where: { id },
      data: {
        url: url || webhook.url,
        events: events ? JSON.stringify(events) : webhook.events,
        description: description ?? webhook.description,
        enabled: enabled ?? webhook.enabled,
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        url: updated.url,
        events: JSON.parse(updated.events),
        enabled: updated.enabled,
        description: updated.description,
      },
      message: 'Webhook updated',
    });
  } catch (error) {
    logger.error('Error updating webhook', error);
    next(error);
  }
});

// Delete webhook
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook.findFirst({
      where: { id, teamId: req.teamId || undefined },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
      });
    }

    // Delete logs first
    await prisma.webhookLog.deleteMany({ where: { webhookId: id } });
    await prisma.webhook.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Webhook deleted',
    });
  } catch (error) {
    logger.error('Error deleting webhook', error);
    next(error);
  }
});

// Regenerate webhook secret
router.post('/:id/regenerate-secret', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook.findFirst({
      where: { id, teamId: req.teamId || undefined },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
      });
    }

    const newSecret = crypto.randomBytes(32).toString('hex');

    await prisma.webhook.update({
      where: { id },
      data: { secret: newSecret },
    });

    res.json({
      success: true,
      data: { secret: newSecret },
      message: 'Secret regenerated. Update your integration with the new secret.',
    });
  } catch (error) {
    logger.error('Error regenerating webhook secret', error);
    next(error);
  }
});

// Test webhook
router.post('/:id/test', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook.findFirst({
      where: { id, teamId: req.teamId || undefined },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
      });
    }

    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Voice AI Dashboard',
        webhookId: webhook.id,
      },
    };

    const result = await sendWebhook(webhook, 'test', testPayload);

    res.json({
      success: true,
      data: {
        statusCode: result.statusCode,
        duration: result.duration,
        success: result.success,
        error: result.error,
      },
    });
  } catch (error) {
    logger.error('Error testing webhook', error);
    next(error);
  }
});

// Webhook sending utility
export async function sendWebhook(
  webhook: { id: string; url: string; secret: string },
  event: string,
  payload: any
): Promise<{ success: boolean; statusCode?: number; duration: number; error?: string }> {
  const startTime = Date.now();

  // Generate signature
  const timestamp = Date.now().toString();
  const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(signaturePayload)
    .digest('hex');

  try {
    const response = await axios.post(webhook.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Signature': `sha256=${signature}`,
      },
      timeout: 30000, // 30 second timeout
    });

    const duration = Date.now() - startTime;

    // Log success
    await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: JSON.stringify(payload),
        statusCode: response.status,
        response: JSON.stringify(response.data).substring(0, 1000),
        duration,
      },
    });

    // Update webhook
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastCalledAt: new Date(),
        lastStatus: response.status,
        failCount: 0,
      },
    });

    return { success: true, statusCode: response.status, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const statusCode = error.response?.status;
    const errorMessage = error.message || 'Unknown error';

    // Log failure
    await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: JSON.stringify(payload),
        statusCode,
        error: errorMessage,
        duration,
      },
    });

    // Update webhook fail count
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastCalledAt: new Date(),
        lastStatus: statusCode || 0,
        failCount: { increment: 1 },
      },
    });

    logger.error('Webhook delivery failed', { webhookId: webhook.id, event, error: errorMessage });

    return { success: false, statusCode, duration, error: errorMessage };
  }
}

// Dispatch webhook to all subscribed webhooks for a team
export async function dispatchWebhook(teamId: string, event: string, data: any): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: {
      teamId,
      enabled: true,
    },
  });

  const eligibleWebhooks = webhooks.filter((w) => {
    const events = JSON.parse(w.events);
    return events.includes(event) || events.includes('*');
  });

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Send webhooks in parallel
  await Promise.allSettled(
    eligibleWebhooks.map((webhook) => sendWebhook(webhook, event, payload))
  );
}

export default router;
