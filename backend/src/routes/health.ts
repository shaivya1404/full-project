import { Router, Request, Response } from 'express';
import os from 'os';
import { prisma } from '../db/client';
import { config, isProduction } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();

// Track request counts
let requestCount = 0;
let errorCount = 0;

export const incrementRequestCount = () => requestCount++;
export const incrementErrorCount = () => errorCount++;

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'healthy',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      responseTime: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Detailed health check (for monitoring systems)
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: Record<string, { status: string; responseTime?: number; error?: string }> = {};

  // Database check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', responseTime: Date.now() - dbStart };
  } catch (error: any) {
    checks.database = { status: 'unhealthy', error: error.message };
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memoryUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

  checks.memory = {
    status: memoryUsagePercent < 90 ? 'healthy' : 'warning',
    responseTime: 0,
  };

  // Disk space check (for recordings directory)
  // Note: This is simplified; production should use proper disk check

  const overallStatus = Object.values(checks).every((c) => c.status === 'healthy')
    ? 'healthy'
    : Object.values(checks).some((c) => c.status === 'unhealthy')
    ? 'unhealthy'
    : 'degraded';

  res.status(overallStatus === 'unhealthy' ? 503 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
    uptime: Math.floor(process.uptime()),
    responseTime: Date.now() - startTime,
    checks,
    system: isProduction
      ? undefined
      : {
          nodeVersion: process.version,
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: Math.floor(totalMem / 1024 / 1024) + ' MB',
          freeMemory: Math.floor(freeMem / 1024 / 1024) + ' MB',
          memoryUsage: {
            heapUsed: Math.floor(memUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.floor(memUsage.heapTotal / 1024 / 1024) + ' MB',
            rss: Math.floor(memUsage.rss / 1024 / 1024) + ' MB',
          },
        },
  });
});

// Metrics endpoint (for Prometheus/Grafana)
router.get('/metrics', async (req: Request, res: Response) => {
  const metrics: string[] = [];
  const memUsage = process.memoryUsage();

  // Node.js metrics
  metrics.push(`# HELP nodejs_uptime_seconds Node.js process uptime in seconds`);
  metrics.push(`# TYPE nodejs_uptime_seconds gauge`);
  metrics.push(`nodejs_uptime_seconds ${Math.floor(process.uptime())}`);

  metrics.push(`# HELP nodejs_heap_used_bytes Node.js heap used bytes`);
  metrics.push(`# TYPE nodejs_heap_used_bytes gauge`);
  metrics.push(`nodejs_heap_used_bytes ${memUsage.heapUsed}`);

  metrics.push(`# HELP nodejs_heap_total_bytes Node.js heap total bytes`);
  metrics.push(`# TYPE nodejs_heap_total_bytes gauge`);
  metrics.push(`nodejs_heap_total_bytes ${memUsage.heapTotal}`);

  metrics.push(`# HELP nodejs_rss_bytes Node.js RSS bytes`);
  metrics.push(`# TYPE nodejs_rss_bytes gauge`);
  metrics.push(`nodejs_rss_bytes ${memUsage.rss}`);

  // Application metrics
  metrics.push(`# HELP app_request_total Total number of requests`);
  metrics.push(`# TYPE app_request_total counter`);
  metrics.push(`app_request_total ${requestCount}`);

  metrics.push(`# HELP app_error_total Total number of errors`);
  metrics.push(`# TYPE app_error_total counter`);
  metrics.push(`app_error_total ${errorCount}`);

  // Database metrics
  try {
    const callCount = await prisma.call.count();
    const orderCount = await prisma.order.count();
    const paymentCount = await prisma.payment.count();
    const userCount = await prisma.user.count();

    metrics.push(`# HELP app_calls_total Total number of calls`);
    metrics.push(`# TYPE app_calls_total gauge`);
    metrics.push(`app_calls_total ${callCount}`);

    metrics.push(`# HELP app_orders_total Total number of orders`);
    metrics.push(`# TYPE app_orders_total gauge`);
    metrics.push(`app_orders_total ${orderCount}`);

    metrics.push(`# HELP app_payments_total Total number of payments`);
    metrics.push(`# TYPE app_payments_total gauge`);
    metrics.push(`app_payments_total ${paymentCount}`);

    metrics.push(`# HELP app_users_total Total number of users`);
    metrics.push(`# TYPE app_users_total gauge`);
    metrics.push(`app_users_total ${userCount}`);
  } catch (error) {
    logger.error('Error fetching metrics', error);
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.join('\n'));
});

// Readiness check (for Kubernetes)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Liveness check (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
