import { AgentRepository } from '../db/repositories/agentRepository';
import { QueueRepository } from '../db/repositories/queueRepository';
import { CallRepository } from '../db/repositories/callRepository';
import { TwilioOutboundService } from './twilioOutbound';
import { logger } from '../utils/logger';
import { getPrismaClient } from '../db/client';

export class QueueService {
  private agentRepo: AgentRepository;
  private queueRepo: QueueRepository;
  private callRepo: CallRepository;
  private twilioOutboundService: TwilioOutboundService;
  private prisma = getPrismaClient();

  constructor() {
    this.agentRepo = new AgentRepository();
    this.queueRepo = new QueueRepository();
    this.callRepo = new CallRepository();
    this.twilioOutboundService = new TwilioOutboundService();
  }

  async requestTransfer(callId: string, options: {
    reason?: string;
    priority?: number;
    requiredSkills?: string[];
    teamId?: string;
    context?: any;
  }) {
    logger.info(`Transfer requested for call ${callId}. Reason: ${options.reason}`);

    // Log the transfer request
    await this.queueRepo.createTransferLog({
      callId,
      fromBot: true,
      context: options.context
    });

    // Try to find an available agent immediately
    const availableAgents = await this.agentRepo.findAvailableAgents(options.teamId, options.requiredSkills);

    if (availableAgents.length > 0) {
      // Sort agents by current workload
      const selectedAgent = availableAgents.sort((a, b) => 
        (a as any).sessions.length - (b as any).sessions.length
      )[0];

      logger.info(`Immediate transfer possible. Assigning call ${callId} to agent ${selectedAgent.id}`);

      // Create agent session
      await this.agentRepo.createAgentSession({
        agentId: selectedAgent.id,
        callId,
        notes: options.reason
      });

      // Actually trigger the transfer in Twilio
      const call = await this.callRepo.getCallById(callId);
      if (call && call.callSid && selectedAgent.phone) {
        try {
          await this.twilioOutboundService.transferCallToAgent(call.callSid, selectedAgent.phone);
        } catch (error) {
          logger.error(`Failed to trigger Twilio transfer for call ${callId}`, error);
        }
      }

      return {
        status: 'assigned',
        agent: {
          id: selectedAgent.id,
          name: selectedAgent.name,
          email: selectedAgent.email,
          phone: selectedAgent.phone
        }
      };
    }

    // No agents available, add to queue
    logger.info(`No agents available for call ${callId}. Adding to queue.`);
    const queueEntry = await this.queueRepo.addToQueue({
      callId,
      teamId: options.teamId,
      reasonForTransfer: options.reason,
      priority: options.priority
    });

    return {
      status: 'queued',
      queueEntry
    };
  }

  async processQueue(teamId?: string) {
    const queue = await this.queueRepo.getActiveQueue(teamId);
    
    for (const entry of queue) {
      // Find agents without specific skill requirements for now
      const availableAgents = await this.agentRepo.findAvailableAgents(entry.teamId || undefined);
      
      if (availableAgents.length > 0) {
        const selectedAgent = availableAgents[0];
        
        logger.info(`Assigning queued call ${entry.callId} to agent ${selectedAgent.id}`);
        
        await this.queueRepo.updateQueueStatus(entry.id, 'assigned', selectedAgent.id);
        
        await this.agentRepo.createAgentSession({
          agentId: selectedAgent.id,
          callId: entry.callId,
          notes: entry.reasonForTransfer || undefined
        });

        // Trigger Twilio transfer logic here
        const call = await this.callRepo.getCallById(entry.callId);
        if (call && call.callSid && selectedAgent.phone) {
          try {
            await this.twilioOutboundService.transferCallToAgent(call.callSid, selectedAgent.phone);
          } catch (error) {
            logger.error(`Failed to trigger Twilio transfer for queued call ${entry.callId}`, error);
          }
        }
      }
    }
  }
}
