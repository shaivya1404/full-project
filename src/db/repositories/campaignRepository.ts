import { PrismaClient, Campaign, Contact, CallLog } from '@prisma/client';
import { getPrismaClient } from '../client';

export interface CreateCampaignInput {
  name: string;
  description?: string;
  script: string;
  startDate?: Date;
  endDate?: Date;
  dailyLimit?: number;
  retryAttempts?: number;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  script?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  dailyLimit?: number;
  retryAttempts?: number;
}

export interface CreateContactInput {
  campaignId?: string;
  phone: string;
  name?: string;
  email?: string;
  isValid?: boolean;
  isDoNotCall?: boolean;
  validationError?: string;
}

export interface CreateCallLogInput {
  campaignId: string;
  contactId: string;
  duration?: number;
  result?: string;
  recordingUrl?: string;
  transcript?: string;
}

export class CampaignRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async createCampaign(data: CreateCampaignInput): Promise<Campaign> {
    return this.prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        script: data.script,
        startDate: data.startDate,
        endDate: data.endDate,
        dailyLimit: data.dailyLimit || 100,
        retryAttempts: data.retryAttempts || 3,
      },
    });
  }

  async updateCampaign(id: string, data: UpdateCampaignInput): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data,
    });
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    return this.prisma.campaign.findUnique({
      where: { id },
      include: {
        contacts: true,
        callLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getAllCampaigns(limit?: number, offset?: number): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        contacts: true,
        callLogs: true,
      },
    });
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.prisma.campaign.delete({
      where: { id },
    });
  }

  async createContact(data: CreateContactInput): Promise<Contact> {
    return this.prisma.contact.create({
      data: {
        campaignId: data.campaignId,
        phone: data.phone,
        name: data.name,
        email: data.email,
        isValid: data.isValid || false,
        isDoNotCall: data.isDoNotCall || false,
        validationError: data.validationError,
      },
    });
  }

  async createContacts(data: CreateContactInput[]): Promise<Contact[]> {
    return this.prisma.$transaction(
      data.map((contact) => 
        this.prisma.contact.create({
          data: {
            campaignId: contact.campaignId,
            phone: contact.phone,
            name: contact.name,
            email: contact.email,
            isValid: contact.isValid || false,
            isDoNotCall: contact.isDoNotCall || false,
            validationError: contact.validationError,
          },
        })
      )
    );
  }

  async getContactById(id: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({
      where: { id },
      include: {
        campaign: true,
        callLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getContactsByCampaignId(campaignId: string): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateContact(id: string, data: Partial<CreateContactInput>): Promise<Contact> {
    return this.prisma.contact.update({
      where: { id },
      data,
    });
  }

  async deleteContact(id: string): Promise<void> {
    await this.prisma.contact.delete({
      where: { id },
    });
  }

  async createCallLog(data: CreateCallLogInput): Promise<CallLog> {
    return this.prisma.callLog.create({
      data: {
        campaignId: data.campaignId,
        contactId: data.contactId,
        duration: data.duration,
        result: data.result || 'pending',
        recordingUrl: data.recordingUrl,
        transcript: data.transcript,
      },
    });
  }

  async getCallLogById(id: string): Promise<CallLog | null> {
    return this.prisma.callLog.findUnique({
      where: { id },
      include: {
        campaign: true,
        contact: true,
      },
    });
  }

  async getCallLogsByCampaignId(campaignId: string): Promise<CallLog[]> {
    return this.prisma.callLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      include: {
        contact: true,
      },
    });
  }

  async getCallLogsByContactId(contactId: string): Promise<CallLog[]> {
    return this.prisma.callLog.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: true,
      },
    });
  }

  async updateCallLog(id: string, data: Partial<CreateCallLogInput>): Promise<CallLog> {
    return this.prisma.callLog.update({
      where: { id },
      data,
    });
  }

  async getCampaignProgress(campaignId: string): Promise<{
    totalContacts: number;
    completedCalls: number;
    successfulCalls: number;
    failedCalls: number;
    inProgressCalls: number;
    successRate: number;
  }> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        contacts: true,
        callLogs: true,
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const totalContacts = campaign.contacts.length;
    const completedCalls = campaign.callLogs.filter(
      (log) => log.result !== 'pending'
    ).length;
    const successfulCalls = campaign.callLogs.filter(
      (log) => log.result === 'completed'
    ).length;
    const failedCalls = campaign.callLogs.filter(
      (log) => log.result === 'failed' || log.result === 'no_answer'
    ).length;
    const inProgressCalls = campaign.callLogs.filter(
      (log) => log.result === 'pending'
    ).length;

    const successRate = totalContacts > 0 
      ? (successfulCalls / totalContacts) * 100
      : 0;

    return {
      totalContacts,
      completedCalls,
      successfulCalls,
      failedCalls,
      inProgressCalls,
      successRate,
    };
  }

  async getActiveCampaigns(): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      where: {
        status: 'active',
      },
      include: {
        contacts: true,
        callLogs: true,
      },
    });
  }
}