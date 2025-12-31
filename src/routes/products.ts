import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ProductRepository } from '../db/repositories/productRepository';
import { ImportService } from '../services/importService';
import { logger } from '../utils/logger';

const router = Router();

let productRepository: ProductRepository;
let importService: ImportService;

const getServices = () => {
  if (!productRepository) {
    productRepository = new ProductRepository();
  }
  if (!importService) {
    importService = new ImportService();
  }
  return { productRepository, importService };
};

interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
}

// POST /api/products - Create product
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, category, price, details, faqs } = req.body;
    const user = (req as any).user;

    if (!name || !description) {
      return res.status(400).json({
        message: 'Name and description are required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    if (!user || !user.teamId) {
      return res.status(401).json({
        message: 'User team not found',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { productRepository: repo } = getServices();
    const product = await repo.createProduct({
      name,
      description,
      category,
      price,
      details,
      faqs,
      teamId: user.teamId,
    });

    logger.info(`Created product: ${product.id}`);

    res.status(201).json({
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    logger.error('Error creating product', error);
    next(error);
  }
});

// GET /api/products - List products (with filter/search)
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, name, search } = req.query;
    const user = (req as any).user;

    if (!user || !user.teamId) {
      return res.status(401).json({
        message: 'User team not found',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { productRepository: repo } = getServices();
    
    let products: any[] = [];
    if (search && typeof search === 'string') {
      products = await repo.searchProducts(search, {
        teamId: user.teamId,
        category: category as string,
      });
    } else {
      products = await repo.findManyProducts({
        teamId: user.teamId,
        category: category as string,
        name: name as string,
      });
    }

    res.status(200).json({
      data: products,
    });
  } catch (error) {
    logger.error('Error fetching products', error);
    next(error);
  }
});

// GET /api/products/:id - Get product details
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { productRepository: repo } = getServices();
    
    const product = await repo.findProductById(id);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found',
        code: 'NOT_FOUND',
      } as ErrorResponse);
    }

    // Check team access
    const user = (req as any).user;
    if (product.teamId !== user?.teamId) {
      return res.status(403).json({
        message: 'Access denied',
        code: 'FORBIDDEN',
      } as ErrorResponse);
    }

    res.status(200).json({
      data: product,
    });
  } catch (error) {
    logger.error('Error fetching product', error);
    next(error);
  }
});

// PATCH /api/products/:id - Update product
router.patch('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, details, faqs } = req.body;
    const user = (req as any).user;

    const { productRepository: repo } = getServices();
    
    const existing = await repo.findProductById(id);
    if (!existing) {
      return res.status(404).json({
        message: 'Product not found',
        code: 'NOT_FOUND',
      } as ErrorResponse);
    }

    // Check team access
    if (existing.teamId !== user?.teamId) {
      return res.status(403).json({
        message: 'Access denied',
        code: 'FORBIDDEN',
      } as ErrorResponse);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = price;
    if (details !== undefined) updateData.details = details;
    if (faqs !== undefined) updateData.faqs = faqs;

    const product = await repo.updateProduct(id, updateData);

    logger.info(`Updated product: ${product.id}`);

    res.status(200).json({
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    logger.error('Error updating product', error);
    next(error);
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const { productRepository: repo } = getServices();
    
    const existing = await repo.findProductById(id);
    if (!existing) {
      return res.status(404).json({
        message: 'Product not found',
        code: 'NOT_FOUND',
      } as ErrorResponse);
    }

    // Check team access
    if (existing.teamId !== user?.teamId) {
      return res.status(403).json({
        message: 'Access denied',
        code: 'FORBIDDEN',
      } as ErrorResponse);
    }

    await repo.deleteProduct(id);

    logger.info(`Deleted product: ${id}`);

    res.status(200).json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting product', error);
    next(error);
  }
});

// GET /api/products/:id/faqs - Get product FAQs
router.get('/:id/faqs', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { productRepository: repo } = getServices();
    
    const product = await repo.findProductById(id);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found',
        code: 'NOT_FOUND',
      } as ErrorResponse);
    }

    // Check team access
    const user = (req as any).user;
    if (product.teamId !== user?.teamId) {
      return res.status(403).json({
        message: 'Access denied',
        code: 'FORBIDDEN',
      } as ErrorResponse);
    }

    const faqs = await repo.getProductFAQsByProductId(id);

    res.status(200).json({
      data: faqs,
    });
  } catch (error) {
    logger.error('Error fetching product FAQs', error);
    next(error);
  }
});

// POST /api/products/import - Bulk import from CSV
router.post('/import', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format, data, mapping } = req.body;
    const user = (req as any).user;

    if (!format || !['csv', 'json'].includes(format)) {
      return res.status(400).json({
        message: 'Format must be either "csv" or "json"',
        code: 'INVALID_FORMAT',
      } as ErrorResponse);
    }

    if (!data) {
      return res.status(400).json({
        message: 'Import data is required',
        code: 'DATA_REQUIRED',
      } as ErrorResponse);
    }

    if (!user || !user.teamId) {
      return res.status(401).json({
        message: 'User team not found',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { importService: service } = getServices();
    let result: any;

    if (format === 'csv') {
      // CSV data is sent as base64 encoded string
      const buffer = Buffer.from(data, 'base64');
      result = await service.importProductsFromCSV(buffer, user.teamId, mapping || {});
    } else {
      // JSON data is sent as array of objects
      result = await service.importProductsFromJSON(data, user.teamId, mapping || {});
    }

    logger.info(`Imported ${result.imported} products`);

    if (result.errors.length > 0) {
      logger.warn(`Import had ${result.errors.length} errors`, result.errors);
    }

    res.status(200).json({
      message: `Successfully imported ${result.imported} products`,
      data: {
        imported: result.imported,
        errors: result.errors,
      },
    });
  } catch (error) {
    logger.error('Error importing products', error);
    next(error);
  }
});

export default router;