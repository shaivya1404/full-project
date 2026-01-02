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

// POST /api/faqs - Create FAQ
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, answer, category, relevantProductId } = req.body;
    const teamId = (req as any).user?.teamId || req.body.teamId;

    if (!question || !answer) {
      return res.status(400).json({
        message: 'Question and answer are required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { productRepository: repo } = getServices();
    const faq = await repo.createProductFAQ({
      question,
      answer,
      category,
      relevantProductId,
      teamId: teamId,
    });

    logger.info(`Created FAQ: ${faq.id}`);

    res.status(201).json({
      message: 'FAQ created successfully',
      data: faq,
    });
  } catch (error) {
    logger.error('Error creating FAQ', error);
    next(error);
  }
});

// GET /api/faqs - List FAQs (with search/filter)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, question, search, productId, teamId: queryTeamId } = req.query;
    const teamId = (req as any).user?.teamId || (queryTeamId as string);

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { productRepository: repo } = getServices();

    let faqs: any[] = [];
    if (productId && typeof productId === 'string') {
      faqs = await repo.getProductFAQsByProductId(productId);
    } else if (search && typeof search === 'string') {
      faqs = await repo.searchProductFAQs(search, {
        teamId: teamId,
        category: category as string,
      });
    } else {
      faqs = await repo.findProductFAQs({
        teamId: teamId,
        category: category as string,
        question: question as string,
      });
    }

    res.status(200).json({
      data: faqs,
    });
  } catch (error) {
    logger.error('Error fetching FAQs', error);
    next(error);
  }
});

// GET /api/faqs/:id - Get FAQ details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { teamId: queryTeamId } = req.query;
    const { productRepository: repo } = getServices();

    const faq = await repo.findProductFAQById(id);

    if (!faq) {
      return res.status(404).json({
        message: 'FAQ not found',
        code: 'NOT_FOUND',
      } as ErrorResponse);
    }

    // Check team access
    const teamId = (req as any).user?.teamId || (queryTeamId as string);
    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    if (faq.teamId !== teamId) {
      return res.status(403).json({
        message: 'Access denied',
        code: 'FORBIDDEN',
      } as ErrorResponse);
    }

    res.status(200).json({
      data: faq,
    });
  } catch (error) {
    logger.error('Error fetching FAQ', error);
    next(error);
  }
});

// PATCH /api/faqs/:id - Update FAQ
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
    const teamId = (req as any).user?.teamId || req.body.teamId || (req.query.teamId as string);
    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    if (existing.teamId !== teamId) {
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

// DELETE /api/faqs/:id - Delete FAQ
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
    const teamId = (req as any).user?.teamId || (req.query.teamId as string) || req.body.teamId;
    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    if (existing.teamId !== teamId) {
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

// POST /api/faqs/:id/helpful - Mark FAQ as helpful (for analytics)
router.post('/:id/helpful', async (req: Request, res: Response, next: NextFunction) => {
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

    const faq = await repo.markFAQHelpful(id);

    logger.info(`Marked FAQ as helpful: ${faq.id}`);

    res.status(200).json({
      message: 'FAQ marked as helpful',
      data: faq,
    });
  } catch (error) {
    logger.error('Error marking FAQ as helpful', error);
    next(error);
  }
});

// POST /api/faqs/import - Bulk import from CSV
router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format, data, mapping, teamId: bodyTeamId } = req.body;
    const teamId = (req as any).user?.teamId || bodyTeamId;

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

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { importService: service } = getServices();
    let result: any;

    if (format === 'csv') {
      // CSV data is sent as base64 encoded string
      const buffer = Buffer.from(data, 'base64');
      result = await service.importFAQsFromCSV(buffer, teamId, mapping || {});
    } else {
      // JSON data is sent as array of objects
      result = await service.importFAQsFromJSON(data, teamId, mapping || {});
    }

    logger.info(`Imported ${result.imported} FAQs`);

    if (result.errors.length > 0) {
      logger.warn(`Import had ${result.errors.length} errors`, result.errors);
    }

    res.status(200).json({
      message: `Successfully imported ${result.imported} FAQs`,
      data: {
        imported: result.imported,
        errors: result.errors,
      },
    });
  } catch (error) {
    logger.error('Error importing FAQs', error);
    next(error);
  }
});

export default router;
