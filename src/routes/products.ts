import { Router, Request, Response, NextFunction } from 'express';
// import  } from '../middleware/auth';
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
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, name, search } = req.query;
    const teamId = (req as any).user?.teamId || (req.query.teamId as string);

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { productRepository: repo } = getServices();

    let products: any[] = [];
    if (search && typeof search === 'string') {
      products = await repo.searchProducts(search, {
        teamId: teamId,
        category: category as string,
      });
    } else {
      products = await repo.findManyProducts({
        teamId: teamId,
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
    const teamId = (req as any).user?.teamId || (req.query.teamId as string);
    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    if (product.teamId !== teamId) {
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
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
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

// PUT /api/products/:id - Update product (alias for PATCH for frontend compatibility)
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/:id/faqs', async (req: Request, res: Response, next: NextFunction) => {
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
    const teamId = (req as any).user?.teamId || (req.query.teamId as string);
    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    if (product.teamId !== teamId) {
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

// POST /api/products/:id/faqs - Add FAQ to product
router.post('/:id/faqs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { question, answer, category } = req.body;
    const user = (req as any).user;

    if (!question || !answer) {
      return res.status(400).json({
        message: 'Question and answer are required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { productRepository: repo } = getServices();

    const product = await repo.findProductById(id);
    if (!product) {
      return res.status(404).json({
        message: 'Product not found',
        code: 'NOT_FOUND',
      } as ErrorResponse);
    }

    // Check team access
    if (product.teamId !== user?.teamId) {
      return res.status(403).json({
        message: 'Access denied',
        code: 'FORBIDDEN',
      } as ErrorResponse);
    }

    const faq = await repo.createProductFAQ({
      question,
      answer,
      category,
      relevantProductId: id,
      teamId: user.teamId,
    });

    logger.info(`Created FAQ ${faq.id} for product ${id}`);

    res.status(201).json({
      message: 'FAQ created successfully',
      data: faq,
    });
  } catch (error) {
    logger.error('Error creating FAQ for product', error);
    next(error);
  }
});

// PUT /api/products/faqs/:id - Update FAQ (frontend compatibility)
router.put('/faqs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { question, answer, category, relevantProductId } = req.body;
    const user = (req as any).user;

    const { productRepository: repo } = getServices();

    const existing = await repo.findProductFAQById(id);
    if (!existing) {
      return res.status(404).json({
        message: 'FAQ not found',
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
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (category !== undefined) updateData.category = category;
    if (relevantProductId !== undefined) updateData.relevantProductId = relevantProductId;

    const faq = await repo.updateProductFAQ(id, updateData);

    logger.info(`Updated FAQ: ${faq.id}`);

    res.status(200).json({
      message: 'FAQ updated successfully',
      data: faq,
    });
  } catch (error) {
    logger.error('Error updating FAQ', error);
    next(error);
  }
});

// DELETE /api/products/faqs/:id - Delete FAQ (frontend compatibility)
router.delete('/faqs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const { productRepository: repo } = getServices();

    const existing = await repo.findProductFAQById(id);
    if (!existing) {
      return res.status(404).json({
        message: 'FAQ not found',
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

    await repo.deleteProductFAQ(id);

    logger.info(`Deleted FAQ: ${id}`);

    res.status(200).json({
      message: 'FAQ deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting FAQ', error);
    next(error);
  }
});

// POST /api/products/import - Bulk import from CSV
router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
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