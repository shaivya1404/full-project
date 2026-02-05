import { Router, Request, Response } from 'express';
import { deliveryZoneService } from '../services/deliveryZoneService';
import { customerDetectionService } from '../services/customerDetectionService';
import { logger } from '../utils/logger';

const router = Router();

// ===================== STORE INFO =====================

// Get store info
router.get('/info', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const storeInfo = await deliveryZoneService.getStoreInfo(teamId as string);

    if (!storeInfo) {
      return res.status(404).json({ message: 'Store info not found' });
    }

    res.status(200).json({ data: storeInfo });
  } catch (error) {
    logger.error('Error getting store info', error);
    res.status(500).json({
      message: 'Error getting store info',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Create or update store info
router.put('/info', async (req: Request, res: Response) => {
  try {
    const {
      teamId,
      storeName,
      address,
      phone,
      operatingHours,
      timezone,
      deliveryEnabled,
      minOrderAmount,
      avgPrepTime
    } = req.body;

    if (!teamId || !storeName || !address || !operatingHours) {
      return res.status(400).json({
        message: 'teamId, storeName, address, and operatingHours are required'
      });
    }

    const storeInfo = await deliveryZoneService.upsertStoreInfo(teamId, {
      storeName,
      address,
      phone,
      operatingHours,
      timezone,
      deliveryEnabled,
      minOrderAmount,
      avgPrepTime
    });

    res.status(200).json({ data: storeInfo });
  } catch (error) {
    logger.error('Error updating store info', error);
    res.status(500).json({
      message: 'Error updating store info',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// ===================== OPERATING HOURS =====================

// Get store hours
router.get('/hours', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const hours = await deliveryZoneService.getStoreHours(teamId as string);
    res.status(200).json({ data: hours });
  } catch (error) {
    logger.error('Error getting store hours', error);
    res.status(500).json({
      message: 'Error getting store hours',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Update store hours
router.put('/hours', async (req: Request, res: Response) => {
  try {
    const { teamId, hours } = req.body;

    if (!teamId || !hours) {
      return res.status(400).json({ message: 'teamId and hours are required' });
    }

    await deliveryZoneService.updateStoreHours(teamId, hours);
    res.status(200).json({ message: 'Hours updated' });
  } catch (error) {
    logger.error('Error updating store hours', error);
    res.status(500).json({
      message: 'Error updating store hours',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Check if store is open
router.get('/is-open', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const isOpen = await deliveryZoneService.isStoreOpen(teamId as string);
    res.status(200).json({ data: { isOpen } });
  } catch (error) {
    logger.error('Error checking store status', error);
    res.status(500).json({
      message: 'Error checking store status',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// ===================== DELIVERY ZONES =====================

// Get all delivery zones
router.get('/zones', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const zones = await deliveryZoneService.getDeliveryZonesParsed(teamId as string);
    res.status(200).json({ data: zones });
  } catch (error) {
    logger.error('Error getting delivery zones', error);
    res.status(500).json({
      message: 'Error getting delivery zones',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Create delivery zone
router.post('/zones', async (req: Request, res: Response) => {
  try {
    const { teamId, zoneName, postalCodes, deliveryFee, minOrderAmount, estimatedTime } = req.body;

    if (!teamId || !zoneName || !postalCodes || estimatedTime === undefined) {
      return res.status(400).json({
        message: 'teamId, zoneName, postalCodes, and estimatedTime are required'
      });
    }

    const zone = await deliveryZoneService.createDeliveryZone(teamId, {
      zoneName,
      postalCodes,
      deliveryFee: deliveryFee || 0,
      minOrderAmount,
      estimatedTime
    });

    res.status(201).json({ data: zone });
  } catch (error) {
    logger.error('Error creating delivery zone', error);
    res.status(500).json({
      message: 'Error creating delivery zone',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Update delivery zone
router.put('/zones/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { zoneName, postalCodes, deliveryFee, minOrderAmount, estimatedTime, isActive } = req.body;

    const zone = await deliveryZoneService.updateDeliveryZone(id, {
      zoneName,
      postalCodes,
      deliveryFee,
      minOrderAmount,
      estimatedTime,
      isActive
    });

    res.status(200).json({ data: zone });
  } catch (error) {
    logger.error('Error updating delivery zone', error);
    res.status(500).json({
      message: 'Error updating delivery zone',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Delete delivery zone
router.delete('/zones/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deliveryZoneService.deleteDeliveryZone(id);

    res.status(200).json({ message: 'Zone deleted' });
  } catch (error) {
    logger.error('Error deleting delivery zone', error);
    res.status(500).json({
      message: 'Error deleting delivery zone',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Check delivery availability
router.post('/check-delivery', async (req: Request, res: Response) => {
  try {
    const { teamId, postalCode } = req.body;

    if (!teamId || !postalCode) {
      return res.status(400).json({ message: 'teamId and postalCode are required' });
    }

    const result = await deliveryZoneService.isDeliveryAvailable(teamId, postalCode);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error checking delivery', error);
    res.status(500).json({
      message: 'Error checking delivery',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Calculate delivery fee
router.get('/delivery-fee', async (req: Request, res: Response) => {
  try {
    const { teamId, postalCode } = req.query;

    if (!teamId || !postalCode) {
      return res.status(400).json({ message: 'teamId and postalCode are required' });
    }

    const fee = await deliveryZoneService.calculateDeliveryFee(
      teamId as string,
      postalCode as string
    );

    res.status(200).json({ data: { deliveryFee: fee } });
  } catch (error) {
    logger.error('Error calculating delivery fee', error);
    res.status(500).json({
      message: 'Error calculating delivery fee',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get estimated delivery time
router.get('/delivery-time', async (req: Request, res: Response) => {
  try {
    const { teamId, postalCode } = req.query;

    if (!teamId || !postalCode) {
      return res.status(400).json({ message: 'teamId and postalCode are required' });
    }

    const time = await deliveryZoneService.getEstimatedDeliveryTime(
      teamId as string,
      postalCode as string
    );

    res.status(200).json({ data: { estimatedMinutes: time } });
  } catch (error) {
    logger.error('Error getting delivery time', error);
    res.status(500).json({
      message: 'Error getting delivery time',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Check minimum order amount
router.post('/check-minimum', async (req: Request, res: Response) => {
  try {
    const { teamId, postalCode, orderAmount } = req.body;

    if (!teamId || !postalCode || orderAmount === undefined) {
      return res.status(400).json({
        message: 'teamId, postalCode, and orderAmount are required'
      });
    }

    const result = await deliveryZoneService.checkMinOrderAmount(teamId, postalCode, orderAmount);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error checking minimum order', error);
    res.status(500).json({
      message: 'Error checking minimum order',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// ===================== CUSTOMER DETECTION =====================

// Find customer by phone
router.get('/customer/find', async (req: Request, res: Response) => {
  try {
    const { phone, teamId } = req.query;

    if (!phone) {
      return res.status(400).json({ message: 'phone is required' });
    }

    const customer = await customerDetectionService.findByPhone(
      phone as string,
      teamId as string
    );

    res.status(200).json({ data: customer });
  } catch (error) {
    logger.error('Error finding customer', error);
    res.status(500).json({
      message: 'Error finding customer',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Generate greeting for caller
router.post('/customer/greeting', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, teamId } = req.body;

    if (!phoneNumber || !teamId) {
      return res.status(400).json({ message: 'phoneNumber and teamId are required' });
    }

    const greeting = await customerDetectionService.generateGreeting(phoneNumber, teamId);
    res.status(200).json({ data: greeting });
  } catch (error) {
    logger.error('Error generating greeting', error);
    res.status(500).json({
      message: 'Error generating greeting',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get reorder suggestions
router.get('/customer/:customerId/suggestions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit } = req.query;

    const suggestions = await customerDetectionService.suggestReorder(
      customerId,
      limit ? parseInt(limit as string, 10) : 5
    );

    res.status(200).json({ data: suggestions });
  } catch (error) {
    logger.error('Error getting suggestions', error);
    res.status(500).json({
      message: 'Error getting suggestions',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get customer insights
router.get('/customer/:customerId/insights', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const insights = await customerDetectionService.getCustomerInsights(customerId);

    if (!insights) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json({ data: insights });
  } catch (error) {
    logger.error('Error getting customer insights', error);
    res.status(500).json({
      message: 'Error getting customer insights',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

export default router;
