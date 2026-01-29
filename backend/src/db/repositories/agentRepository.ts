import { PrismaClient, Agent, AgentSession } from '@prisma/client';
import { getPrismaClient } from '../client';

export interface CreateAgentInput {
  name: string;
  email: string;
  phone?: string;
  teamId?: string;
  role?: string;
  availabilityStatus?: string;
  skills?: string[];
  maxConcurrentCalls?: number;
}

export interface UpdateAgentInput {
  name?: string;
  phone?: string;
  role?: string;
  availabilityStatus?: string;
  skills?: string[];
  maxConcurrentCalls?: number;
}

export class AgentRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async createAgent(data: CreateAgentInput): Promise<Agent> {
    return this.prisma.agent.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        teamId: data.teamId,
        role: data.role || 'agent',
        availabilityStatus: data.availabilityStatus || 'offline',
        skills: data.skills ? JSON.stringify(data.skills) : null,
        maxConcurrentCalls: data.maxConcurrentCalls || 1,
      },
    });
  }

  async updateAgent(id: string, data: UpdateAgentInput): Promise<Agent> {
    const updateData: any = { ...data };
    if (data.skills) {
      updateData.skills = JSON.stringify(data.skills);
    }
    return this.prisma.agent.update({
      where: { id },
      data: updateData,
    });
  }

  async getAgentById(id: string): Promise<Agent | null> {
    return this.prisma.agent.findUnique({
      where: { id },
      include: {
        sessions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getAgentByEmail(email: string): Promise<Agent | null> {
    return this.prisma.agent.findUnique({
      where: { email },
    });
  }

  async listAgents(teamId?: string): Promise<Agent[]> {
    return this.prisma.agent.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async setAgentStatus(id: string, status: string): Promise<Agent> {
    return this.prisma.agent.update({
      where: { id },
      data: { availabilityStatus: status },
    });
  }

  async createAgentSession(data: {
    agentId: string;
    callId: string;
    notes?: string;
  }): Promise<AgentSession> {
    return this.prisma.agentSession.create({
      data: {
        agentId: data.agentId,
        callId: data.callId,
        notes: data.notes,
      },
    });
  }

  async updateAgentSession(id: string, data: {
    endTime?: Date;
    notes?: string;
  }): Promise<AgentSession> {
    return this.prisma.agentSession.update({
      where: { id },
      data,
    });
  }

  async getAgentSessions(agentId: string): Promise<AgentSession[]> {
    return this.prisma.agentSession.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      include: {
        call: true,
      },
    });
  }

  async findAvailableAgents(teamId?: string, skills?: string[]): Promise<Agent[]> {
    const agents = await this.prisma.agent.findMany({
      where: {
        teamId,
        availabilityStatus: 'online',
      },
      include: {
        sessions: {
          where: { endTime: null },
        },
      },
    });

    return agents.filter(agent => {
      // Check skills if provided
      if (skills && skills.length > 0) {
        const agentSkills = agent.skills ? JSON.parse(agent.skills) : [];
        const hasSkill = skills.some(skill => agentSkills.includes(skill));
        if (!hasSkill) return false;
      }

      // Check max concurrent calls
      return agent.sessions.length < agent.maxConcurrentCalls;
    });
  }

  async deleteAgent(id: string): Promise<void> {
    await this.prisma.agent.delete({
      where: { id },
    });
  }

  async getAgentPerformance(agentId: string): Promise<{
    totalCalls: number;
    averageDuration: number;
    totalDuration: number;
    activeSessions: number;
    completedSessions: number;
  }> {
    const sessions = await this.prisma.agentSession.findMany({
      where: { agentId },
      include: {
        call: true,
      },
    });

    const activeSessions = sessions.filter(s => !s.endTime).length;
    const completedSessions = sessions.filter(s => !!s.endTime).length;
    
    const totalDuration = sessions.reduce((sum, session) => {
      if (session.call && session.call.duration) {
        return sum + session.call.duration;
      }
      return sum;
    }, 0);

    const averageDuration = completedSessions > 0 ? totalDuration / completedSessions : 0;

    return {
      totalCalls: sessions.length,
      averageDuration,
      totalDuration,
      activeSessions,
      completedSessions,
    };
  }

  async getAgentSchedule(agentId: string): Promise<{
    agentId: string;
    schedule: any;
    timezone?: string;
  }> {
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // For now, return a placeholder schedule
    // In a real implementation, this would come from a Schedule table
    return {
      agentId,
      schedule: {
        monday: { start: '09:00', end: '17:00', available: true },
        tuesday: { start: '09:00', end: '17:00', available: true },
        wednesday: { start: '09:00', end: '17:00', available: true },
        thursday: { start: '09:00', end: '17:00', available: true },
        friday: { start: '09:00', end: '17:00', available: true },
        saturday: { start: null, end: null, available: false },
        sunday: { start: null, end: null, available: false },
      },
      timezone: 'UTC',
    };
  }

  async updateAgentSchedule(agentId: string, schedule: any): Promise<{
    agentId: string;
    schedule: any;
    timezone?: string;
  }> {
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // In a real implementation, this would save to a Schedule table
    // For now, just return the schedule
    return {
      agentId,
      schedule: schedule.schedule || schedule,
      timezone: schedule.timezone || 'UTC',
    };
  }
}
