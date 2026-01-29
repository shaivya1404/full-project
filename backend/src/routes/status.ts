import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

interface StatusUpdate {
  type: 'call_started' | 'call_ended' | 'recording_saved' | 'error';
  callId?: string;
  streamSid?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

// Store active SSE clients
const sseClients: Set<Response> = new Set();

// Store queued messages to broadcast
const messageQueue: StatusUpdate[] = [];
const MAX_QUEUE_SIZE = 100;

// Function to broadcast status updates to all connected clients
export const broadcastStatusUpdate = (update: StatusUpdate): void => {
  messageQueue.push({
    ...update,
    timestamp: new Date().toISOString(),
  });

  if (messageQueue.length > MAX_QUEUE_SIZE) {
    messageQueue.shift();
  }

  sseClients.forEach((client) => {
    try {
      client.write(`data: ${JSON.stringify(update)}\n\n`);
    } catch (error) {
      logger.error('Error sending SSE update', error);
      sseClients.delete(client);
    }
  });
};

// GET /api/status - Server-Sent Events endpoint for real-time updates
router.get('/', (req: Request, res: Response) => {
  const clientId = `client-${Date.now()}-${Math.random()}`;

  logger.info(`New SSE client connected: ${clientId}`);

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write('data: {"type":"connected","message":"Connected to status updates"}\n\n');

  // Send recent queued messages
  messageQueue.forEach((msg) => {
    try {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    } catch (error) {
      logger.error('Error sending queued message', error);
    }
  });

  // Add client to active clients
  sseClients.add(res);

  // Send periodic keepalive ping
  const keepaliveInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (error) {
      logger.error('Error sending keepalive', error);
      clearInterval(keepaliveInterval);
      sseClients.delete(res);
    }
  }, 30000); // Send ping every 30 seconds

  // Handle client disconnect
  req.on('close', () => {
    logger.info(`SSE client disconnected: ${clientId}`);
    clearInterval(keepaliveInterval);
    sseClients.delete(res);
    res.end();
  });

  req.on('error', (error) => {
    logger.error(`SSE client error: ${clientId}`, error);
    clearInterval(keepaliveInterval);
    sseClients.delete(res);
  });
});

// Export for external use
export const getActiveClientCount = (): number => sseClients.size;
export const getMessageQueueSize = (): number => messageQueue.length;

export default router;
