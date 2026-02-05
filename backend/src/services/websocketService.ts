import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { verify } from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from '../utils/logger';

// Types
export interface WSClient {
  id: string;
  ws: WebSocket;
  userId: string;
  teamId?: string;
  subscriptions: Set<string>;
  isAlive: boolean;
  connectedAt: Date;
}

export interface WSMessage {
  type: string;
  event: string;
  payload: any;
  timestamp: string;
}

export type NotificationChannel =
  | 'calls'           // New/updated calls
  | 'orders'          // Order updates
  | 'agents'          // Agent status changes
  | 'queue'           // Queue updates
  | 'alerts'          // System alerts
  | 'analytics'       // Real-time metrics
  | 'notifications';  // User notifications

export interface NotificationPayload {
  channel: NotificationChannel;
  event: string;
  data: any;
  targetUserId?: string;      // Send to specific user
  targetTeamId?: string;      // Send to all users in team
  excludeUserId?: string;     // Exclude specific user
}

// Event types per channel
export const NOTIFICATION_EVENTS = {
  calls: [
    'call.started',
    'call.ended',
    'call.transferred',
    'call.status_changed',
    'call.sentiment_alert',
  ],
  orders: [
    'order.created',
    'order.updated',
    'order.status_changed',
    'order.payment_received',
    'order.cancelled',
  ],
  agents: [
    'agent.online',
    'agent.offline',
    'agent.busy',
    'agent.available',
    'agent.session_started',
    'agent.session_ended',
  ],
  queue: [
    'queue.call_added',
    'queue.call_assigned',
    'queue.position_changed',
    'queue.wait_time_alert',
  ],
  alerts: [
    'alert.system',
    'alert.high_priority',
    'alert.low_stock',
    'alert.compliance',
  ],
  analytics: [
    'analytics.call_volume',
    'analytics.conversion_rate',
    'analytics.sentiment_trend',
  ],
  notifications: [
    'notification.new',
    'notification.read',
    'notification.action_required',
  ],
};

/**
 * WebSocket service for real-time notifications
 */
export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      verifyClient: (info, callback) => {
        this.verifyConnection(info, callback);
      },
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', error);
    });

    // Setup ping/pong for connection health
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 30000);

    logger.info('WebSocket server initialized');
  }

  /**
   * Verify WebSocket connection
   */
  private verifyConnection(
    info: { origin: string; secure: boolean; req: any },
    callback: (result: boolean, code?: number, message?: string) => void
  ): void {
    try {
      // Get token from query string or headers
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token') || info.req.headers['authorization']?.replace('Bearer ', '');

      if (!token) {
        callback(false, 401, 'Unauthorized');
        return;
      }

      // Verify JWT token
      verify(token, config.JWT_SECRET || 'default-secret');
      callback(true);
    } catch (error) {
      logger.warn('WebSocket connection rejected: invalid token');
      callback(false, 401, 'Unauthorized');
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    try {
      // Extract user info from token
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers['authorization']?.replace('Bearer ', '');
      const decoded = verify(token!, config.JWT_SECRET || 'default-secret') as any;

      const clientId = this.generateClientId();
      const client: WSClient = {
        id: clientId,
        ws,
        userId: decoded.userId || decoded.id,
        teamId: decoded.teamId,
        subscriptions: new Set(['notifications']), // Default subscription
        isAlive: true,
        connectedAt: new Date(),
      };

      this.clients.set(clientId, client);

      // Send welcome message
      this.sendToClient(client, {
        type: 'system',
        event: 'connected',
        payload: {
          clientId,
          subscribedChannels: Array.from(client.subscriptions),
        },
        timestamp: new Date().toISOString(),
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        this.handleMessage(client, data);
      });

      // Handle pong responses
      ws.on('pong', () => {
        client.isAlive = true;
      });

      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket client ${clientId} error`, error);
        this.handleDisconnect(clientId);
      });

      logger.info(`WebSocket client connected: ${clientId} (user: ${client.userId})`);
    } catch (error) {
      logger.error('Error handling WebSocket connection', error);
      ws.close(1011, 'Internal error');
    }
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: WSClient, data: any): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(client, message.channels);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(client, message.channels);
          break;

        case 'ping':
          this.sendToClient(client, {
            type: 'system',
            event: 'pong',
            payload: { timestamp: Date.now() },
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          logger.warn(`Unknown message type from client ${client.id}: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Error parsing message from client ${client.id}`, error);
    }
  }

  /**
   * Handle channel subscription
   */
  private handleSubscribe(client: WSClient, channels: NotificationChannel[]): void {
    if (!Array.isArray(channels)) return;

    for (const channel of channels) {
      if (NOTIFICATION_EVENTS[channel]) {
        client.subscriptions.add(channel);
      }
    }

    this.sendToClient(client, {
      type: 'system',
      event: 'subscribed',
      payload: { channels: Array.from(client.subscriptions) },
      timestamp: new Date().toISOString(),
    });

    logger.debug(`Client ${client.id} subscribed to: ${channels.join(', ')}`);
  }

  /**
   * Handle channel unsubscription
   */
  private handleUnsubscribe(client: WSClient, channels: NotificationChannel[]): void {
    if (!Array.isArray(channels)) return;

    for (const channel of channels) {
      client.subscriptions.delete(channel);
    }

    this.sendToClient(client, {
      type: 'system',
      event: 'unsubscribed',
      payload: { channels: Array.from(client.subscriptions) },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      logger.info(`WebSocket client disconnected: ${clientId}`);
    }
  }

  /**
   * Ping all clients to check connection health
   */
  private pingClients(): void {
    this.clients.forEach((client, clientId) => {
      if (!client.isAlive) {
        logger.info(`Terminating inactive client: ${clientId}`);
        client.ws.terminate();
        this.clients.delete(clientId);
        return;
      }

      client.isAlive = false;
      client.ws.ping();
    });
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(client: WSClient, message: WSMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast notification to subscribed clients
   */
  broadcast(notification: NotificationPayload): void {
    const { channel, event, data, targetUserId, targetTeamId, excludeUserId } = notification;

    const message: WSMessage = {
      type: channel,
      event,
      payload: data,
      timestamp: new Date().toISOString(),
    };

    let sentCount = 0;

    this.clients.forEach((client) => {
      // Check if client is subscribed to this channel
      if (!client.subscriptions.has(channel)) return;

      // Check user targeting
      if (targetUserId && client.userId !== targetUserId) return;

      // Check team targeting
      if (targetTeamId && client.teamId !== targetTeamId) return;

      // Check exclusion
      if (excludeUserId && client.userId === excludeUserId) return;

      this.sendToClient(client, message);
      sentCount++;
    });

    logger.debug(`Broadcast ${channel}:${event} to ${sentCount} clients`);
  }

  /**
   * Send notification to a specific user
   */
  sendToUser(userId: string, notification: Omit<NotificationPayload, 'targetUserId'>): void {
    this.broadcast({ ...notification, targetUserId: userId });
  }

  /**
   * Send notification to all users in a team
   */
  sendToTeam(teamId: string, notification: Omit<NotificationPayload, 'targetTeamId'>): void {
    this.broadcast({ ...notification, targetTeamId: teamId });
  }

  /**
   * Get connected clients count
   */
  getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Get connected clients for a team
   */
  getTeamClients(teamId: string): WSClient[] {
    return Array.from(this.clients.values()).filter(
      (client) => client.teamId === teamId
    );
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close(1001, 'Server shutting down');
    });

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shutdown complete');
  }
}

// Singleton instance
export const websocketService = new WebSocketService();

// Helper functions for common notifications

/**
 * Notify about a new incoming call
 */
export function notifyNewCall(teamId: string, callData: any): void {
  websocketService.sendToTeam(teamId, {
    channel: 'calls',
    event: 'call.started',
    data: callData,
  });
}

/**
 * Notify about call status change
 */
export function notifyCallStatusChange(
  teamId: string,
  callId: string,
  status: string,
  details?: any
): void {
  websocketService.sendToTeam(teamId, {
    channel: 'calls',
    event: 'call.status_changed',
    data: { callId, status, ...details },
  });
}

/**
 * Notify about call transfer
 */
export function notifyCallTransfer(
  teamId: string,
  callId: string,
  fromAgentId: string | null,
  toAgentId: string,
  reason?: string
): void {
  websocketService.sendToTeam(teamId, {
    channel: 'calls',
    event: 'call.transferred',
    data: { callId, fromAgentId, toAgentId, reason },
  });
}

/**
 * Notify about sentiment alert
 */
export function notifySentimentAlert(
  teamId: string,
  callId: string,
  sentiment: string,
  score: number
): void {
  websocketService.sendToTeam(teamId, {
    channel: 'calls',
    event: 'call.sentiment_alert',
    data: { callId, sentiment, score },
  });
}

/**
 * Notify about order update
 */
export function notifyOrderUpdate(
  teamId: string,
  orderId: string,
  status: string,
  orderData?: any
): void {
  websocketService.sendToTeam(teamId, {
    channel: 'orders',
    event: 'order.status_changed',
    data: { orderId, status, ...orderData },
  });
}

/**
 * Notify about agent status change
 */
export function notifyAgentStatus(
  teamId: string,
  agentId: string,
  status: 'online' | 'offline' | 'busy' | 'available'
): void {
  websocketService.sendToTeam(teamId, {
    channel: 'agents',
    event: `agent.${status}`,
    data: { agentId, status },
  });
}

/**
 * Notify about queue update
 */
export function notifyQueueUpdate(
  teamId: string,
  event: 'call_added' | 'call_assigned' | 'position_changed',
  queueData: any
): void {
  websocketService.sendToTeam(teamId, {
    channel: 'queue',
    event: `queue.${event}`,
    data: queueData,
  });
}

/**
 * Send system alert
 */
export function sendSystemAlert(
  teamId: string,
  alertType: 'system' | 'high_priority' | 'low_stock' | 'compliance',
  message: string,
  data?: any
): void {
  websocketService.sendToTeam(teamId, {
    channel: 'alerts',
    event: `alert.${alertType}`,
    data: { message, ...data },
  });
}

/**
 * Send user notification
 */
export function sendUserNotification(
  userId: string,
  title: string,
  message: string,
  actionUrl?: string
): void {
  websocketService.sendToUser(userId, {
    channel: 'notifications',
    event: 'notification.new',
    data: { title, message, actionUrl },
  });
}
