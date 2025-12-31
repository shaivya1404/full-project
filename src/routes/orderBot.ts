import { Router, Request, Response, NextFunction } from 'express';
import { CallManager } from '../services/callManager';
import { logger } from '../utils/logger';

const router = Router();

let callManager: CallManager;

const getCallManager = () => {
  if (!callManager) {
    callManager = new CallManager();
  }
  return callManager;
};

interface ErrorResponse {
  message: string;
  code?: string;
}

// POST /api/orders/bot/start - Start order collection for a call
router.post('/bot/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.body;

    if (!streamSid) {
      return res.status(400).json({
        message: 'Stream SID is required',
        code: 'STREAM_SID_REQUIRED',
      } as ErrorResponse);
    }

    const manager = getCallManager();
    const result = await manager.startOrderCollection(streamSid);

    if (!result) {
      return res.status(404).json({
        message: 'Call session not found',
        code: 'SESSION_NOT_FOUND',
      } as ErrorResponse);
    }

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    logger.error('Error starting order collection', error);
    next(error);
  }
});

// POST /api/orders/bot/input - Process customer input during order collection
router.post('/bot/input', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid, input, isAgent } = req.body;

    if (!streamSid) {
      return res.status(400).json({
        message: 'Stream SID is required',
        code: 'STREAM_SID_REQUIRED',
      } as ErrorResponse);
    }

    if (!input || typeof input !== 'string') {
      return res.status(400).json({
        message: 'Input text is required',
        code: 'INPUT_REQUIRED',
      } as ErrorResponse);
    }

    const manager = getCallManager();
    const result = await manager.processOrderInput(streamSid, input, isAgent);

    res.status(200).json({
      data: {
        response: result.response,
        orderCreated: result.orderCreated,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
      },
    });
  } catch (error) {
    logger.error('Error processing order input', error);
    next(error);
  }
});

// GET /api/orders/bot/state/:streamSid - Get current order collection state
router.get('/bot/state/:streamSid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.params;

    const manager = getCallManager();
    const state = await manager.getOrderCollectionState(streamSid);

    res.status(200).json({
      data: state,
    });
  } catch (error) {
    logger.error('Error getting order collection state', error);
    next(error);
  }
});

// POST /api/orders/bot/end - End order collection for a call
router.post('/bot/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid } = req.body;

    if (!streamSid) {
      return res.status(400).json({
        message: 'Stream SID is required',
        code: 'STREAM_SID_REQUIRED',
      } as ErrorResponse);
    }

    const manager = getCallManager();
    await manager.endOrderCollection(streamSid);

    res.status(200).json({
      message: 'Order collection ended',
    });
  } catch (error) {
    logger.error('Error ending order collection', error);
    next(error);
  }
});

// POST /api/orders/bot/create-from-call - Create order from completed call
router.post('/bot/create-from-call', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { streamSid, teamId, campaignId } = req.body;

    if (!streamSid) {
      return res.status(400).json({
        message: 'Stream SID is required',
        code: 'STREAM_SID_REQUIRED',
      } as ErrorResponse);
    }

    const manager = getCallManager();
    const result = await manager.createOrderFromCall(streamSid, teamId, campaignId);

    if (!result.success) {
      return res.status(400).json({
        message: 'Failed to create order',
        error: result.error,
        code: 'ORDER_CREATION_FAILED',
      } as ErrorResponse);
    }

    res.status(201).json({
      data: result.order,
      message: 'Order created successfully',
    });
  } catch (error) {
    logger.error('Error creating order from call', error);
    next(error);
  }
});

// POST /api/orders/bot/extract - Extract order data from transcript (utility endpoint)
router.post('/bot/extract', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        message: 'Transcript text is required',
        code: 'TRANSCRIPT_REQUIRED',
      } as ErrorResponse);
    }

    const { OrderService } = await import('../services/orderService');
    const orderService = new OrderService();

    const customerData = orderService.extractCustomerDataFromTranscript(transcript);
    const items = orderService.extractOrderItemsFromTranscript(transcript);

    res.status(200).json({
      data: {
        customer: customerData,
        items,
        itemCount: items.length,
      },
    });
  } catch (error) {
    logger.error('Error extracting order data', error);
    next(error);
  }
});

export default router;
