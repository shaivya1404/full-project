import { PrismaClient, CallQueue, TransferLog } from '@prisma/client';
import { getPrismaClient } from '../client';

export interface CreateQueueEntryInput {
  callId: string;
  teamId?: string;
  reasonForTransfer?: string;
  priority?: number;
}

export class QueueRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async addToQueue(data: CreateQueueEntryInput): Promise<CallQueue> {
    return this.prisma.callQueue.create({
      data: {
        callId: data.callId,
        teamId: data.teamId,
        reasonForTransfer: data.reasonForTransfer,
        priority: data.priority || 0,
        status: 'waiting',
      },
    });
  }

  async updateQueueStatus(id: string, status: string, assignedAgentId?: string): Promise<CallQueue> {
    const data: any = { status };
    if (assignedAgentId) {
      data.assignedAgentId = assignedAgentId;
    }
    
    const queueEntry = await this.prisma.callQueue.findUnique({
      where: { id }
    });

    if (!queueEntry) {
      throw new Error(`Queue entry with id ${id} not found`);
    }

    if (status === 'completed' || status === 'abandoned') {
      const waitTime = Math.floor((new Date().getTime() - queueEntry.createdAt.getTime()) / 1000);
      data.waitTime = waitTime;
    }

    return this.prisma.callQueue.update({
      where: { id },
      data,
    });
  }

  async getQueueEntryByCallId(callId: string): Promise<CallQueue | null> {
    return this.prisma.callQueue.findUnique({
      where: { callId },
    });
  }

  async getActiveQueue(teamId?: string): Promise<CallQueue[]> {
    return this.prisma.callQueue.findMany({
      where: {
        teamId,
        status: 'waiting',
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        call: true,
      },
    });
  }

  async createTransferLog(data: {
    callId: string;
    fromBot: boolean;
    toAgentId?: string;
    context?: any;
  }): Promise<TransferLog> {
    return this.prisma.transferLog.create({
      data: {
        callId: data.callId,
        fromBot: data.fromBot,
        toAgentId: data.toAgentId,
        context: data.context ? JSON.stringify(data.context) : null,
      },
    });
  }

  async getTransferHistory(callId: string): Promise<TransferLog[]> {
    return this.prisma.transferLog.findMany({
      where: { callId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
