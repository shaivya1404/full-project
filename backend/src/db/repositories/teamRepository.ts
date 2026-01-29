import { PrismaClient, Team, TeamMember, AuditLog, User, ApiKey } from '@prisma/client';
import { getPrismaClient } from '../client';
import { logger } from '../../utils/logger';

export interface TeamMemberWithUser extends TeamMember {
  user: User;
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  ownerId: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
}

export interface AddTeamMemberInput {
  userId: string;
  role?: string;
}

export interface UpdateTeamMemberRoleInput {
  role: string;
}

const VALID_ROLES = ['admin', 'manager', 'agent', 'viewer'];

export class TeamRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async createTeam(data: CreateTeamInput): Promise<Team & { members: TeamMember[] }> {
    return this.prisma.team.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim(),
        ownerId: data.ownerId,
        members: {
          create: {
            userId: data.ownerId,
            role: 'admin',
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  async getTeamById(id: string): Promise<any> {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
              },
            },
          },
        },
        campaigns: {
          select: { id: true },
        },
        calls: {
          select: { id: true },
        },
        apiKeys: {
          select: { id: true },
        },
        auditLogs: {
          select: { id: true },
        },
      },
    }) as any;
  }

  async getTeamByIdSimple(id: string): Promise<any> {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
              },
            },
          },
        },
      },
    }) as any;
  }

  async updateTeam(id: string, data: UpdateTeamInput): Promise<Team> {
    return this.prisma.team.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
      },
    });
  }

  async deleteTeam(id: string): Promise<void> {
    await this.prisma.team.delete({
      where: { id },
    });
  }

  async getAllTeams(): Promise<Team[]> {
    return this.prisma.team.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTeamsByUserId(userId: string): Promise<(Team & { members: TeamMember[] })[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });

    const teamIds = memberships.map((m) => m.teamId);

    return this.prisma.team.findMany({
      where: {
        id: { in: teamIds },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addTeamMember(teamId: string, data: AddTeamMemberInput): Promise<TeamMemberWithUser> {
    const role = VALID_ROLES.includes(data.role || '') ? data.role : 'viewer';

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: data.userId,
        role,
      },
      include: {
        user: true,
      },
    }) as Promise<TeamMemberWithUser>;
  }

  async removeTeamMember(teamId: string, memberId: string): Promise<void> {
    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.teamId !== teamId) {
      throw new Error('Team member does not belong to this team');
    }

    if (member.role === 'admin' && member.userId === member.teamId) {
      const adminCount = await this.prisma.teamMember.count({
        where: {
          teamId,
          role: 'admin',
        },
      });

      if (adminCount <= 1) {
        throw new Error('Cannot remove the last admin from the team');
      }
    }

    await this.prisma.teamMember.delete({
      where: { id: memberId },
    });
  }

  async updateTeamMemberRole(teamId: string, memberId: string, role: string): Promise<TeamMember> {
    const validRole = VALID_ROLES.includes(role) ? role : 'viewer';

    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.teamId !== teamId) {
      throw new Error('Team member does not belong to this team');
    }

    if (member.role === 'admin') {
      const adminCount = await this.prisma.teamMember.count({
        where: {
          teamId,
          role: 'admin',
        },
      });

      if (adminCount <= 1 && validRole !== 'admin') {
        throw new Error('Cannot demote the last admin');
      }
    }

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: { role: validRole },
      include: {
        user: true,
      },
    }) as Promise<TeamMemberWithUser>;
  }

  async getTeamMember(teamId: string, userId: string): Promise<TeamMember | null> {
    return this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });
  }

  async getTeamMembers(teamId: string): Promise<any[]> {
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  async isTeamMember(teamId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });
    return !!member;
  }

  async getUserTeamRole(teamId: string, userId: string): Promise<string | null> {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });
    return member?.role || null;
  }

  async hasPermission(teamId: string, userId: string, requiredRoles: string[]): Promise<boolean> {
    const userRole = await this.getUserTeamRole(teamId, userId);
    if (!userRole) return false;
    return requiredRoles.includes(userRole);
  }

  async createAuditLog(
    teamId: string | null,
    userId: string | null,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        teamId,
        userId,
        action,
        resourceType,
        resourceId,
        details,
        ipAddress,
        userAgent,
      },
    });
  }

  async getTeamAuditLogs(
    teamId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where: { teamId } }),
    ]);

    return { logs, total };
  }

  async getUserAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);

    return { logs, total };
  }

  async getAllAuditLogs(
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count(),
    ]);

    return { logs, total };
  }
}

export const getTeamRepository = (): TeamRepository => {
  return new TeamRepository();
};
