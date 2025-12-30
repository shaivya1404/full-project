import twilio from 'twilio';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { CampaignService } from './campaignService';
import { CallManager } from './callManager';
import { OpenAIRealtimeService } from './openaiRealtime';
import { TwilioStreamService } from './twilioStream';

export class TwilioOutboundService {
  private twilioClient: twilio.Twilio;
  private campaignService: CampaignService;
  private callManager: CallManager;

  constructor() {
    this.twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    this.campaignService = new CampaignService();
    this.callManager = new CallManager();
    // Remove OpenAI service for now as it's not needed for basic outbound calls
    // this.openAIService = new OpenAIRealtimeService(this);
  }

  async makeOutboundCall(
    campaignId: string,
    contactId: string,
    phoneNumber: string,
    script: string
  ): Promise<string> {
    try {
      logger.info(`Making outbound call to ${phoneNumber} for campaign ${campaignId}`);

      // Create call log with pending status
      const callLog = await this.campaignService.createCallLog(
        campaignId,
        contactId,
        'pending'
      );

      // Make Twilio call
      const call = await this.twilioClient.calls.create({
        url: `${process.env.BASE_URL || 'http://localhost:3000'}/twilio/outbound-call-handler`,
        to: phoneNumber,
        from: config.TWILIO_PHONE_NUMBER,
        method: 'POST',
        record: true,
        recordingStatusCallback: `${process.env.BASE_URL || 'http://localhost:3000'}/twilio/recording-complete`,
        statusCallback: `${process.env.BASE_URL || 'http://localhost:3000'}/twilio/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });

      logger.info(`Outbound call initiated to ${phoneNumber}, call SID: ${call.sid}`);

      // Update call log with call SID
      await this.campaignService.updateCallLog(callLog.id, {
        result: 'initiated',
      });

      return call.sid;
    } catch (error) {
      logger.error(`Failed to make outbound call to ${phoneNumber}`, error);

      // Update call log with failure
      // Note: In a real implementation, we would have the callLog object here
      // For now, we'll skip this since we don't have the callLog reference

      throw error;
    }
  }

  async handleOutboundCallWebhook(callSid: string, campaignId: string, contactId: string): Promise<string> {
    try {
      logger.info(`Handling outbound call webhook for call SID: ${callSid}`);

      // Get campaign and script
      const campaign = await this.campaignService.getCampaignById(campaignId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Generate TwiML response with AI script
      const twiml = this.generateTwiMLResponse(campaign.script);

      return twiml;
    } catch (error) {
      logger.error(`Error handling outbound call webhook for call SID: ${callSid}`, error);
      
      // Fallback TwiML
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was an error processing your call. Please try again later.</Say>
  <Hangup />
</Response>`;
    }
  }

  private generateTwiMLResponse(script: string): string {
    // For now, use basic Twilio text-to-speech
    // In future phases, we'll integrate with OpenAI for more advanced voice generation
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${this.escapeXml(script)}</Say>
  <Record action="/twilio/recording-complete" maxLength="3600" />
  <Hangup />
</Response>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/\'/g, '&#39;');
  }

  async handleRecordingComplete(
    callSid: string,
    recordingUrl: string,
    duration: string
  ): Promise<void> {
    try {
      logger.info(`Recording complete for call SID: ${callSid}`, { recordingUrl, duration });

      // Find the call log for this call SID
      // Note: In a real implementation, we'd need to track call SID to call log mapping
      // For now, we'll get all call logs and find pending ones
      const allCallLogs = await this.campaignService.getCallLogsForCampaign('all');
      
      // This is a simplified approach - in production we'd have a better mapping
      for (const callLog of allCallLogs) {
        // In a real implementation, we'd store the call SID in the call log
        // For now, we'll just update the most recent pending call log
        if (callLog.result === 'pending') {
          await this.campaignService.updateCallLog(callLog.id, {
            result: 'completed',
            duration: parseInt(duration),
            recordingUrl,
          });
          break;
        }
      }

    } catch (error) {
      logger.error(`Error handling recording complete for call SID: ${callSid}`, error);
    }
  }

  async handleCallStatusUpdate(
    callSid: string,
    callStatus: string,
    from: string,
    to: string
  ): Promise<void> {
    try {
      logger.info(`Call status update for call SID: ${callSid}`, { callStatus, from, to });

      // Find and update the corresponding call log
      const allCallLogs = await this.campaignService.getCallLogsForCampaign('all');
      
      for (const callLog of allCallLogs) {
        // Simplified approach - in production we'd have proper call SID tracking
        if (callLog.result === 'pending' || callLog.result === 'initiated' || callLog.result === 'ringing') {
          let result: string;
          
          switch (callStatus) {
            case 'ringing':
              result = 'ringing';
              break;
            case 'answered':
              result = 'in_progress';
              break;
            case 'completed':
              result = 'completed';
              break;
            case 'failed':
            case 'busy':
            case 'no-answer':
              result = 'failed';
              break;
            default:
              result = callStatus;
          }

          await this.campaignService.updateCallLog(callLog.id, {
            result,
          });
          break;
        }
      }

    } catch (error) {
      logger.error(`Error handling call status update for call SID: ${callSid}`, error);
    }
  }

  async processCampaignCalls(campaignId: string, limit: number = 10): Promise<number> {
    try {
      logger.info(`Processing campaign calls for campaign ${campaignId}, limit: ${limit}`);

      const campaign = await this.campaignService.getCampaignById(campaignId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'active') {
        logger.info(`Campaign ${campaignId} is not active, skipping`);
        return 0;
      }

      // Get contacts that haven't been called yet
      const contacts = await this.campaignService.getContactsForCampaign(campaignId);
      
      const contactsToCall = contacts.filter(contact => {
        // Skip invalid contacts and do-not-call numbers
        if (!contact.isValid || contact.isDoNotCall) {
          return false;
        }

        // Check if this contact has already been called successfully
        // This is a simplified check - in production we'd have better logic
        return true;
      }).slice(0, limit);

      logger.info(`Found ${contactsToCall.length} contacts to call for campaign ${campaignId}`);

      // Make calls in parallel with a limit
      const callPromises = contactsToCall.map(contact => 
        this.makeOutboundCall(campaignId, contact.id, contact.phone, campaign.script)
      );

      const results = await Promise.allSettled(callPromises);

      const successfulCalls = results.filter(
        result => result.status === 'fulfilled'
      ).length;

      logger.info(`Completed ${successfulCalls} of ${contactsToCall.length} calls for campaign ${campaignId}`);

      return successfulCalls;
    } catch (error) {
      logger.error(`Error processing campaign calls for campaign ${campaignId}`, error);
      throw error;
    }
  }
}