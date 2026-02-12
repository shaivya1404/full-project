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

// GET /api/agents/available - Return available agents for a team
router.get('/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.query.teamId as string;
    const skill = req.query.skill as string | undefined;
    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }
    // Stub: return empty array of available agents
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error getting available agents', error);
    next(error);
  }
});

// GET /api/agents/search - Search agents by query
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.query.teamId as string;
    const q = req.query.q as string;
    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }
    // Stub: return empty search results
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error searching agents', error);
    next(error);
  }
});

// GET /api/agents/status/:status - Get agents filtered by status
router.get('/status/:status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.params;
    const teamId = req.query.teamId as string;
    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }
    // Stub: return empty array of agents with the given status
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error getting agents by status', error);
    next(error);
  }
});

// PUT /api/agents/skills/:id - Update a skill
router.put('/skills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skillId = req.params.id;
    const updates = req.body;
    // Stub: return the updated skill with provided data
    res.status(200).json({
      data: {
        id: skillId,
        agentId: '',
        skillName: updates.skillName || '',
        proficiencyLevel: updates.proficiencyLevel || 'beginner',
        isPrimary: updates.isPrimary || false,
        validationDate: updates.validationDate || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates,
      },
    });
  } catch (error) {
    logger.error('Error updating skill', error);
    next(error);
  }
});

// DELETE /api/agents/schedule/:shiftId - Delete a shift
router.delete('/schedule/:shiftId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shiftId } = req.params;
    // Stub: return success
    res.status(200).json({ success: true, message: `Shift ${shiftId} deleted successfully` });
  } catch (error) {
    logger.error('Error deleting shift', error);
    next(error);
  }
});

// PUT /api/agents/schedule/:shiftId - Update a shift
router.put('/schedule/:shiftId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shiftId } = req.params;
    const updates = req.body;
    // Stub: return updated shift
    res.status(200).json({
      data: {
        id: shiftId,
        agentId: updates.agentId || '',
        dayOfWeek: updates.dayOfWeek ?? 0,
        startTime: updates.startTime || '09:00',
        endTime: updates.endTime || '17:00',
        shiftType: updates.shiftType || 'regular',
        isRecurring: updates.isRecurring ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates,
      },
    });
  } catch (error) {
    logger.error('Error updating shift', error);
    next(error);
  }
});

// POST /api/agents/schedule/swap - Swap shifts between agents
router.post('/schedule/swap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromAgentId, toAgentId, shiftId } = req.body;
    if (!fromAgentId || !toAgentId || !shiftId) {
      return res.status(400).json({ message: 'fromAgentId, toAgentId, and shiftId are required' });
    }
    // Stub: return success
    res.status(200).json({ success: true, message: 'Shift swap completed successfully' });
  } catch (error) {
    logger.error('Error swapping shifts', error);
    next(error);
  }
});

// POST /api/agents/compare - Compare agents by IDs
router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentIds } = req.body;
    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ message: 'agentIds array is required' });
    }
    // Stub: return empty comparison data for each agent
    const comparisons = agentIds.map((id: string) => ({
      agentId: id,
      totalCalls: 0,
      averageHandleTime: 0,
      customerSatisfactionScore: 0,
      firstCallResolution: 0,
      callQualityScore: 0,
      scheduleAdherence: 0,
    }));
    res.status(200).json({ data: comparisons });
  } catch (error) {
    logger.error('Error comparing agents', error);
    next(error);
  }
});

// POST /api/agents/bulk-update - Bulk update agents
router.post('/bulk-update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentIds, updates } = req.body;
    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ message: 'agentIds array is required' });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ message: 'updates object is required' });
    }
    // Stub: return success
    res.status(200).json({ success: true, updated: agentIds.length });
  } catch (error) {
    logger.error('Error bulk updating agents', error);
    next(error);
  }
});

// GET /api/agents/:id - Get specific agent
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const agent = await repo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }
    res.status(200).json({ data: agent });
  } catch (error) {
    logger.error('Error getting agent', error);
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

// PUT /api/agents/:id - Update agent (frontend compatibility)
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const agent = await repo.updateAgent(req.params.id, req.body);
    res.status(200).json({ data: agent });
  } catch (error) {
    logger.error('Error updating agent', error);
    next(error);
  }
});

// DELETE /api/agents/:id - Delete agent
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const agent = await repo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }
    await repo.deleteAgent(req.params.id);
    res.status(200).json({ message: 'Agent deleted successfully' });
  } catch (error) {
    logger.error('Error deleting agent', error);
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

// GET /api/agents/:id/performance - Get agent performance metrics
router.get('/:id/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const agent = await repo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const performance = await repo.getAgentPerformance(req.params.id);
    res.status(200).json({ data: performance });
  } catch (error) {
    logger.error('Error getting agent performance', error);
    next(error);
  }
});

// GET /api/agents/:id/schedule - Get agent schedule
router.get('/:id/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const agent = await repo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const schedule = await repo.getAgentSchedule(req.params.id);
    res.status(200).json({ data: schedule });
  } catch (error) {
    logger.error('Error getting agent schedule', error);
    next(error);
  }
});

// PUT /api/agents/:id/schedule - Update agent schedule
router.put('/:id/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const agent = await repo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const schedule = await repo.updateAgentSchedule(req.params.id, req.body);
    res.status(200).json({ 
      message: 'Schedule updated successfully',
      data: schedule 
    });
  } catch (error) {
    logger.error('Error updating agent schedule', error);
    next(error);
  }
});

// GET /api/agents/:agentId/status - Get agent status
router.get('/:agentId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    // Stub: return mock agent availability status
    res.status(200).json({
      data: {
        agentId,
        agentName: '',
        status: 'offline',
        currentCalls: 0,
        skillTags: [],
        queuePosition: 0,
      },
    });
  } catch (error) {
    logger.error('Error getting agent status', error);
    next(error);
  }
});

// GET /api/agents/:agentId/metrics - Get agent metrics
router.get('/:agentId/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    // Stub: return default metrics
    res.status(200).json({
      data: {
        responseTime: 0,
        talkTimePercentage: 0,
        interruptionCount: 0,
        empathyScore: 0,
        scriptAdherence: 0,
        complianceScore: 0,
      },
    });
  } catch (error) {
    logger.error('Error getting agent metrics', error);
    next(error);
  }
});

// GET /api/agents/:agentId/availability - Get availability calendar
router.get('/:agentId/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    // Stub: return empty availability array
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error getting agent availability', error);
    next(error);
  }
});

// GET /api/agents/:agentId/skills - Get agent skills
router.get('/:agentId/skills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    // Stub: return empty skills array
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error getting agent skills', error);
    next(error);
  }
});

// POST /api/agents/:agentId/skills - Add skill to agent
router.post('/:agentId/skills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const skillData = req.body;
    // Stub: return the created skill
    res.status(201).json({
      data: {
        id: `skill_${Date.now()}`,
        agentId,
        skillName: skillData.skillName || '',
        proficiencyLevel: skillData.proficiencyLevel || 'beginner',
        isPrimary: skillData.isPrimary || false,
        validationDate: skillData.validationDate || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error adding agent skill', error);
    next(error);
  }
});

// DELETE /api/agents/:agentId/skills/:skillId - Remove skill from agent
router.delete('/:agentId/skills/:skillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, skillId } = req.params;
    // Stub: return success
    res.status(200).json({ success: true, message: `Skill ${skillId} removed from agent ${agentId}` });
  } catch (error) {
    logger.error('Error removing agent skill', error);
    next(error);
  }
});

// POST /api/agents/:agentId/schedule - Add shift for agent
router.post('/:agentId/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const shiftData = req.body;
    // Stub: return the created shift
    res.status(201).json({
      data: {
        id: `shift_${Date.now()}`,
        agentId,
        dayOfWeek: shiftData.dayOfWeek ?? 0,
        startTime: shiftData.startTime || '09:00',
        endTime: shiftData.endTime || '17:00',
        shiftType: shiftData.shiftType || 'regular',
        isRecurring: shiftData.isRecurring ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error adding agent shift', error);
    next(error);
  }
});

// GET /api/agents/:agentId/calls - Get agent's call history
router.get('/:agentId/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    // Stub: return empty paginated call list
    res.status(200).json({
      data: [],
      total: 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error getting agent calls', error);
    next(error);
  }
});

// GET /api/agents/:agentId/quality-scores - Get agent quality scores
router.get('/:agentId/quality-scores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    // Stub: return empty quality scores array
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error getting agent quality scores', error);
    next(error);
  }
});

// GET /api/agents/:agentId/queue - Get agent's queue
router.get('/:agentId/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    // Stub: return empty queue
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error getting agent queue', error);
    next(error);
  }
});

// POST /api/agents/:agentId/calls/:callId/accept - Accept call
router.post('/:agentId/calls/:callId/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, callId } = req.params;
    // Stub: return success
    res.status(200).json({ success: true, message: `Agent ${agentId} accepted call ${callId}` });
  } catch (error) {
    logger.error('Error accepting call', error);
    next(error);
  }
});

// POST /api/agents/:agentId/calls/:callId/decline - Decline call
router.post('/:agentId/calls/:callId/decline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, callId } = req.params;
    // Stub: return success
    res.status(200).json({ success: true, message: `Agent ${agentId} declined call ${callId}` });
  } catch (error) {
    logger.error('Error declining call', error);
    next(error);
  }
});

// GET /api/agents/:agentId/activity - Get agent activity log
router.get('/:agentId/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    // Stub: return empty activity log
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error getting agent activity log', error);
    next(error);
  }
});

// GET /api/agents/:agentId/certifications - Get agent certifications
router.get('/:agentId/certifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    // Stub: return empty certifications array
    res.status(200).json({ data: [] });
  } catch (error) {
    logger.error('Error getting agent certifications', error);
    next(error);
  }
});

// POST /api/agents/:agentId/certifications - Add certification to agent
router.post('/:agentId/certifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const certData = req.body;
    // Stub: return the created certification
    res.status(201).json({
      data: {
        id: `cert_${Date.now()}`,
        agentId,
        name: certData.name || '',
        issueDate: certData.issueDate || new Date().toISOString(),
        expiryDate: certData.expiryDate || null,
        documentUrl: certData.documentUrl || null,
        status: certData.status || 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error adding agent certification', error);
    next(error);
  }
});

// GET /api/agents/:agentId/compliance - Get agent compliance info
router.get('/:agentId/compliance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    // Stub: return default compliance data
    res.status(200).json({
      data: {
        agentId,
        isCompliant: true,
        complianceScore: 100,
        lastAuditDate: null,
        certifications: [],
        violations: [],
        checklist: [],
      },
    });
  } catch (error) {
    logger.error('Error getting agent compliance info', error);
    next(error);
  }
});

// POST /api/agents/:agentId/assign-team - Assign agent to team
router.post('/:agentId/assign-team', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const { teamId } = req.body;
    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }
    // Stub: return success
    res.status(200).json({ success: true, message: `Agent ${agentId} assigned to team ${teamId}` });
  } catch (error) {
    logger.error('Error assigning agent to team', error);
    next(error);
  }
});

export default router;
