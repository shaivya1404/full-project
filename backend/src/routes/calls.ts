import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import { CallRepository } from '../db/repositories/callRepository';
import { StorageService } from '../services/storageService';
import { logger } from '../utils/logger';

const router = Router();

let callRepository: CallRepository;
let storageService: StorageService;

const getRepositories = () => {
  if (!callRepository) {
    callRepository = new CallRepository();
  }
  if (!storageService) {
    storageService = new StorageService();
  }
  return { callRepository, storageService };
};

interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
}

interface PaginationParams {
  limit: number;
  offset: number;
}

interface CallFilters {
  caller?: string;
  agent?: string;
  status?: string;
  sentiment?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

const getPaginationParams = (req: Request): PaginationParams => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
  // Accept both 'offset' and 'page' params - frontend sends 'page', convert to offset
  const page = parseInt(req.query.page as string) || 0;
  const offset = Math.max(parseInt(req.query.offset as string) || (page > 0 ? (page - 1) * limit : 0), 0);
  return { limit, offset };
};

const getCallFilters = (req: Request): CallFilters => {
  const filters: CallFilters = {};

  if (req.query.caller && typeof req.query.caller === 'string') {
    filters.caller = req.query.caller;
  }
  if (req.query.agent && typeof req.query.agent === 'string') {
    filters.agent = req.query.agent;
  }
  if (req.query.status && typeof req.query.status === 'string') {
    filters.status = req.query.status;
  }
  if (req.query.sentiment && typeof req.query.sentiment === 'string') {
    filters.sentiment = req.query.sentiment;
  }
  if (req.query.search && typeof req.query.search === 'string') {
    filters.search = req.query.search;
  }
  if (req.query.startDate && typeof req.query.startDate === 'string') {
    const date = new Date(req.query.startDate);
    if (!isNaN(date.getTime())) {
      filters.startDate = date;
    }
  }
  if (req.query.endDate && typeof req.query.endDate === 'string') {
    const date = new Date(req.query.endDate);
    if (!isNaN(date.getTime())) {
      filters.endDate = date;
    }
  }

  return filters;
};

// GET /api/calls/search - Search calls by various criteria
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = getPaginationParams(req);
    const filters = getCallFilters(req);
    const { callRepository: repo } = getRepositories();

    const { calls, total } = await repo.searchCalls(limit, offset, filters);

    res.status(200).json({
      data: calls,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Error searching calls', error);
    next(error);
  }
});

// GET /api/calls - List calls with pagination, search, and filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = getPaginationParams(req);
    const filters = getCallFilters(req);
    const { callRepository: repo } = getRepositories();

    const { calls, total } = await repo.searchCalls(limit, offset, filters);

    res.status(200).json({
      data: calls,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching calls', error);
    next(error);
  }
});

// GET /api/calls/:id - Get call with metadata and transcript
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { callRepository: repo } = getRepositories();
    const call = await repo.getCallWithDetails(id);

    if (!call) {
      return res.status(404).json({
        message: 'Call not found',
        code: 'CALL_NOT_FOUND',
      } as ErrorResponse);
    }

    res.status(200).json({ data: call });
  } catch (error) {
    logger.error('Error fetching call', error);
    next(error);
  }
});

// GET /api/calls/:id/recording - Stream or download recording
router.get('/:id/recording', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const download = req.query.download === 'true';
    const { callRepository: repo, storageService: storage } = getRepositories();

    const call = await repo.getCallWithDetails(id);
    if (!call) {
      return res.status(404).json({
        message: 'Call not found',
        code: 'CALL_NOT_FOUND',
      } as ErrorResponse);
    }

    if (!call.recordings || call.recordings.length === 0) {
      return res.status(404).json({
        message: 'No recording found for this call',
        code: 'RECORDING_NOT_FOUND',
      } as ErrorResponse);
    }

    const recording = call.recordings[0];
    const filePath = recording.filePath;

    const fileExists = await storage.fileExists(filePath);
    if (!fileExists) {
      return res.status(404).json({
        message: 'Recording file not found on storage',
        code: 'FILE_NOT_FOUND',
      } as ErrorResponse);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    if (download) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="recording-${call.id}.${recording.format || 'wav'}"`,
      );
    } else {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Accept-Ranges', 'bytes');
    }

    res.setHeader('Content-Length', fileSize);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (error) => {
      logger.error('Error streaming recording', error);
      if (!res.headersSent) {
        res.status(500).json({
          message: 'Error streaming recording',
          code: 'STREAM_ERROR',
        } as ErrorResponse);
      }
    });
  } catch (error) {
    logger.error('Error handling recording request', error);
    next(error);
  }
});

// GET /api/calls/:id/transcript - Get detailed transcript
router.get('/:id/transcript', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { callRepository: repo } = getRepositories();

    const call = await repo.getCallWithDetails(id);
    if (!call) {
      return res.status(404).json({
        message: 'Call not found',
        code: 'CALL_NOT_FOUND',
      } as ErrorResponse);
    }

    const transcripts = call.transcripts.map((t) => ({
      id: t.id,
      speaker: t.speaker,
      text: t.text,
      confidence: t.confidence,
      startTime: t.startTime,
      endTime: t.endTime,
      timestamp: t.createdAt,
    }));

    res.status(200).json({
      data: {
        callId: call.id,
        callStartTime: call.startTime,
        callEndTime: call.endTime,
        transcripts,
        totalSegments: transcripts.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching transcript', error);
    next(error);
  }
});

// POST /api/calls/:id/notes - Add notes to a call
router.post('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes || typeof notes !== 'string') {
      return res.status(400).json({
        message: 'Notes are required and must be a string',
        code: 'INVALID_NOTES',
      } as ErrorResponse);
    }

    const { callRepository: repo } = getRepositories();

    const existingCall = await repo.getCallById(id);
    if (!existingCall) {
      return res.status(404).json({
        message: 'Call not found',
        code: 'CALL_NOT_FOUND',
      } as ErrorResponse);
    }

    const updatedCall = await repo.updateCall(id, { notes });

    res.status(200).json({
      message: 'Notes added successfully',
      data: updatedCall,
    });
  } catch (error) {
    logger.error('Error adding notes to call', error);
    next(error);
  }
});

// POST /api/calls/:id/transfer - Initiate transfer
router.post('/:id/transfer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason, priority, requiredSkills, teamId, context } = req.body;
    
    const { QueueService } = await import('../services/queueService');
    const queueService = new QueueService();
    
    const result = await queueService.requestTransfer(id, {
      reason,
      priority,
      requiredSkills,
      teamId,
      context
    });
    
    res.status(200).json({ data: result });
  } catch (error) {
    logger.error('Error initiating transfer', error);
    next(error);
  }
});

// GET /api/calls/:id/transfer-history - Get transfer details
router.get('/:id/transfer-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { QueueRepository } = await import('../db/repositories/queueRepository');
    const repo = new QueueRepository();
    
    const history = await repo.getTransferHistory(id);
    res.status(200).json({ data: history });
  } catch (error) {
    logger.error('Error fetching transfer history', error);
    next(error);
  }
});

export default router;
