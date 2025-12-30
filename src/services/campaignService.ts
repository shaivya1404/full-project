import { Campaign, Contact, CallLog } from '@prisma/client';
import { CampaignRepository } from '../db/repositories/campaignRepository';
import { logger } from '../utils/logger';

export class CampaignService {
  private campaignRepository: CampaignRepository;

  constructor() {
    this.campaignRepository = new CampaignRepository();
  }

  async createCampaign(
    name: string,
    description: string,
    script: string,
    startDate?: Date,
    endDate?: Date,
    dailyLimit?: number,
    retryAttempts?: number
  ): Promise<Campaign> {
    return this.campaignRepository.createCampaign({
      name,
      description,
      script,
      startDate,
      endDate,
      dailyLimit,
      retryAttempts,
    });
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    return this.campaignRepository.getCampaignById(id);
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return this.campaignRepository.getAllCampaigns();
  }

  async updateCampaignStatus(id: string, status: string): Promise<Campaign> {
    return this.campaignRepository.updateCampaign(id, { status });
  }

  async getCampaignProgress(campaignId: string): Promise<{
    totalContacts: number;
    completedCalls: number;
    successfulCalls: number;
    failedCalls: number;
    inProgressCalls: number;
    successRate: number;
  }> {
    return this.campaignRepository.getCampaignProgress(campaignId);
  }

  async startCampaign(campaignId: string): Promise<void> {
    // Update campaign status to active
    await this.campaignRepository.updateCampaign(campaignId, {
      status: 'active',
      startDate: new Date(),
    });

    logger.info(`Campaign ${campaignId} started`);
  }

  async stopCampaign(campaignId: string): Promise<void> {
    // Update campaign status to stopped
    await this.campaignRepository.updateCampaign(campaignId, {
      status: 'stopped',
      endDate: new Date(),
    });

    logger.info(`Campaign ${campaignId} stopped`);
  }

  async getActiveCampaigns(): Promise<Campaign[]> {
    return this.campaignRepository.getActiveCampaigns();
  }

  async getContactsForCampaign(campaignId: string): Promise<Contact[]> {
    return this.campaignRepository.getContactsByCampaignId(campaignId);
  }

  async getCallLogsForCampaign(campaignId: string): Promise<CallLog[]> {
    if (campaignId === 'all') {
      // Get all call logs from all campaigns
      const allCampaigns = await this.getAllCampaigns();
      let allCallLogs: CallLog[] = [];
      for (const campaign of allCampaigns) {
        const callLogs = await this.campaignRepository.getCallLogsByCampaignId(campaign.id);
        allCallLogs = allCallLogs.concat(callLogs);
      }
      return allCallLogs;
    }
    return this.campaignRepository.getCallLogsByCampaignId(campaignId);
  }

  async createCallLog(
    campaignId: string,
    contactId: string,
    result: string,
    duration?: number,
    recordingUrl?: string,
    transcript?: string
  ): Promise<CallLog> {
    return this.campaignRepository.createCallLog({
      campaignId,
      contactId,
      result,
      duration,
      recordingUrl,
      transcript,
    });
  }

  async updateCallLog(
    callLogId: string,
    data: {
      result?: string;
      duration?: number;
      recordingUrl?: string;
      transcript?: string;
    }
  ): Promise<CallLog> {
    return this.campaignRepository.updateCallLog(callLogId, data);
  }
}