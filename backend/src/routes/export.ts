import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { exportService, ExportType, ExportFormat, ExportFilters } from '../services/exportService';
import { z } from 'zod';
import { logger } from '../utils/logger';
import fs from 'fs';

const router = Router();

const createExportSchema = z.object({
  type: z.enum(['calls', 'orders', 'payments', 'analytics', 'agents', 'campaigns', 'customers', 'invoices', 'audit_logs']),
  format: z.enum(['csv', 'pdf', 'json']),
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
    teamId: z.string().optional(),
    search: z.string().optional(),
  }).optional(),
});

// Create export job
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createExportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid export request',
        details: validation.error.format(),
      });
    }

    const { type, format, filters = {} } = validation.data;

    // Parse dates if provided
    const parsedFilters: ExportFilters = {
      status: filters.status,
      teamId: filters.teamId,
      search: filters.search,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    };

    const jobId = await exportService.createExportJob(
      req.user!.id,
      req.teamId,
      type as ExportType,
      format as ExportFormat,
      parsedFilters
    );

    res.status(202).json({
      success: true,
      data: {
        jobId,
        message: 'Export job created. Check status using the job ID.',
        statusUrl: `/api/export/${jobId}`,
      },
    });
  } catch (error) {
    logger.error('Error creating export job', error);
    next(error);
  }
});

// Get export job status
router.get('/:jobId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const job = await exportService.getExportJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Export job not found',
      });
    }

    // Check ownership
    if (job.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: {
        id: job.id,
        type: job.type,
        format: job.format,
        status: job.status,
        recordCount: job.recordCount,
        fileSize: job.fileSize,
        downloadUrl: job.fileUrl,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        expiresAt: job.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Error getting export job', error);
    next(error);
  }
});

// List user's export jobs
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const jobs = await exportService.getExportJobs(req.user!.id, limit);

    res.json({
      success: true,
      data: jobs.map((job) => ({
        id: job.id,
        type: job.type,
        format: job.format,
        status: job.status,
        recordCount: job.recordCount,
        fileSize: job.fileSize,
        downloadUrl: job.fileUrl,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
      })),
    });
  } catch (error) {
    logger.error('Error listing export jobs', error);
    next(error);
  }
});

// Download export file
router.get('/download/:jobId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const job = await exportService.getExportJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Export job not found',
      });
    }

    // Check ownership
    if (job.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: `Export is ${job.status}`,
      });
    }

    const downloadInfo = await exportService.downloadExport(jobId);
    if (!downloadInfo) {
      return res.status(404).json({
        success: false,
        error: 'Export file not found or expired',
      });
    }

    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      csv: 'text/csv',
      pdf: 'application/pdf',
      json: 'application/json',
    };

    res.setHeader('Content-Type', contentTypes[job.format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.fileName}"`);
    res.setHeader('Content-Length', job.fileSize);

    const stream = fs.createReadStream(downloadInfo.filePath);
    stream.pipe(res);
  } catch (error) {
    logger.error('Error downloading export', error);
    next(error);
  }
});

// Quick export (sync for small datasets)
router.post('/quick', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createExportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid export request',
      });
    }

    const { type, format, filters = {} } = validation.data;

    // Create job and wait for completion
    const jobId = await exportService.createExportJob(
      req.user!.id,
      req.teamId,
      type as ExportType,
      format as ExportFormat,
      filters as ExportFilters
    );

    // Poll for completion (max 30 seconds)
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const job = await exportService.getExportJob(jobId);
      if (job.status === 'completed') {
        const downloadInfo = await exportService.downloadExport(jobId);
        if (downloadInfo) {
          const contentTypes: Record<string, string> = {
            csv: 'text/csv',
            pdf: 'application/pdf',
            json: 'application/json',
          };

          res.setHeader('Content-Type', contentTypes[format] || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.fileName}"`);

          const stream = fs.createReadStream(downloadInfo.filePath);
          return stream.pipe(res);
        }
      } else if (job.status === 'failed') {
        return res.status(500).json({
          success: false,
          error: job.error || 'Export failed',
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    // Timeout - return job ID for async download
    res.status(202).json({
      success: true,
      data: {
        jobId,
        message: 'Export is taking longer than expected. Use the job ID to check status.',
        statusUrl: `/api/export/${jobId}`,
      },
    });
  } catch (error) {
    logger.error('Error in quick export', error);
    next(error);
  }
});

export default router;
