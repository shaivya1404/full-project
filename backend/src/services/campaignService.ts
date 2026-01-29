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

  async updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> {
    return this.campaignRepository.updateCampaign(id, data as any);
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.campaignRepository.deleteCampaign(id);
    logger.info(`Campaign ${id} deleted`);
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

  async getCampaignAnalytics(campaignId: string): Promise<{
    totalContacts: number;
    totalCalls: number;
    completedCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
    successRate: number;
    conversionRate: number;
    callsByDay: { date: string; calls: number }[];
  }> {
    const progress = await this.getCampaignProgress(campaignId);
    const callLogs = await this.getCallLogsForCampaign(campaignId);

    // Calculate average duration
    const totalDuration = callLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const averageDuration = callLogs.length > 0 ? totalDuration / callLogs.length : 0;

    // Calculate conversion rate (successful calls / total calls)
    const conversionRate = callLogs.length > 0 ? progress.successfulCalls / callLogs.length : 0;

    // Group calls by day
    const callsByDay: { [key: string]: number } = {};
    callLogs.forEach((log) => {
      const date = new Date(log.createdAt).toISOString().split('T')[0];
      callsByDay[date] = (callsByDay[date] || 0) + 1;
    });

    const callsByDayArray = Object.entries(callsByDay).map(([date, calls]) => ({
      date,
      calls,
    }));

    return {
      totalContacts: progress.totalContacts,
      totalCalls: callLogs.length,
      completedCalls: progress.completedCalls,
      successfulCalls: progress.successfulCalls,
      failedCalls: progress.failedCalls,
      averageDuration,
      successRate: progress.successRate,
      conversionRate,
      callsByDay: callsByDayArray,
    };
  }

  async addContactsToCampaign(
    campaignId: string,
    contacts: Array<{ name: string; phone: string; email?: string; metadata?: any }>
  ): Promise<{ added: number; failed: number; errors: string[] }> {
    let added = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      try {
        await this.campaignRepository.createContact({
          campaignId,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          metadata: contact.metadata ? JSON.stringify(contact.metadata) : undefined,
        });
        added++;
      } catch (error) {
        failed++;
        errors.push(`Failed to add contact ${contact.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logger.info(`Added ${added} contacts to campaign ${campaignId}, ${failed} failed`);

    return { added, failed, errors };
  }
}