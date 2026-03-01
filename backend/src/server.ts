import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import config from './config';
import { TwilioStreamService } from './services/twilioStream';
import { logger } from './utils/logger';

const { port, env } = config;

const server = http.createServer(app);

// WebSocket server for Twilio Media Streams at /streams
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  const streamService = new TwilioStreamService(ws);
  streamService.handleConnection();
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';

  if (url.startsWith('/streams')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API running in ${env} mode on port ${port}`);
  logger.info(`WebSocket /streams endpoint ready`);
});
