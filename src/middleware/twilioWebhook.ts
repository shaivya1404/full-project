import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export const validateTwilioWebhook = (req: Request, res: Response, next: NextFunction) => {
  const twilioSignature = req.headers['x-twilio-signature'] as string;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const params = req.body || {};

  if (config.NODE_ENV === 'test') {
    return next();
  }

  try {
    const isValid = twilio.validateRequest(
      config.TWILIO_WEBHOOK_SECRET,
      twilioSignature,
      url,
      params,
    );

    if (isValid) {
      return next();
    } else {
      logger.warn('Invalid Twilio Signature');
      return res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('Error validating Twilio webhook', error);
    return res.status(500).send('Internal Server Error');
  }
};
