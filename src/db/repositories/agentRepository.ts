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
}
