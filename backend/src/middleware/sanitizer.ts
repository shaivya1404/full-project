import { Request, Response, NextFunction } from 'express';

/**
 * Sanitizes string input to prevent XSS and injection attacks
 */
const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return str;

  return str
    // Remove null bytes
    .replace(/\0/g, '')
    // Encode HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove potential SQL injection patterns (basic)
    .replace(/--/g, '')
    .replace(/;/g, '&#59;')
    // Trim whitespace
    .trim();
};

/**
 * Deep sanitizes an object recursively
 */
const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      // Skip sanitization for password fields (we need the original)
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
        sanitized[key] = obj[key];
      } else {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * Validates and sanitizes common input patterns
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

export const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Express middleware to sanitize all incoming request data
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters (modify in place for Express 5 compatibility)
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === 'string') {
        (req.query as Record<string, any>)[key] = sanitizeString(value);
      }
    }
  }

  // Sanitize params (modify in place for Express 5 compatibility)
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      (req.params as Record<string, string>)[key] = sanitizeString(req.params[key]);
    }
  }

  next();
};

/**
 * Rate limit key generator with sanitization
 */
export const sanitizeRateLimitKey = (key: string): string => {
  return key.replace(/[^a-zA-Z0-9\-_:]/g, '');
};

export default { sanitizeInput, validateEmail, validatePhone, validateUUID, sanitizeRateLimitKey };
