import { Router, Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const getOrderService = () => new OrderService();

interface PaginationParams {
  limit: number;
  offset: number;
}

const getPaginationParams = (req: Request): PaginationParams => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  return { limit, offset };
};

interface ErrorResponse {
  message: string;
  code?: string;
}

// POST /api/customers - Create customer
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { phone, email, address, name } = req.body;

    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    if (!phone && !email) {
      return res.status(400).json({
        message: 'Phone or email is required',
        code: 'CONTACT_REQUIRED',
      } as ErrorResponse);
    }

    // Check if customer already exists
    if (phone) {
      const existing = await orderService.searchCustomers({ phone }, teamId);
      if (existing.customers.length > 0) {
        return res.status(409).json({
          message: 'Customer with this phone number already exists',
          code: 'CUSTOMER_EXISTS',
          data: existing.customers[0],
        } as ErrorResponse & { data: any });
      }
    }

    if (email) {
      const existing = await orderService.searchCustomers({ email }, teamId);
      if (existing.customers.length > 0) {
        return res.status(409).json({
          message: 'Customer with this email already exists',
          code: 'CUSTOMER_EXISTS',
          data: existing.customers[0],
        } as ErrorResponse & { data: any });
      }
    }

    const customer = await orderService.updateCustomer('', {
      phone,
      email,
      address,
      name,
    });

    logger.info(`Customer created: ${customer.id}`);

    res.status(201).json({
      data: customer,
    });
  } catch (error) {
    logger.error('Error creating customer', error);
    next(error);
  }
});

// GET /api/customers - List customers
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { limit, offset } = getPaginationParams(req);
    const { phone, email } = req.query;

    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const { customers, total } = await orderService.searchCustomers(
      {
        limit,
        offset,
        phone: phone as string,
        email: email as string,
      },
      teamId,
    );

    res.status(200).json({
      data: customers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching customers', error);
    next(error);
  }
});

// GET /api/customers/:id - Get customer details
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { id } = req.params;

    const customer = await orderService.getCustomer(id);

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      } as ErrorResponse);
    }

    res.status(200).json({
      data: customer,
    });
  } catch (error) {
    logger.error('Error fetching customer', error);
    next(error);
  }
});

// GET /api/customers/:id/orders - Get customer's order history
router.get('/:id/orders', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { id } = req.params;
    const { limit, offset } = getPaginationParams(req);
    const { status } = req.query;

    const customer = await orderService.getCustomer(id);
    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      } as ErrorResponse);
    }

    const { orders, total } = await orderService.searchOrders(
      {
        limit,
        offset,
        customerId: id,
        status: status as string,
      },
    );

    res.status(200).json({
      data: orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching customer orders', error);
    next(error);
  }
});

// PATCH /api/customers/:id - Update customer info
router.patch('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { phone, email, address, name } = req.body;

    const orderService = getOrderService();
    const customer = await orderService.updateCustomer(id, {
      phone,
      email,
      address,
      name,
    });

    logger.info(`Customer ${id} updated`);

    res.status(200).json({
      data: customer,
    });
  } catch (error) {
    logger.error('Error updating customer', error);
    next(error);
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orderService = getOrderService();

    await orderService.deleteCustomer(id);

    logger.info(`Customer ${id} deleted`);

    res.status(200).json({
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting customer', error);
    next(error);
  }
});

// GET /api/customers/:id/preferences - Get customer preferences
router.get('/:id/preferences', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orderService = getOrderService();

    const customer = await orderService.getCustomer(id);
    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      } as ErrorResponse);
    }

    const preferences = await orderService.getCustomerPreferences(id);

    res.status(200).json({
      data: preferences,
    });
  } catch (error) {
    logger.error('Error fetching preferences', error);
    next(error);
  }
});

// POST /api/customers/:id/preferences - Save preferences
router.post('/:id/preferences', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { favoriteItems, dietaryRestrictions, allergies, deliveryNotes } = req.body;

    const orderService = getOrderService();

    const customer = await orderService.getCustomer(id);
    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      } as ErrorResponse);
    }

    const preferences = await orderService.saveCustomerPreferences(id, {
      favoriteItems,
      dietaryRestrictions,
      allergies,
      deliveryNotes,
    });

    logger.info(`Preferences saved for customer ${id}`);

    res.status(200).json({
      data: preferences,
    });
  } catch (error) {
    logger.error('Error saving preferences', error);
    next(error);
  }
});

// GET /api/customers/lookup/:phone - Lookup customer by phone
router.get('/lookup/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.params;
    const orderService = getOrderService();

    const { customers } = await orderService.searchCustomers({ phone }, undefined);
    
    if (customers.length === 0) {
      return res.status(404).json({
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      } as ErrorResponse);
    }

    res.status(200).json({
      data: customers[0],
    });
  } catch (error) {
    logger.error('Error looking up customer', error);
    next(error);
  }
});

export default router;
