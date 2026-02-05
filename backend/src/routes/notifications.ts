import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notificationService } from '../services/notificationService';
import { prisma } from '../db/client';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();

// Get user's notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = parseInt(req.query.limit as string) || 50;

    const notifications = await notificationService.getNotifications(req.user!.id, {
      unreadOnly,
      limit,
    });

    const unreadCount = await notificationService.getUnreadCount(req.user!.id);

    res.json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data ? JSON.parse(n.data) : null,
          read: n.read,
          readAt: n.readAt,
          createdAt: n.createdAt,
        })),
        unreadCount,
      },
    });
  } catch (error) {
    logger.error('Error fetching notifications', error);
    next(error);
  }
});

// Get unread count
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error('Error getting unread count', error);
    next(error);
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    await notificationService.markAsRead(id);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Error marking notification as read', error);
    next(error);
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllAsRead(req.user!.id);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    logger.error('Error marking all notifications as read', error);
    next(error);
  }
});

// Delete notification
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    await notificationService.deleteNotification(id);

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    logger.error('Error deleting notification', error);
    next(error);
  }
});

// Get notification preferences
router.get('/preferences', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId: req.user!.id },
    });

    // Create default preferences if not exists
    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: { userId: req.user!.id },
      });
    }

    res.json({
      success: true,
      data: {
        emailEnabled: preferences.emailEnabled,
        smsEnabled: preferences.smsEnabled,
        inAppEnabled: preferences.inAppEnabled,
        orderUpdates: preferences.orderUpdates,
        paymentUpdates: preferences.paymentUpdates,
        campaignUpdates: preferences.campaignUpdates,
        callAlerts: preferences.callAlerts,
        teamUpdates: preferences.teamUpdates,
        marketingEmails: preferences.marketingEmails,
      },
    });
  } catch (error) {
    logger.error('Error fetching notification preferences', error);
    next(error);
  }
});

// Update notification preferences
const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  orderUpdates: z.boolean().optional(),
  paymentUpdates: z.boolean().optional(),
  campaignUpdates: z.boolean().optional(),
  callAlerts: z.boolean().optional(),
  teamUpdates: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

router.put('/preferences', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = updatePreferencesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid preferences data',
      });
    }

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        ...validation.data,
      },
      update: validation.data,
    });

    res.json({
      success: true,
      data: preferences,
      message: 'Preferences updated',
    });
  } catch (error) {
    logger.error('Error updating notification preferences', error);
    next(error);
  }
});

// Send test notification (for debugging/testing)
router.post('/test', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type = 'email' } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const result = await notificationService.sendNotification({
      type: 'custom',
      recipientEmail: type === 'email' ? user.email : undefined,
      recipientPhone: type === 'sms' ? user.phone || undefined : undefined,
      userId: user.id,
      subject: 'Test Notification',
      data: {
        message: 'This is a test notification from the Voice AI Dashboard.',
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      data: result,
      message: 'Test notification sent',
    });
  } catch (error) {
    logger.error('Error sending test notification', error);
    next(error);
  }
});

export default router;
