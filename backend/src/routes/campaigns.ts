import { Router, Request, Response } from 'express';
import { CampaignService } from '../services/campaignService';
import { TwilioOutboundService } from '../services/twilioOutbound';
import { logger } from '../utils/logger';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, script, startDate, endDate, dailyLimit, retryAttempts } = req.body;

    if (!name || !script) {
      return res.status(400).json({ 
        message: 'Name and script are required',
        error: 'NAME_AND_SCRIPT_REQUIRED'
      });
    }

    const campaignService = new CampaignService();

    const campaign = await campaignService.createCampaign(
      name,
      description,
      script,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      dailyLimit,
      retryAttempts
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

    res.status(200).json({
      data: campaigns
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
      data: campaign
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
    const { name, description, script, startDate, endDate, dailyLimit, retryAttempts, status } = req.body;

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
      script,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      dailyLimit,
      retryAttempts,
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

    const campaignService = new CampaignService();
    const contacts = await campaignService.getContactsForCampaign(id);

    res.status(200).json({
      data: contacts
    });
  } catch (error) {
    logger.error(`Error getting contacts for campaign ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error getting contacts',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
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

    const analytics = await campaignService.getCampaignAnalytics(id);

    res.status(200).json({
      data: analytics
    });
  } catch (error) {
    logger.error(`Error getting campaign analytics for ${req.params.id}`, error);
    
    res.status(500).json({ 
      message: 'Error getting campaign analytics',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
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