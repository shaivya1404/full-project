import { Router, Request, Response, NextFunction } from 'express';
import { QueueRepository } from '../db/repositories/queueRepository';
import { logger } from '../utils/logger';

const router = Router();
let queueRepository: QueueRepository;

const getRepository = () => {
  if (!queueRepository) {
    queueRepository = new QueueRepository();
  }
  return queueRepository;
};

// GET /api/queue - Get current queue status
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const teamId = req.query.teamId as string;
    const queue = await repo.getActiveQueue(teamId);
    res.status(200).json({ data: queue });
  } catch (error) {
    logger.error('Error fetching queue', error);
    next(error);
  }
});

export default router;
