import { Router, Request, Response } from 'express';
import { config } from '../config/env';
import { logger } from '../utils/logger';

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

router.post('/call-status', (req: Request, res: Response) => {
  try {
    logger.info('Received call status webhook from Twilio', {
      callSid: req.body.CallSid,
      callStatus: req.body.CallStatus,
      from: req.body.From,
      to: req.body.To,
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling call status webhook', error);
    res.status(500).send('Error');
  }
});

export default router;
