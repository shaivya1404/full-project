import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { bulkOperationsService } from '../services/bulkOperationsService';
import { logger } from '../utils/logger';
import multer from 'multer';
import { z } from 'zod';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Import contacts
router.post('/import/contacts', authenticate, upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required',
      });
    }

    if (!req.teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team context is required',
      });
    }

    const skipDuplicates = req.body.skipDuplicates === 'true';
    const validateOnly = req.body.validateOnly === 'true';

    const result = await bulkOperationsService.importContacts(
      req.file.buffer,
      {
        teamId: req.teamId,
        userId: req.user!.id,
        skipDuplicates,
        validateOnly,
      }
    );

    res.json({
      success: true,
      data: result,
      message: validateOnly
        ? `Validation complete: ${result.success} valid, ${result.failed} invalid`
        : `Import complete: ${result.success} imported, ${result.failed} failed`,
    });
  } catch (error) {
    logger.error('Error importing contacts', error);
    next(error);
  }
});

// Import products
router.post('/import/products', authenticate, upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required',
      });
    }

    if (!req.teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team context is required',
      });
    }

    const skipDuplicates = req.body.skipDuplicates === 'true';
    const validateOnly = req.body.validateOnly === 'true';

    const result = await bulkOperationsService.importProducts(
      req.file.buffer,
      {
        teamId: req.teamId,
        userId: req.user!.id,
        skipDuplicates,
        validateOnly,
      }
    );

    res.json({
      success: true,
      data: result,
      message: validateOnly
        ? `Validation complete: ${result.success} valid, ${result.failed} invalid`
        : `Import complete: ${result.success} imported, ${result.failed} failed`,
    });
  } catch (error) {
    logger.error('Error importing products', error);
    next(error);
  }
});

// Import customers
router.post('/import/customers', authenticate, upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required',
      });
    }

    if (!req.teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team context is required',
      });
    }

    const skipDuplicates = req.body.skipDuplicates === 'true';
    const validateOnly = req.body.validateOnly === 'true';

    const result = await bulkOperationsService.importCustomers(
      req.file.buffer,
      {
        teamId: req.teamId,
        userId: req.user!.id,
        skipDuplicates,
        validateOnly,
      }
    );

    res.json({
      success: true,
      data: result,
      message: validateOnly
        ? `Validation complete: ${result.success} valid, ${result.failed} invalid`
        : `Import complete: ${result.success} imported, ${result.failed} failed`,
    });
  } catch (error) {
    logger.error('Error importing customers', error);
    next(error);
  }
});

// Bulk update orders
const bulkUpdateOrdersSchema = z.object({
  orderIds: z.array(z.string()).min(1).max(100),
  updates: z.object({
    status: z.string().optional(),
    notes: z.string().optional(),
  }),
});

router.post('/orders/update', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = bulkUpdateOrdersSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.format(),
      });
    }

    if (!req.teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team context is required',
      });
    }

    const { orderIds, updates } = validation.data;

    const result = await bulkOperationsService.bulkUpdateOrders(
      orderIds,
      updates,
      {
        teamId: req.teamId,
        userId: req.user!.id,
      }
    );

    res.json({
      success: true,
      data: result,
      message: `Updated ${result.success} orders, ${result.failed} failed`,
    });
  } catch (error) {
    logger.error('Error bulk updating orders', error);
    next(error);
  }
});

// Bulk update agents
const bulkUpdateAgentsSchema = z.object({
  agentIds: z.array(z.string()).min(1).max(100),
  updates: z.object({
    availabilityStatus: z.enum(['online', 'offline', 'busy', 'away']).optional(),
    maxConcurrentCalls: z.number().min(1).max(10).optional(),
  }),
});

router.post('/agents/update', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = bulkUpdateAgentsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.format(),
      });
    }

    if (!req.teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team context is required',
      });
    }

    const { agentIds, updates } = validation.data;

    const result = await bulkOperationsService.bulkUpdateAgents(
      agentIds,
      updates,
      {
        teamId: req.teamId,
        userId: req.user!.id,
      }
    );

    res.json({
      success: true,
      data: result,
      message: `Updated ${result.success} agents, ${result.failed} failed`,
    });
  } catch (error) {
    logger.error('Error bulk updating agents', error);
    next(error);
  }
});

// Bulk delete
const bulkDeleteSchema = z.object({
  type: z.enum(['contacts', 'products', 'customers', 'orders']),
  ids: z.array(z.string()).min(1).max(100),
});

router.post('/delete', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = bulkDeleteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.format(),
      });
    }

    if (!req.teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team context is required',
      });
    }

    const { type, ids } = validation.data;

    const result = await bulkOperationsService.bulkDelete(
      type,
      ids,
      {
        teamId: req.teamId,
        userId: req.user!.id,
      }
    );

    res.json({
      success: true,
      data: result,
      message: `Deleted ${result.success} ${type}, ${result.failed} failed`,
    });
  } catch (error) {
    logger.error('Error bulk deleting', error);
    next(error);
  }
});

// Download import template
router.get('/templates/:type', (req, res) => {
  const { type } = req.params;

  const templates: Record<string, { headers: string[]; example: string[] }> = {
    contacts: {
      headers: ['phone', 'name', 'email'],
      example: ['+919876543210', 'John Doe', 'john@example.com'],
    },
    products: {
      headers: ['name', 'description', 'category', 'price'],
      example: ['Product Name', 'Product Description', 'Category', '100.00'],
    },
    customers: {
      headers: ['phone', 'email', 'name', 'address'],
      example: ['+919876543210', 'john@example.com', 'John Doe', '123 Main St, City'],
    },
  };

  const template = templates[type];
  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Unknown template type',
    });
  }

  const csv = [template.headers.join(','), template.example.join(',')].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${type}_template.csv"`);
  res.send(csv);
});

export default router;
