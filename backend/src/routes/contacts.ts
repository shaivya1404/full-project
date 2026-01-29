import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ContactService } from '../services/contactService';
import { CampaignService } from '../services/campaignService';
import { logger } from '../utils/logger';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ 
        message: 'No file uploaded',
        error: 'FILE_REQUIRED'
      });
    }

    if (!campaignId) {
      return res.status(400).json({ 
        message: 'Campaign ID is required',
        error: 'CAMPAIGN_ID_REQUIRED'
      });
    }

    const contactService = new ContactService();
    const campaignService = new CampaignService();

    // Check if campaign exists
    const campaign = await campaignService.getCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ 
        message: 'Campaign not found',
        error: 'CAMPAIGN_NOT_FOUND'
      });
    }

    // Parse and upload contacts
    const contacts = await contactService.uploadContactsFromCSV(campaignId, file.path);

    logger.info(`Uploaded ${contacts.length} contacts for campaign ${campaignId}`);

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    res.status(201).json({
      data: {
        campaignId,
        contactCount: contacts.length,
        validContacts: contacts.filter(c => c.isValid).length,
        invalidContacts: contacts.filter(c => !c.isValid).length,
      }
    });
  } catch (error) {
    logger.error('Error uploading contacts', error);
    
    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up uploaded file', cleanupError);
      }
    }

    res.status(500).json({ 
      message: 'Error uploading contacts',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { phones } = req.body;

    if (!phones || !Array.isArray(phones)) {
      return res.status(400).json({ 
        message: 'Phones array is required',
        error: 'PHONES_REQUIRED'
      });
    }

    const contactService = new ContactService();
    const validatedContacts = await contactService.validatePhoneNumbers(phones);

    res.status(200).json({
      data: {
        contacts: validatedContacts,
        validCount: validatedContacts.filter(c => c.isValid).length,
        invalidCount: validatedContacts.filter(c => !c.isValid).length,
      }
    });
  } catch (error) {
    logger.error('Error validating phone numbers', error);
    
    res.status(500).json({ 
      message: 'Error validating phone numbers',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    });
  }
});

export default router;