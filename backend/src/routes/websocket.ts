import { Router, Request, Response } from 'express';
import { websocketService, NOTIFICATION_EVENTS } from '../services/websocketService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /api/websocket/status
 * Get WebSocket server status
 */
router.get('/status', authMiddleware, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const teamId = user?.teamId;

    const totalConnections = websocketService.getConnectedCount();
    const teamConnections = teamId ? websocketService.getTeamClients(teamId).length : 0;

    res.json({
      status: 'active',
      connections: {
        total: totalConnections,
        team: teamConnections,
      },
      wsPath: '/ws',
      supportedChannels: Object.keys(NOTIFICATION_EVENTS),
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error getting WebSocket status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/websocket/channels
 * Get available notification channels and events
 */
router.get('/channels', authMiddleware, (req: Request, res: Response) => {
  res.json({
    channels: NOTIFICATION_EVENTS,
  });
});

/**
 * POST /api/websocket/broadcast
 * Send a broadcast message (admin only)
 */
router.post('/broadcast', authMiddleware, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { channel, event, data, targetTeamId } = req.body;

    // Only allow admins or team-scoped broadcasts
    const teamId = targetTeamId || user?.teamId;

    if (!channel || !event || !data) {
      return res.status(400).json({
        message: 'channel, event, and data are required',
      });
    }

    if (!NOTIFICATION_EVENTS[channel as keyof typeof NOTIFICATION_EVENTS]) {
      return res.status(400).json({
        message: `Invalid channel: ${channel}`,
        validChannels: Object.keys(NOTIFICATION_EVENTS),
      });
    }

    websocketService.sendToTeam(teamId, {
      channel,
      event,
      data,
    });

    res.json({
      message: 'Broadcast sent successfully',
      channel,
      event,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error sending broadcast',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/websocket/notify-user
 * Send notification to specific user
 */
router.post('/notify-user', authMiddleware, (req: Request, res: Response) => {
  try {
    const { userId, title, message, actionUrl } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        message: 'userId, title, and message are required',
      });
    }

    websocketService.sendToUser(userId, {
      channel: 'notifications',
      event: 'notification.new',
      data: { title, message, actionUrl },
    });

    res.json({
      message: 'Notification sent successfully',
      userId,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error sending notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/websocket/test
 * Test WebSocket connection (development only)
 */
router.post('/test', authMiddleware, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const teamId = user?.teamId;

    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        message: 'Test endpoint not available in production',
      });
    }

    websocketService.sendToTeam(teamId, {
      channel: 'notifications',
      event: 'notification.new',
      data: {
        title: 'Test Notification',
        message: 'This is a test notification from the WebSocket service',
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      message: 'Test notification sent',
      teamId,
      connectedClients: websocketService.getTeamClients(teamId).length,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error sending test notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
