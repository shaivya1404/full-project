import { Response, NextFunction } from 'express';
import { getTeamRepository } from '../db/repositories/teamRepository';
import { AuthRequest } from './auth';
import { hasPermission, canManageRole, Role } from './rbac';

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export const requireRole = (...allowedRoles: Role[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      } as ErrorResponse);
      return;
    }

    if (!req.teamId) {
      res.status(400).json({
        success: false,
        error: 'Team context required',
        code: 'TEAM_CONTEXT_REQUIRED',
      } as ErrorResponse);
      return;
    }

    const teamRepo = getTeamRepository();
    const userRole = await teamRepo.getUserTeamRole(req.teamId, req.user.id);

    if (!userRole) {
      res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
        code: 'NOT_TEAM_MEMBER',
      } as ErrorResponse);
      return;
    }

    if (!allowedRoles.includes(userRole as Role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
      } as ErrorResponse);
      return;
    }

    req.teamRole = userRole;
    next();
  };
};

export const requirePermission = (
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete' | 'manage',
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      } as ErrorResponse);
      return;
    }

    if (!req.teamId) {
      res.status(400).json({
        success: false,
        error: 'Team context required',
        code: 'TEAM_CONTEXT_REQUIRED',
      } as ErrorResponse);
      return;
    }

    const teamRepo = getTeamRepository();
    const userRole = await teamRepo.getUserTeamRole(req.teamId, req.user.id);

    if (!userRole) {
      res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
        code: 'NOT_TEAM_MEMBER',
      } as ErrorResponse);
      return;
    }

    if (!hasPermission(userRole as Role, resource, action)) {
      res.status(403).json({
        success: false,
        error: `Cannot ${action} ${resource}`,
        code: 'PERMISSION_DENIED',
      } as ErrorResponse);
      return;
    }

    req.teamRole = userRole;
    next();
  };
};

export const requireTeamMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    } as ErrorResponse);
    return;
  }

  if (!req.teamId) {
    res.status(400).json({
      success: false,
      error: 'Team context required',
      code: 'TEAM_CONTEXT_REQUIRED',
    } as ErrorResponse);
    return;
  }

  const teamRepo = getTeamRepository();
  const userRole = await teamRepo.getUserTeamRole(req.teamId, req.user.id);

  if (!userRole) {
    res.status(403).json({
      success: false,
      error: 'You are not a member of this team',
      code: 'NOT_TEAM_MEMBER',
    } as ErrorResponse);
    return;
  }

  req.teamRole = userRole;
  next();
};

export const requireTeamOwnerOrAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    } as ErrorResponse);
    return;
  }

  if (!req.teamId) {
    res.status(400).json({
      success: false,
      error: 'Team context required',
      code: 'TEAM_CONTEXT_REQUIRED',
    } as ErrorResponse);
    return;
  }

  const teamRepo = getTeamRepository();
  const team = await teamRepo.getTeamByIdSimple(req.teamId);

  if (!team) {
    res.status(404).json({
      success: false,
      error: 'Team not found',
      code: 'TEAM_NOT_FOUND',
    } as ErrorResponse);
    return;
  }

  const userRole = await teamRepo.getUserTeamRole(req.teamId, req.user.id);

  if (!userRole) {
    res.status(403).json({
      success: false,
      error: 'You are not a member of this team',
      code: 'NOT_TEAM_MEMBER',
    } as ErrorResponse);
    return;
  }

  if (userRole !== 'admin' && team.ownerId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'Only team owner or admin can perform this action',
      code: 'NOT_TEAM_OWNER',
    } as ErrorResponse);
    return;
  }

  req.teamRole = userRole;
  next();
};

export const requireRoleAssignmentPermission = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    } as ErrorResponse);
    return;
  }

  if (!req.teamId) {
    res.status(400).json({
      success: false,
      error: 'Team context required',
      code: 'TEAM_CONTEXT_REQUIRED',
    } as ErrorResponse);
    return;
  }

  const targetRole = req.body.role as string;

  if (targetRole && !['admin', 'manager', 'agent', 'viewer'].includes(targetRole)) {
    res.status(400).json({
      success: false,
      error: 'Invalid role. Must be one of: admin, manager, agent, viewer',
      code: 'INVALID_ROLE',
    } as ErrorResponse);
    return;
  }

  const teamRepo = getTeamRepository();
  const userRole = await teamRepo.getUserTeamRole(req.teamId, req.user.id);

  if (!userRole) {
    res.status(403).json({
      success: false,
      error: 'You are not a member of this team',
      code: 'NOT_TEAM_MEMBER',
    } as ErrorResponse);
    return;
  }

  if (targetRole && !canManageRole(userRole as Role, targetRole as Role)) {
    res.status(403).json({
      success: false,
      error: `Cannot assign role higher or equal to your own`,
      code: 'CANNOT_ASSIGN_ROLE',
    } as ErrorResponse);
    return;
  }

  req.teamRole = userRole;
  next();
};
