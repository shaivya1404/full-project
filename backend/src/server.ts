import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import { TwilioStreamService } from './services/twilioStream';
import { websocketService } from './services/websocketService';

const server = http.createServer(app);

// Twilio Media Streams WebSocket (/streams) - noServer mode
const twilioWss = new WebSocketServer({ noServer: true });

twilioWss.on('connection', (ws, req) => {
  logger.info('New Twilio WebSocket connection', { path: req.url });

  const twilioStream = new TwilioStreamService(ws);
  twilioStream.handleConnection();
});

// Real-time Notifications WebSocket (/ws) - noServer mode
websocketService.initialize(server, { noServer: true });

// Handle upgrade requests manually to prevent Express from intercepting them
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url?.split('?')[0];

  if (pathname === '/ws') {
    websocketService.handleUpgrade(request, socket, head);
  } else if (pathname === '/streams') {
    twilioWss.handleUpgrade(request, socket, head, (ws) => {
      twilioWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

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
