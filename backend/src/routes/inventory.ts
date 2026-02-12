import { Router, Request, Response } from 'express';
import { inventoryService } from '../services/inventoryService';
import { logger } from '../utils/logger';

const router = Router();

// Get all inventory for a team
router.get('/', async (req: Request, res: Response) => {
  try {
    const { teamId, page, limit, category, stockStatus, search } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const result = await inventoryService.getInventory(
      teamId as string,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 50,
      {
        category: category as string,
        stockStatus: stockStatus as 'in_stock' | 'low_stock' | 'out_of_stock',
        search: search as string
      }
    );

    res.status(200).json({ data: result.products, total: result.total });
  } catch (error) {
    logger.error('Error getting inventory', error);
    res.status(500).json({
      message: 'Error getting inventory',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get inventory statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const stats = await inventoryService.getInventoryStats(teamId as string);
    res.status(200).json({ data: stats });
  } catch (error) {
    logger.error('Error getting inventory stats', error);
    res.status(500).json({
      message: 'Error getting inventory stats',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get low stock products
router.get('/low-stock', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    const products = await inventoryService.getLowStockProducts(teamId as string);
    res.status(200).json({ data: products });
  } catch (error) {
    logger.error('Error getting low stock products', error);
    res.status(500).json({
      message: 'Error getting low stock products',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Check product availability
router.post('/check-availability', async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    const result = await inventoryService.checkAvailability(productId, quantity || 1);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error checking availability', error);
    res.status(500).json({
      message: 'Error checking availability',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Bulk update stock
router.post('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { updates, createdBy } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ message: 'updates array is required' });
    }

    const result = await inventoryService.bulkUpdateStock(updates, createdBy);
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error bulk updating stock', error);
    res.status(500).json({
      message: 'Error bulk updating stock',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get product stock info
router.get('/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const product = await inventoryService.getProductWithStock(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({ data: product });
  } catch (error) {
    logger.error('Error getting product stock', error);
    res.status(500).json({
      message: 'Error getting product stock',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Update product stock
router.put('/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { quantity, reason, createdBy } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ message: 'quantity is required' });
    }

    const movement = await inventoryService.adjustStock({
      productId,
      quantity,
      movementType: 'adjustment',
      reason,
      createdBy
    });

    res.status(200).json({ data: movement });
  } catch (error) {
    logger.error('Error updating stock', error);
    res.status(500).json({
      message: 'Error updating stock',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Adjust stock
router.post('/:productId/adjust', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { quantity, movementType, reason, orderId, createdBy } = req.body;

    if (quantity === undefined || !movementType) {
      return res.status(400).json({ message: 'quantity and movementType are required' });
    }

    const movement = await inventoryService.adjustStock({
      productId,
      quantity,
      movementType,
      reason,
      orderId,
      createdBy
    });

    res.status(200).json({ data: movement });
  } catch (error) {
    logger.error('Error adjusting stock', error);
    res.status(500).json({
      message: 'Error adjusting stock',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Restock product
router.post('/:productId/restock', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { quantity, reason, createdBy } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'positive quantity is required' });
    }

    const movement = await inventoryService.restockProduct(productId, quantity, createdBy, reason);
    res.status(200).json({ data: movement });
  } catch (error) {
    logger.error('Error restocking product', error);
    res.status(500).json({
      message: 'Error restocking product',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Reserve stock for order
router.post('/:productId/reserve', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { quantity, orderId } = req.body;

    if (!quantity || !orderId) {
      return res.status(400).json({ message: 'quantity and orderId are required' });
    }

    const success = await inventoryService.reserveStock(productId, quantity, orderId);

    if (!success) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    res.status(200).json({ message: 'Stock reserved' });
  } catch (error) {
    logger.error('Error reserving stock', error);
    res.status(500).json({
      message: 'Error reserving stock',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Release reserved stock
router.post('/:productId/release', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { quantity, orderId } = req.body;

    if (!quantity || !orderId) {
      return res.status(400).json({ message: 'quantity and orderId are required' });
    }

    await inventoryService.releaseStock(productId, quantity, orderId);
    res.status(200).json({ message: 'Stock released' });
  } catch (error) {
    logger.error('Error releasing stock', error);
    res.status(500).json({
      message: 'Error releasing stock',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Get stock history for a product
router.get('/:productId/movements', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { page, limit } = req.query;

    const result = await inventoryService.getStockHistory(
      productId,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 50
    );

    res.status(200).json({ data: result.movements, total: result.total });
  } catch (error) {
    logger.error('Error getting stock history', error);
    res.status(500).json({
      message: 'Error getting stock history',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// Update product availability
router.put('/:productId/availability', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { isAvailable } = req.body;

    if (isAvailable === undefined) {
      return res.status(400).json({ message: 'isAvailable is required' });
    }

    await inventoryService.updateProductAvailability(productId, isAvailable);
    res.status(200).json({ message: 'Availability updated' });
  } catch (error) {
    logger.error('Error updating availability', error);
    res.status(500).json({
      message: 'Error updating availability',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

export default router;
