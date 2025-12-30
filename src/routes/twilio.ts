import { Router, Request, Response } from 'express';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { TwilioOutboundService } from '../services/twilioOutbound';

const router = Router();

router.post('/incoming-call', (req: Request, res: Response) => {
  try {
    logger.info('Received incoming call webhook from Twilio', {
      from: req.body.From,
      to: req.body.To,
      callSid: req.body.CallSid,
    });

    const protocol = req.protocol;
    const host = req.get('host');
    const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
    const streamUrl = `${wsProtocol}://${host}/streams`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;

    res.type('text/xml');
    res.send(twiml);

    logger.info('Sent TwiML response for incoming call', { streamUrl });
  } catch (error) {
    logger.error('Error generating TwiML response', error);
    res.status(500).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
  <Hangup />
</Response>`);
  }
});

router.post('/call-status', async (req: Request, res: Response) => {
  try {
    logger.info('Received call status webhook from Twilio', {
      callSid: req.body.CallSid,
      callStatus: req.body.CallStatus,
      from: req.body.From,
      to: req.body.To,
    });

    const twilioOutboundService = new TwilioOutboundService();
    await twilioOutboundService.handleCallStatusUpdate(
      req.body.CallSid,
      req.body.CallStatus,
      req.body.From,
      req.body.To
    );

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling call status webhook', error);
    res.status(500).send('Error');
  }
});

router.post('/recording-complete', async (req: Request, res: Response) => {
  try {
    logger.info('Received recording complete webhook from Twilio', {
      callSid: req.body.CallSid,
      recordingUrl: req.body.RecordingUrl,
      recordingDuration: req.body.RecordingDuration,
    });

    const twilioOutboundService = new TwilioOutboundService();
    await twilioOutboundService.handleRecordingComplete(
      req.body.CallSid,
      req.body.RecordingUrl,
      req.body.RecordingDuration
    );

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling recording complete webhook', error);
    res.status(500).send('Error');
  }
});

router.post('/outbound-call-handler', async (req: Request, res: Response) => {
  try {
    logger.info('Received outbound call handler request', {
      callSid: req.body.CallSid,
      from: req.body.From,
      to: req.body.To,
    });

    // In a real implementation, we would extract campaignId and contactId from the request
    // For now, we'll use dummy values
    const campaignId = req.body.campaignId || 'default-campaign';
    const contactId = req.body.contactId || 'default-contact';

    const twilioOutboundService = new TwilioOutboundService();
    const twiml = await twilioOutboundService.handleOutboundCallWebhook(
      req.body.CallSid,
      campaignId,
      contactId
    );

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Error handling outbound call', error);
    
    res.type('text/xml').status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was an error processing your call. Please try again later.</Say>
  <Hangup />
</Response>`);
  }
});

export default router;
