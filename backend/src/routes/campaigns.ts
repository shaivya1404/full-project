import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { CampaignService } from '../services/campaignService';
import { ContactService } from '../services/contactService';
import { TwilioOutboundService } from '../services/twilioOutbound';
import { getPrismaClient } from '../db/client';
import { logger } from '../utils/logger';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Transform DB campaign → frontend-expected shape
function transformCampaign(c: any) {
  const contacts: any[] = c.contacts || [];
  const callLogs: any[] = c.callLogs || [];
  const callsMade = callLogs.length;
  const successfulCalls = callLogs.filter((l: any) => l.result === 'completed').length;
  const successRate = callsMade > 0 ? Math.round((successfulCalls / callsMade) * 100) : 0;

  return {
    id: c.id,
    teamId: c.teamId || '',
    name: c.name,
    description: c.description,
    type: c.type || 'outbound',           // DB has no type field — default outbound
    status: c.status,
    prompt: c.script,                     // frontend calls it "prompt"
    script: c.script,
    callLimit: c.dailyLimit,              // frontend calls it "callLimit"
    dailyLimit: c.dailyLimit,
    retryCount: c.retryAttempts,          // frontend calls it "retryCount"
    retryAttempts: c.retryAttempts,
    retryDelay: c.retryDelay || 60,
    operatingHours: c.operatingHours || { startTime: '09:00', endTime: '17:00', timezone: 'UTC' },
    knowledgeBaseId: c.knowledgeBaseId || null,
    contactsCount: contacts.length,
    callsMade,
    successRate,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      // accept both "script" (backend) and "prompt" (frontend)
      script, prompt,
      startDate, endDate,
      // accept both "dailyLimit" (backend) and "callLimit" (frontend)
      dailyLimit, callLimit,
      // accept both "retryAttempts" (backend) and "retryCount" (frontend)
      retryAttempts, retryCount,
      status, teamId,
    } = req.body;

    const resolvedScript = script || prompt;

    if (!name || !resolvedScript) {
      return res.status(400).json({
        message: 'Name and script/prompt are required',
        error: 'NAME_AND_SCRIPT_REQUIRED'
      });
    }

    const campaignService = new CampaignService();

    const campaign = await campaignService.createCampaign(
      name,
      description,
      resolvedScript,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      dailyLimit || callLimit,
      retryAttempts || retryCount,
      status,
      teamId || null,
    );

    logger.info(`Created new campaign: ${campaign.id}`);

    res.status(201).json({
      data: campaign
    });
  } catch (error) {
    logger.error('Error creating campaign', error);
    
    res.status(500).json({ 
      message: 'Error creating campaign',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const campaignService = new CampaignService();
    const campaigns = await campaignService.getAllCampaigns();

    const transformed = campaigns.map(transformCampaign);
    res.status(200).json({
      data: transformed,
      total: transformed.length,
      limit: transformed.length,
      offset: 0,
    });
  } catch (error) {
    logger.error('Error getting campaigns', error);

    res.status(500).json({
      message: 'Error getting campaigns',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaignService = new CampaignService();
    const campaign = await campaignService.getCampaignById(id);

    if (!campaign) {
      return res.status(404).json({ 
        message: 'Campaign not found',
        error: 'CAMPAIGN_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: transformCampaign(campaign)
    });
  } catch (error) {
    logger.error(`Error getting campaign ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error getting campaign',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name, description,
      script, prompt,
      startDate, endDate,
      dailyLimit, callLimit,
      retryAttempts, retryCount,
      status,
    } = req.body;

    const campaignService = new CampaignService();

    const existing = await campaignService.getCampaignById(id);
    if (!existing) {
      return res.status(404).json({
        message: 'Campaign not found',
        error: 'CAMPAIGN_NOT_FOUND'
      });
    }

    const campaign = await campaignService.updateCampaign(id, {
      name,
      description,
      script: script || prompt,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      dailyLimit: dailyLimit || callLimit,
      retryAttempts: retryAttempts || retryCount,
      status,
    });

    logger.info(`Updated campaign: ${campaign.id}`);

    res.status(200).json({
      message: 'Campaign updated successfully',
      data: campaign
    });
  } catch (error) {
    logger.error(`Error updating campaign ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error updating campaign',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaignService = new CampaignService();
    
    const existing = await campaignService.getCampaignById(id);
    if (!existing) {
      return res.status(404).json({ 
        message: 'Campaign not found',
        error: 'CAMPAIGN_NOT_FOUND'
      });
    }

    await campaignService.deleteCampaign(id);

    logger.info(`Deleted campaign: ${id}`);

    res.status(200).json({
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting campaign ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error deleting campaign',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaignService = new CampaignService();
    const campaign = await campaignService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found', error: 'CAMPAIGN_NOT_FOUND' });
    }
    await campaignService.updateCampaign(id, { status: 'paused' });
    logger.info(`Paused campaign ${id}`);
    res.status(200).json({ success: true, data: { campaignId: id, status: 'paused' } });
  } catch (error) {
    logger.error(`Error pausing campaign ${req.params.id}`, error);
    res.status(500).json({ message: 'Error pausing campaign', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaignService = new CampaignService();
    const campaign = await campaignService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found', error: 'CAMPAIGN_NOT_FOUND' });
    }
    await campaignService.updateCampaign(id, { status: 'active' });
    logger.info(`Resumed campaign ${id}`);
    res.status(200).json({ success: true, data: { campaignId: id, status: 'active' } });
  } catch (error) {
    logger.error(`Error resuming campaign ${req.params.id}`, error);
    res.status(500).json({ message: 'Error resuming campaign', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit } = req.body;

    const campaignService = new CampaignService();
    const twilioOutboundService = new TwilioOutboundService();

    // Start the campaign
    await campaignService.startCampaign(id);

    // Process calls
    const callsMade = await twilioOutboundService.processCampaignCalls(id, limit || 10);

    logger.info(`Started campaign ${id} and made ${callsMade} calls`);

    res.status(200).json({
      data: {
        campaignId: id,
        status: 'active',
        callsMade,
      }
    });
  } catch (error) {
    logger.error(`Error starting campaign ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error starting campaign',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaignService = new CampaignService();

    await campaignService.stopCampaign(id);

    logger.info(`Stopped campaign ${id}`);

    res.status(200).json({
      data: {
        campaignId: id,
        status: 'stopped',
      }
    });
  } catch (error) {
    logger.error(`Error stopping campaign ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error stopping campaign',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaignService = new CampaignService();
    const progress = await campaignService.getCampaignProgress(id);

    res.status(200).json({
      data: progress
    });
  } catch (error) {
    logger.error(`Error getting campaign progress for ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error getting campaign progress',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.get('/:id/contacts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { search, status, limit, offset } = req.query;

    const campaignService = new CampaignService();
    let contacts = await campaignService.getContactsForCampaign(id);

    // Apply search filter
    if (search) {
      const q = (search as string).toLowerCase();
      contacts = contacts.filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }

    // Compute status from contact fields (Contact model has no status column)
    const enriched = contacts.map((c: any) => {
      let computedStatus = 'pending';
      if (c.isDoNotCall) computedStatus = 'failed';
      else if (c.successfulCalls > 0) computedStatus = 'completed';
      else if (c.totalCalls > 0) computedStatus = 'called';

      return {
        id: c.id,
        campaignId: c.campaignId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        status: computedStatus,
        lastCalled: c.lastContactedAt || null,
        callCount: c.totalCalls || 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    // Apply status filter after computing
    const filtered = status
      ? enriched.filter((c: any) => c.status === status)
      : enriched;

    const total = filtered.length;
    const lim = limit ? parseInt(limit as string) : filtered.length;
    const off = offset ? parseInt(offset as string) : 0;
    const page = filtered.slice(off, off + lim);

    res.status(200).json({ data: page, total });
  } catch (error) {
    logger.error(`Error getting contacts for campaign ${req.params.id}`, error);
    res.status(500).json({ message: 'Error getting contacts', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

router.get('/:id/calls', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaignService = new CampaignService();
    const callLogs = await campaignService.getCallLogsForCampaign(id);

    res.status(200).json({
      data: callLogs
    });
  } catch (error) {
    logger.error(`Error getting call logs for campaign ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error getting call logs',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.get('/:id/analytics/trends', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaignService = new CampaignService();
    const callLogs = await campaignService.getCallLogsForCampaign(id);

    const byDay: Record<string, number> = {};
    callLogs.forEach((log) => {
      const date = new Date(log.createdAt).toISOString().split('T')[0];
      byDay[date] = (byDay[date] || 0) + 1;
    });

    const trends = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    res.status(200).json({ success: true, data: trends });
  } catch (error) {
    logger.error(`Error getting call trends for ${req.params.id}`, error);
    res.status(500).json({ message: 'Error getting call trends', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

router.get('/:id/analytics/contacts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaignService = new CampaignService();
    const contacts = await campaignService.getContactsForCampaign(id);

    const statusCounts: Record<string, number> = {};
    contacts.forEach((c: any) => {
      let s = 'pending';
      if (c.isDoNotCall) s = 'failed';
      else if (c.successfulCalls > 0) s = 'completed';
      else if (c.totalCalls > 0) s = 'called';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const result = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error getting contact status for ${req.params.id}`, error);
    res.status(500).json({ message: 'Error getting contact status', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

router.get('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaignService = new CampaignService();
    const campaign = await campaignService.getCampaignById(id);

    if (!campaign) {
      return res.status(404).json({
        message: 'Campaign not found',
        error: 'CAMPAIGN_NOT_FOUND'
      });
    }

    const raw = await campaignService.getCampaignAnalytics(id);
    const contacts = await campaignService.getContactsForCampaign(id);

    // Build statusBreakdown from actual contacts
    const statusBreakdown = { pending: 0, called: 0, completed: 0, failed: 0, transferred: 0 };
    contacts.forEach((c: any) => {
      let s = 'pending';
      if (c.isDoNotCall) s = 'failed';
      else if (c.successfulCalls > 0) s = 'completed';
      else if (c.totalCalls > 0) s = 'called';
      if (s in statusBreakdown) statusBreakdown[s as keyof typeof statusBreakdown]++;
    });

    res.status(200).json({
      success: true,
      data: {
        totalContacts: raw.totalContacts,
        callsMade: raw.totalCalls,
        callsCompleted: raw.completedCalls,
        successRate: raw.successRate,
        averageDuration: raw.averageDuration,
        statusBreakdown,
      }
    });
  } catch (error) {
    logger.error(`Error getting campaign analytics for ${req.params.id}`, error);

    res.status(500).json({
      message: 'Error getting campaign analytics',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

// CSV import for a campaign
router.post('/:id/contacts/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded', error: 'FILE_REQUIRED' });

    const campaignService = new CampaignService();
    const campaign = await campaignService.getCampaignById(id);
    if (!campaign) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Campaign not found', error: 'CAMPAIGN_NOT_FOUND' });
    }

    const contactService = new ContactService();
    const contacts = await contactService.uploadContactsFromCSV(id, file.path);
    try { fs.unlinkSync(file.path); } catch (_) {}

    res.status(200).json({
      success: true,
      data: { imported: contacts.length, failed: 0 }
    });
  } catch (error) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (_) {}
    logger.error(`Error importing contacts for campaign ${req.params.id}`, error);
    res.status(500).json({ message: 'Error importing contacts', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

// Bulk update contacts
router.put('/:id/contacts/bulk', async (req: Request, res: Response) => {
  try {
    const { contactIds, data } = req.body;
    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({ message: 'contactIds array required', error: 'INVALID_REQUEST' });
    }
    const prisma = getPrismaClient();
    await prisma.contact.updateMany({ where: { id: { in: contactIds } }, data });
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error bulk updating contacts`, error);
    res.status(500).json({ message: 'Error bulk updating contacts', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

// Bulk delete contacts
router.post('/:id/contacts/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { contactIds } = req.body;
    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({ message: 'contactIds array required', error: 'INVALID_REQUEST' });
    }
    const prisma = getPrismaClient();
    await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Error bulk deleting contacts`, error);
    res.status(500).json({ message: 'Error bulk deleting contacts', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

// Campaign status summary
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaignService = new CampaignService();
    const campaign = await campaignService.getCampaignById(id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    const progress = await campaignService.getCampaignProgress(id);
    res.status(200).json({
      success: true,
      data: { status: campaign.status, callsMade: progress.completedCalls, successRate: progress.successRate }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error getting campaign status', error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' });
  }
});

// Analytics export stub
router.get('/:id/analytics/export', async (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { url: null, message: 'Export feature coming soon' } });
});

// Analytics agents stub
router.get('/:id/analytics/agents', async (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

router.post('/:id/contacts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { contacts, format } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ 
        message: 'Contacts array is required',
        error: 'CONTACTS_REQUIRED'
      });
    }

    const campaignService = new CampaignService();
    
    const campaign = await campaignService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ 
        message: 'Campaign not found',
        error: 'CAMPAIGN_NOT_FOUND'
      });
    }

    const result = await campaignService.addContactsToCampaign(id, contacts);

    logger.info(`Added ${result.added} contacts to campaign ${id}`);

    res.status(200).json({
      message: `Successfully added ${result.added} contacts`,
      data: result
    });
  } catch (error) {
    logger.error(`Error adding contacts to campaign ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error adding contacts',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

export default router;