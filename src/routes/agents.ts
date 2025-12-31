import { Router, Request, Response, NextFunction } from 'express';
import { AgentRepository } from '../db/repositories/agentRepository';
import { logger } from '../utils/logger';

const router = Router();
let agentRepository: AgentRepository;

const getRepository = () => {
  if (!agentRepository) {
    agentRepository = new AgentRepository();
  }
  return agentRepository;
};

// POST /api/agents - Create agent
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const agent = await repo.createAgent(req.body);
    res.status(201).json({ data: agent });
  } catch (error) {
    logger.error('Error creating agent', error);
    next(error);
  }
});

// GET /api/agents - List agents (team-scoped)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const teamId = req.query.teamId as string;
    const agents = await repo.listAgents(teamId);
    res.status(200).json({ data: agents });
  } catch (error) {
    logger.error('Error listing agents', error);
    next(error);
  }
});

// PATCH /api/agents/:id - Update agent status/availability
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const agent = await repo.updateAgent(req.params.id, req.body);
    res.status(200).json({ data: agent });
  } catch (error) {
    logger.error('Error updating agent', error);
    next(error);
  }
});

// POST /api/agents/:id/status - Toggle online/offline
router.post('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    const repo = getRepository();
    const agent = await repo.setAgentStatus(req.params.id, status);
    res.status(200).json({ data: agent });
  } catch (error) {
    logger.error('Error setting agent status', error);
    next(error);
  }
});

// GET /api/agents/:id/sessions - Get agent's active/past calls
router.get('/:id/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const sessions = await repo.getAgentSessions(req.params.id);
    res.status(200).json({ data: sessions });
  } catch (error) {
    logger.error('Error fetching agent sessions', error);
    next(error);
  }
});

// POST /api/agents/:id/accept-transfer - Agent accepts call
router.post('/:id/accept-transfer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // This would involve logic to connect the call
    // For now, we update the agent session and queue status
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ message: 'callId is required' });
    
    // Logic to accept transfer...
    res.status(200).json({ message: 'Transfer accepted' });
  } catch (error) {
    logger.error('Error accepting transfer', error);
    next(error);
  }
});

// POST /api/agents/:id/decline-transfer - Agent declines call
router.post('/:id/decline-transfer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ message: 'callId is required' });

    // Logic to decline transfer...
    res.status(200).json({ message: 'Transfer declined' });
  } catch (error) {
    logger.error('Error declining transfer', error);
    next(error);
  }
});

export default router;
