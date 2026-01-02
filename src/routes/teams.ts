import { Router, Request, Response, NextFunction } from 'express';
import { getTeamRepository } from '../db/repositories/teamRepository';
import { getUserRepository } from '../db/repositories/userRepository';
import { authenticate } from '../middleware/auth';
import { teamActionRateLimiter } from '../middleware/rateLimiter';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router({ mergeParams: true });

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

function getZodErrorMessage(error: any): string {
  if (error && typeof error === 'object') {
    const issues = error.issues || error.errors;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues[0]?.message || 'Validation error';
    }
  }
  return 'Validation error';
}

const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().max(500).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'manager', 'agent', 'viewer']).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'agent', 'viewer']),
});

const paginationSchema = z.object({
  limit: z.string().transform((val) => Number(val)).optional().default(100),
  offset: z.string().transform((val) => Number(val)).optional().default(0),
});

// router.use(authenticate);

router.post('/', teamActionRateLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validationResult = createTeamSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { name, description } = validationResult.data;

    const ownerId = req.user?.id || req.body.ownerId || req.body.userId;

    if (!ownerId) {
      return res.status(400).json({
        success: false,
        error: 'Owner ID (userId) is required',
        code: 'OWNER_REQUIRED',
      } as ErrorResponse);
    }

    const teamRepo = getTeamRepository();
    const team = await teamRepo.createTeam({
      name,
      description,
      ownerId,
    });

    await teamRepo.createAuditLog(
      team.id,
      ownerId,
      'team.create',
      'team',
      team.id,
      JSON.stringify({ name, description }),
      req.ip || undefined,
      req.headers['user-agent'] || undefined,
    );

    res.status(201).json({
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          ownerId: team.ownerId,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          members: team.members.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            createdAt: m.createdAt,
          })),
        },
      },
      message: 'Team created successfully',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error creating team', error);
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req.query.userId as string);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        code: 'USER_REQUIRED',
      } as ErrorResponse);
    }

    const teamRepo = getTeamRepository();
    const teams = await teamRepo.getTeamsByUserId(userId);

    res.status(200).json({
      success: true,
      data: {
        teams: teams.map((team) => ({
          id: team.id,
          name: team.name,
          description: team.description,
          ownerId: team.ownerId,
          memberCount: team.members.length,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          myRole: team.members.find((m) => m.userId === userId)?.role,
        })),
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error fetching teams', error);
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamRepo = getTeamRepository();
    const team = await teamRepo.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND',
      } as ErrorResponse);
    }

    const userId = (req as any).user?.id || (req.query.userId as string);
    const userRole = userId ? await teamRepo.getUserTeamRole(req.params.id, userId) : 'viewer';

    /* if (!userRole) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
        code: 'NOT_TEAM_MEMBER',
      } as ErrorResponse);
    } */

    res.status(200).json({
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          ownerId: team.ownerId,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          myRole: userRole,
          members: team.members.map((m: any) => ({
            id: m.id,
            user: {
              id: m.user.id,
              email: m.user.email,
              firstName: m.user.firstName,
              lastName: m.user.lastName,
              isActive: m.user.isActive,
              lastLoginAt: m.user.lastLoginAt,
            },
            role: m.role,
            joinedAt: m.createdAt,
          })),
          stats: {
            campaignsCount: team.campaigns?.length || 0,
            callsCount: team.calls?.length || 0,
            apiKeysCount: team.apiKeys?.length || 0,
          },
        },
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error fetching team', error);
    next(error);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamRepo = getTeamRepository();
    const team = await teamRepo.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND',
      } as ErrorResponse);
    }

    /* if (team.ownerId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Only team owner can update team details',
        code: 'NOT_TEAM_OWNER',
      } as ErrorResponse);
    } */

    const validationResult = createTeamSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const updatedTeam = await teamRepo.updateTeam(req.params.id, validationResult.data);

    await teamRepo.createAuditLog(
      req.params.id,
      (req as any).user?.id || req.body.userId || 'system',
      'team.update',
      'team',
      req.params.id,
      JSON.stringify(validationResult.data),
      req.ip || undefined,
      req.headers['user-agent'] || undefined,
    );

    res.status(200).json({
      success: true,
      data: {
        team: {
          id: updatedTeam.id,
          name: updatedTeam.name,
          description: updatedTeam.description,
          ownerId: updatedTeam.ownerId,
          createdAt: updatedTeam.createdAt,
          updatedAt: updatedTeam.updatedAt,
        },
      },
      message: 'Team updated successfully',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error updating team', error);
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamRepo = getTeamRepository();
    const team = await teamRepo.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND',
      } as ErrorResponse);
    }

    /* if (team.ownerId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Only team owner can delete the team',
        code: 'NOT_TEAM_OWNER',
      } as ErrorResponse);
    } */

    await teamRepo.createAuditLog(
      req.params.id,
      (req as any).user?.id || 'system',
      'team.delete',
      'team',
      req.params.id,
      JSON.stringify({ name: team.name }),
      req.ip || undefined,
      req.headers['user-agent'] || undefined,
    );

    await teamRepo.deleteTeam(req.params.id);

    res.status(200).json({
      success: true,
      data: {},
      message: 'Team deleted successfully',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error deleting team', error);
    next(error);
  }
});

router.get('/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamRepo = getTeamRepository();
    const members = await teamRepo.getTeamMembers(req.params.id);

    const userId = (req as any).user?.id || (req.query.userId as string);
    const userRole = userId ? await teamRepo.getUserTeamRole(req.params.id, userId) : 'viewer';

    /* if (!userRole) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
        code: 'NOT_TEAM_MEMBER',
      } as ErrorResponse);
    } */

    res.status(200).json({
      success: true,
      data: {
        members: members.map((m) => ({
          id: m.id,
          user: {
            id: m.user.id,
            email: m.user.email,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            isActive: m.user.isActive,
            lastLoginAt: m.user.lastLoginAt,
          },
          role: m.role,
          joinedAt: m.createdAt,
        })),
        myRole: userRole,
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error fetching team members', error);
    next(error);
  }
});

router.post('/:id/members', teamActionRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamRepo = getTeamRepository();
    const team = await teamRepo.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND',
      } as ErrorResponse);
    }

    const userIdCtx = (req as any).user?.id || req.body.operatorId || req.query.operatorId;
    const userRoleCtx = userIdCtx ? await teamRepo.getUserTeamRole(req.params.id, userIdCtx) : 'admin'; // Fallback to admin for public access?


    /* if (!userRoleCtx) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
        code: 'NOT_TEAM_MEMBER',
      } as ErrorResponse);
    } */

    const validationResult = addMemberSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { userId, role } = validationResult.data;

    const userRepo = getUserRepository();
    const userToAdd = await userRepo.getUserById(userId);

    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      } as ErrorResponse);
    }

    const existingMember = await teamRepo.getTeamMember(req.params.id, userId);

    if (existingMember) {
      return res.status(409).json({
        success: false,
        error: 'User is already a team member',
        code: 'ALREADY_MEMBER',
      } as ErrorResponse);
    }

    const member = await teamRepo.addTeamMember(req.params.id, { userId, role });

    await teamRepo.createAuditLog(
      req.params.id,
      (req as any).user?.id || req.body.operatorId || 'system',
      'team.member.add',
      'team_member',
      member.id,
      JSON.stringify({ userId, role: member.role, addedUserEmail: userToAdd.email }),
      req.ip || undefined,
      req.headers['user-agent'] || undefined,
    );

    res.status(201).json({
      success: true,
      data: {
        member: {
          id: member.id,
          user: {
            id: member.user.id,
            email: member.user.email,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            isActive: member.user.isActive,
          },
          role: member.role,
          joinedAt: member.createdAt,
        },
      },
      message: 'Member added successfully',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error adding team member', error);
    next(error);
  }
});

router.delete('/:id/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamRepo = getTeamRepository();
    const team = await teamRepo.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND',
      } as ErrorResponse);
    }

    const userIdCtxDel = (req as any).user?.id || (req.query as any).userId;
    const userRole = userIdCtxDel ? await teamRepo.getUserTeamRole(req.params.id, userIdCtxDel) : 'admin';

    /* if (!userRole) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
        code: 'NOT_TEAM_MEMBER',
      } as ErrorResponse);
    } */

    const members = await teamRepo.getTeamMembers(req.params.id);
    const member = members.find((m) => m.id === req.params.memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found',
        code: 'MEMBER_NOT_FOUND',
      } as ErrorResponse);
    }

    if (member.userId === (req as any).user?.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove yourself from the team',
        code: 'CANNOT_REMOVE_SELF',
      } as ErrorResponse);
    }

    try {
      await teamRepo.removeTeamMember(req.params.id, req.params.memberId);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(400).json({
          success: false,
          error: err.message,
          code: 'REMOVE_MEMBER_ERROR',
        } as ErrorResponse);
      }
      throw err;
    }

    await teamRepo.createAuditLog(
      req.params.id,
      (req as any).user?.id || 'system',
      'team.member.remove',
      'team_member',
      req.params.memberId,
      JSON.stringify({ removedUserId: member.userId, role: member.role }),
      req.ip || undefined,
      req.headers['user-agent'] || undefined,
    );

    res.status(200).json({
      success: true,
      data: {},
      message: 'Member removed successfully',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error removing team member', error);
    next(error);
  }
});

router.patch('/:id/members/:memberId/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamRepo = getTeamRepository();
    const team = await teamRepo.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND',
      } as ErrorResponse);
    }

    const userIdCtxRole = (req as any).user?.id || (req.query as any).userId;
    const userRole = userIdCtxRole ? await teamRepo.getUserTeamRole(req.params.id, userIdCtxRole) : 'admin';

    /* if (!userRole) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
        code: 'NOT_TEAM_MEMBER',
      } as ErrorResponse);
    } */

    const validationResult = updateRoleSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { role } = validationResult.data;

    const members = await teamRepo.getTeamMembers(req.params.id);
    const member = members.find((m) => m.id === req.params.memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found',
        code: 'MEMBER_NOT_FOUND',
      } as ErrorResponse);
    }

    if (member.userId === (req as any).user?.id && role !== member.role) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change your own role',
        code: 'CANNOT_CHANGE_OWN_ROLE',
      } as ErrorResponse);
    }

    const updatedMember = await teamRepo.updateTeamMemberRole(req.params.id, req.params.memberId, role);

    await teamRepo.createAuditLog(
      req.params.id,
      (req as any).user?.id || 'system',
      'team.member.role_change',
      'team_member',
      req.params.memberId,
      JSON.stringify({ userId: member.userId, oldRole: member.role, newRole: role }),
      req.ip || undefined,
      req.headers['user-agent'] || undefined,
    );

    res.status(200).json({
      success: true,
      data: {
        member: {
          id: (updatedMember as any).id,
          user: {
            id: (updatedMember as any).user.id,
            email: (updatedMember as any).user.email,
            firstName: (updatedMember as any).user.firstName,
            lastName: (updatedMember as any).user.lastName,
            isActive: (updatedMember as any).user.isActive,
          },
          role: (updatedMember as any).role,
        },
      },
      message: 'Member role updated successfully',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error updating member role', error);
    next(error);
  }
});

router.get('/:id/audit-log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamRepo = getTeamRepository();
    const team = await teamRepo.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND',
      } as ErrorResponse);
    }

    const userIdCtxAudit = (req as any).user?.id || (req.query as any).userId;
    const userRole = userIdCtxAudit ? await teamRepo.getUserTeamRole(req.params.id, userIdCtxAudit) : 'admin';

    /* if (!userRole) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
        code: 'NOT_TEAM_MEMBER',
      } as ErrorResponse);
    } */

    const validationResult = paginationSchema.safeParse(req.query);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { limit, offset } = validationResult.data;

    const { logs, total } = await teamRepo.getTeamAuditLogs(req.params.id, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          details: log.details,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt,
        })),
        pagination: {
          total,
          limit,
          offset,
        },
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error fetching audit logs', error);
    next(error);
  }
});

export default router;
