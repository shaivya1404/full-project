import { Router, Request, Response } from 'express';
import { callbackService } from '../services/callbackService';
import { logger } from '../utils/logger';

const router = Router();

// Get all callbacks for a team
router.get('/', async (req: Request, res: Response) => {
  try {
    const { teamId, page, limit, status, campaignId, startDate, endDate } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const result = await callbackService.getCallbacks(
      teamId as string,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 20,
      {
        status: status as string,
        campaignId: campaignId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      }
    );

    res.status(200).json({ data: result.callbacks, total: result.total });
  } catch (error) {
    logger.error('Error getting callbacks', error);
    res.status(500).json({
      message: 'Error getting callbacks',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get upcoming callbacks
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const { teamId, hours } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const callbacks = await callbackService.getUpcomingCallbacks(
      teamId as string,
      hours ? parseInt(hours as string, 10) : 24
    );

    res.status(200).json({ data: callbacks });
  } catch (error) {
    logger.error('Error getting upcoming callbacks', error);
    res.status(500).json({
      message: 'Error getting upcoming callbacks',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get callback by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const callback = await callbackService.getCallbackById(id);

    if (!callback) {
      return res.status(404).json({ message: 'Callback not found' });
    }

    res.status(200).json({ data: callback });
  } catch (error) {
    logger.error('Error getting callback', error);
    res.status(500).json({
      message: 'Error getting callback',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Schedule a callback
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      teamId,
      contactId,
      campaignId,
      scheduledTime,
      timezone,
      reason,
      priority,
      notes,
      maxAttempts
    } = req.body;

    if (!teamId || !contactId || !scheduledTime) {
      return res.status(400).json({
        message: 'teamId, contactId, and scheduledTime are required'
      });
    }

    const callback = await callbackService.scheduleCallback({
      teamId,
      contactId,
      campaignId,
      scheduledTime: new Date(scheduledTime),
      timezone,
      reason,
      priority,
      notes,
      maxAttempts
    });

    res.status(201).json({ data: callback });
  } catch (error) {
    logger.error('Error scheduling callback', error);
    res.status(500).json({
      message: 'Error scheduling callback',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Reschedule a callback
router.put('/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheduledTime, notes } = req.body;

    if (!scheduledTime) {
      return res.status(400).json({ message: 'scheduledTime is required' });
    }

    const callback = await callbackService.rescheduleCallback(
      id,
      new Date(scheduledTime),
      notes
    );

    res.status(200).json({ data: callback });
  } catch (error) {
    logger.error('Error rescheduling callback', error);
    res.status(500).json({
      message: 'Error rescheduling callback',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Cancel a callback
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await callbackService.cancelCallback(id);

    res.status(200).json({ message: 'Callback cancelled' });
  } catch (error) {
    logger.error('Error cancelling callback', error);
    res.status(500).json({
      message: 'Error cancelling callback',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Mark callback as complete
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resultCallId, notes } = req.body;

    await callbackService.markCallbackComplete(id, resultCallId, notes);

    res.status(200).json({ message: 'Callback marked as complete' });
  } catch (error) {
    logger.error('Error completing callback', error);
    res.status(500).json({
      message: 'Error completing callback',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Process callback queue (admin/cron endpoint)
router.post('/process-queue', async (req: Request, res: Response) => {
  try {
    const result = await callbackService.processCallbackQueue();
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error processing callback queue', error);
    res.status(500).json({
      message: 'Error processing callback queue',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get callback statistics
router.get('/stats/:teamId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { days } = req.query;

    const stats = await callbackService.getCallbackStats(
      teamId,
      days ? parseInt(days as string, 10) : 30
    );

    res.status(200).json({ data: stats });
  } catch (error) {
    logger.error('Error getting callback stats', error);
    res.status(500).json({
      message: 'Error getting callback stats',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get best time to call for a contact
router.get('/best-time/:contactId', async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const bestTime = await callbackService.getBestTimeToCall(contactId);

    res.status(200).json({ data: { bestTime } });
  } catch (error) {
    logger.error('Error getting best time to call', error);
    res.status(500).json({
      message: 'Error getting best time to call',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

export default router;
