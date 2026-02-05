import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import { TwilioStreamService } from './services/twilioStream';
import { websocketService } from './services/websocketService';

const server = http.createServer(app);

// Twilio Media Streams WebSocket (/streams)
const wss = new WebSocketServer({ server, path: '/streams' });

wss.on('connection', (ws, req) => {
  logger.info('New WebSocket connection', { path: req.url });

  const twilioStream = new TwilioStreamService(ws);
  twilioStream.handleConnection();
});

// Real-time Notifications WebSocket (/ws)
websocketService.initialize(server);

const PORT = config.PORT;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${config.NODE_ENV} mode`);
  logger.info(`WebSocket notifications available at ws://localhost:${PORT}/ws`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  websocketService.shutdown();
  server.close(() => {
    logger.info('Process terminated');
  });
});
// Restart trigger
