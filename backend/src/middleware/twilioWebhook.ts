import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export const validateTwilioWebhook = (req: Request, res: Response, next: NextFunction) => {
  const twilioSignature = req.headers['x-twilio-signature'] as string;

  // Use PUBLIC_SERVER_URL for correct URL validation (important when behind proxies/ngrok)
  const publicUrl = process.env.PUBLIC_SERVER_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${publicUrl}${req.originalUrl}`;
  const params = req.body || {};

  // Skip validation in development/test for easier debugging
  if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
    logger.debug('Skipping Twilio webhook validation in development/test mode');
    return next();
  }

  try {
    // ⭐ IMPORTANT: Use TWILIO_AUTH_TOKEN for signature validation (not a custom secret)
    // Twilio signs requests using the Auth Token from your account
    const isValid = twilio.validateRequest(
      config.TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      params,
    );

    if (isValid) {
      return next();
    } else {
      logger.warn('Invalid Twilio Signature', { url, hasSignature: !!twilioSignature });
      return res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('Error validating Twilio webhook', error);
    return res.status(500).send('Internal Server Error');
  }
};
