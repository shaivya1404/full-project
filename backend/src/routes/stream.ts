import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

const sseClients = new Set<Response>();

export const broadcastCallUpdate = (data: any) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach((client) => {
        try {
            client.write(message);
        } catch {
            sseClients.delete(client);
        }
    });
};

router.get('/', (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.status(400).end();
        return;
    }

    logger.info('New SSE client connected for call stream');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.write('data: {"type":"connected","message":"Connected to call stream"}\n\n');

    sseClients.add(res);

    const keepAlive = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
        } catch {
            clearInterval(keepAlive);
            sseClients.delete(res);
        }
    }, 30000);

    req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(res);
        logger.info('SSE client disconnected from call stream');
    });
});

export default router;
