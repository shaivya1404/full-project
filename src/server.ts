import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import { TwilioStreamService } from './services/twilioStream';

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/streams' });

wss.on('connection', (ws, req) => {
  logger.info('New WebSocket connection', { path: req.url });

  const twilioStream = new TwilioStreamService(ws);
  twilioStream.handleConnection();
});

const PORT = config.PORT;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${config.NODE_ENV} mode`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});
// Restart trigger
