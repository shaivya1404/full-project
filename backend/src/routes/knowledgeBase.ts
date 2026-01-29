import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { KnowledgeBaseRepository } from '../db/repositories/knowledgeBaseRepository';
import { ImportService } from '../services/importService';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as util from 'util';

const router = Router();
const unlinkAsync = util.promisify(fs.unlink);

let knowledgeBaseRepository: KnowledgeBaseRepository;
let importService: ImportService;

const getServices = () => {
  if (!knowledgeBaseRepository) {
    knowledgeBaseRepository = new KnowledgeBaseRepository();
  }
  if (!importService) {
    importService = new ImportService();
  }
  return { knowledgeBaseRepository, importService };
};

interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
}

// POST /api/knowledge-base - Create knowledge document
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, category, tags } = req.body;
    const teamId = (req as any).user?.teamId || req.body.teamId;

    if (!title || !content) {
      return res.status(400).json({
        message: 'Title and content are required',
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { knowledgeBaseRepository: repo } = getServices();
    const knowledgeBase = await repo.create({
      title,
      content,
      teamId: teamId,
      category,
      tags,
    });

    logger.info(`Created knowledge base entry: ${knowledgeBase.id}`);

    res.status(201).json({
      message: 'Knowledge base document created successfully',
      data: knowledgeBase,
    });
  } catch (error) {
    logger.error('Error creating knowledge base document', error);
    next(error);
  }
});

// GET /api/knowledge-base - List all knowledge documents (with search/filter)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, tags, search, teamId: queryTeamId } = req.query;
    const teamId = (req as any).user?.teamId || (queryTeamId as string);

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { knowledgeBaseRepository: repo } = getServices();

    let knowledgeBase: any[] = [];
    if (search && typeof search === 'string') {
      const searchTags = tags ? (typeof tags === 'string' ? tags.split(',') : tags) : undefined;
      knowledgeBase = await repo.search(search, {
        teamId: teamId,
        category: category as string,
        tags: searchTags as string[],
      });
    } else {
      const filterTags = tags ? (typeof tags === 'string' ? tags.split(',') : tags) : undefined;
      knowledgeBase = await repo.findMany({
        teamId: teamId,
        category: category as string,
        tags: filterTags as string[],
      });
    }

    res.status(200).json({
      data: knowledgeBase,
    });
  } catch (error) {
    logger.error('Error fetching knowledge base documents', error);
    next(error);
  }
});

// GET /api/knowledge-base/:id - Get single document
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { knowledgeBaseRepository: repo } = getServices();

    const knowledgeBase = await repo.findById(id);

    if (!knowledgeBase) {
      return res.status(404).json({
        message: 'Knowledge base document not found',
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

    if (knowledgeBase.teamId !== teamId) {
      return res.status(403).json({
        message: 'Access denied',
        code: 'FORBIDDEN',
      } as ErrorResponse);
    }

    res.status(200).json({
      data: knowledgeBase,
    });
  } catch (error) {
    logger.error('Error fetching knowledge base document', error);
    next(error);
  }
});

// PATCH /api/knowledge-base/:id - Update document
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, content, category, tags } = req.body;
    const user = (req as any).user;

    const { knowledgeBaseRepository: repo } = getServices();

    const existing = await repo.findById(id);
    if (!existing) {
      return res.status(404).json({
        message: 'Knowledge base document not found',
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
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;

    const knowledgeBase = await repo.update(id, updateData);

    logger.info(`Updated knowledge base entry: ${knowledgeBase.id}`);

    res.status(200).json({
      message: 'Knowledge base document updated successfully',
      data: knowledgeBase,
    });
  } catch (error) {
    logger.error('Error updating knowledge base document', error);
    next(error);
  }
});

// DELETE /api/knowledge-base/:id - Delete document
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const { knowledgeBaseRepository: repo } = getServices();

    const existing = await repo.findById(id);
    if (!existing) {
      return res.status(404).json({
        message: 'Knowledge base document not found',
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

    await repo.delete(id);

    logger.info(`Deleted knowledge base entry: ${id}`);

    res.status(200).json({
      message: 'Knowledge base document deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting knowledge base document', error);
    next(error);
  }
});

// GET /api/knowledge-base/search - Full-text search
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, category, tags } = req.query;
    const teamId = (req as any).user?.teamId || (req.query.teamId as string);

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        message: 'Search query is required',
        code: 'QUERY_REQUIRED',
      } as ErrorResponse);
    }

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    const { knowledgeBaseRepository: repo } = getServices();

    const searchTags = tags ? (typeof tags === 'string' ? tags.split(',') : tags) : undefined;
    const results = await repo.search(q, {
      teamId: teamId,
      category: category as string,
      tags: searchTags as any,
    });

    res.status(200).json({
      data: results,
    });
  } catch (error) {
    logger.error('Error searching knowledge base', error);
    next(error);
  }
});

// POST /api/knowledge-base/import - Bulk import from CSV/JSON
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
      result = await service.importKnowledgeBaseFromCSV(buffer, teamId, mapping || {});
    } else {
      // JSON data is sent as array of objects
      result = await service.importKnowledgeBaseFromJSON(data, teamId, mapping || {});
    }

    logger.info(`Imported ${result.imported} knowledge base entries`);

    if (result.errors.length > 0) {
      logger.warn(`Import had ${result.errors.length} errors`, result.errors);
    }

    res.status(200).json({
      message: `Successfully imported ${result.imported} knowledge base entries`,
      data: {
        imported: result.imported,
        errors: result.errors,
      },
    });
  } catch (error) {
    logger.error('Error importing knowledge base', error);
    next(error);
  }
});

export default router;
