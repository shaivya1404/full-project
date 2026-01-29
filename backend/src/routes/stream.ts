import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// This route handles the request that redirected the WebSocket to /streams
// It might be called by the frontend or internal services trying to "stream" a call
router.get('/', (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Token is required',
        });
    }

    logger.info('Received request for call stream', { token });

    // For real-time streaming, we typically use WebSockets (which are handled in server.ts at /streams)
    // This HTTP endpoint can act as a handshake or verification point
    res.status(200).json({
        success: true,
        message: 'Stream endpoint ready. Use WebSocket connection at /streams for audio.',
    });
});

export default router;
