import { Router, Request, Response } from 'express';
import { complianceService } from '../services/complianceService';
import { logger } from '../utils/logger';

const router = Router();

// Check DND status
router.post('/check-dnd', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'phoneNumber is required' });
    }

    const result = await complianceService.checkDND(phoneNumber);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error checking DND', error);
    res.status(500).json({
      message: 'Error checking DND',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Add to DND registry
router.post('/dnd-registry', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, source, expiresAt } = req.body;

    if (!phoneNumber || !source) {
      return res.status(400).json({ message: 'phoneNumber and source are required' });
    }

    if (!['national', 'internal', 'customer_request'].includes(source)) {
      return res.status(400).json({ message: 'Invalid source' });
    }

    await complianceService.addToDND(
      phoneNumber,
      source,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.status(201).json({ message: 'Added to DND registry' });
  } catch (error) {
    logger.error('Error adding to DND', error);
    res.status(500).json({
      message: 'Error adding to DND',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Remove from DND registry
router.delete('/dnd-registry/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const removed = await complianceService.removeFromDND(decodeURIComponent(phoneNumber));

    if (removed) {
      res.status(200).json({ message: 'Removed from DND registry' });
    } else {
      res.status(404).json({ message: 'Phone number not found in DND registry' });
    }
  } catch (error) {
    logger.error('Error removing from DND', error);
    res.status(500).json({
      message: 'Error removing from DND',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Bulk import DND numbers
router.post('/dnd-registry/bulk', async (req: Request, res: Response) => {
  try {
    const { phoneNumbers, source } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || !source) {
      return res.status(400).json({ message: 'phoneNumbers array and source are required' });
    }

    const result = await complianceService.bulkImportDND(phoneNumbers, source);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error bulk importing DND', error);
    res.status(500).json({
      message: 'Error bulk importing DND',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Verify consent
router.post('/verify-consent', async (req: Request, res: Response) => {
  try {
    const { contactId, consentType } = req.body;

    if (!contactId || !consentType) {
      return res.status(400).json({ message: 'contactId and consentType are required' });
    }

    const result = await complianceService.verifyConsent(contactId, consentType);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error verifying consent', error);
    res.status(500).json({
      message: 'Error verifying consent',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Record consent
router.post('/consent', async (req: Request, res: Response) => {
  try {
    const { contactId, consentType, consentGiven, method, recordingUrl, expiresAt } = req.body;

    if (!contactId || !consentType || consentGiven === undefined || !method) {
      return res.status(400).json({
        message: 'contactId, consentType, consentGiven, and method are required'
      });
    }

    await complianceService.recordConsent(
      contactId,
      consentType,
      consentGiven,
      method,
      recordingUrl,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.status(201).json({ message: 'Consent recorded' });
  } catch (error) {
    logger.error('Error recording consent', error);
    res.status(500).json({
      message: 'Error recording consent',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Check if can contact now
router.post('/can-contact', async (req: Request, res: Response) => {
  try {
    const { contactId, phoneNumber, timezone } = req.body;

    if (!contactId || !phoneNumber) {
      return res.status(400).json({ message: 'contactId and phoneNumber are required' });
    }

    const result = await complianceService.canContactNow(contactId, phoneNumber, timezone);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error checking contact permission', error);
    res.status(500).json({
      message: 'Error checking contact permission',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Check calling hours
router.get('/calling-hours', async (req: Request, res: Response) => {
  try {
    const { timezone } = req.query;
    const isWithinHours = complianceService.isWithinCallingHours(timezone as string);
    const quietHours = complianceService.getQuietHours();

    res.status(200).json({
      data: {
        isWithinCallingHours: isWithinHours,
        quietHours
      }
    });
  } catch (error) {
    logger.error('Error checking calling hours', error);
    res.status(500).json({
      message: 'Error checking calling hours',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get compliance logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { teamId, page, limit, checkType, checkResult, startDate, endDate } = req.query;

    const result = await complianceService.getComplianceLogs(
      teamId as string,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 50,
      {
        checkType: checkType as string,
        checkResult: checkResult as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      }
    );

    res.status(200).json({ data: result.logs, total: result.total });
  } catch (error) {
    logger.error('Error getting compliance logs', error);
    res.status(500).json({
      message: 'Error getting compliance logs',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get compliance statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { teamId, days } = req.query;

    const stats = await complianceService.getComplianceStats(
      teamId as string,
      days ? parseInt(days as string, 10) : 30
    );

    res.status(200).json({ data: stats });
  } catch (error) {
    logger.error('Error getting compliance stats', error);
    res.status(500).json({
      message: 'Error getting compliance stats',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

export default router;
