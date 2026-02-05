import dotenv from 'dotenv';
import { z } from 'zod';
import crypto from 'crypto';

dotenv.config();

// Generate secure defaults for development (but warn in production)
const generateSecureDefault = (prefix: string): string => {
  return `${prefix}-${crypto.randomBytes(32).toString('hex')}`;
};

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  BASE_URL: z.string().default('http://localhost:3000'),
  PUBLIC_SERVER_URL: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().optional(),

  // Twilio Credentials
  TWILIO_ACCOUNT_SID: z.string().min(1, 'Twilio Account SID is required'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'Twilio Auth Token is required'),
  TWILIO_PHONE_NUMBER: z.string().min(1, 'Twilio Phone Number is required'),
  TWILIO_WEBHOOK_SECRET: z.string().min(1, 'Twilio Webhook Secret is required'),

  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API Key is required'),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-4o-realtime-preview'),

  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),

  // Recording Storage
  RECORDING_STORAGE_PATH: z.string().min(1, 'Recording storage path is required'),
  RECORDING_DOWNLOAD_TOKEN: z.string().optional(),
  MAX_RECORDING_SIZE_MB: z.string().default('100').transform(Number),

  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT Secret must be at least 32 characters').default(generateSecureDefault('jwt')),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),

  // API Key Configuration
  API_KEY_SECRET: z.string().min(32, 'API Key Secret must be at least 32 characters').default(generateSecureDefault('api')),

  // Razorpay Payment Gateway
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Email Configuration (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional().or(z.literal('')),
  SMTP_FROM_NAME: z.string().default('Voice AI Dashboard'),

  // SMS Configuration (Twilio for SMS)
  SMS_ENABLED: z.string().default('false').transform((v) => v === 'true'),

  // Company Information (for invoices)
  COMPANY_NAME: z.string().default('Your Company'),
  COMPANY_ADDRESS: z.string().default(''),
  COMPANY_PHONE: z.string().default(''),
  COMPANY_EMAIL: z.string().default(''),
  COMPANY_GST: z.string().optional(),
  COMPANY_LOGO_URL: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  AUTH_RATE_LIMIT_MAX: z.string().default('10').transform(Number),

  // Caching (Redis optional)
  REDIS_URL: z.string().optional(),
  CACHE_TTL_SECONDS: z.string().default('300').transform(Number),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  // Feature Flags
  ENABLE_SWAGGER: z.string().default('true').transform((v) => v === 'true'),
  ENABLE_METRICS: z.string().default('true').transform((v) => v === 'true'),
  ENABLE_AUDIT_LOGS: z.string().default('true').transform((v) => v === 'true'),

  // Security
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),
  SESSION_TIMEOUT_HOURS: z.string().default('24').transform(Number),
  MAX_LOGIN_ATTEMPTS: z.string().default('5').transform(Number),
  LOCKOUT_DURATION_MINUTES: z.string().default('15').transform(Number),

  // File Upload
  MAX_FILE_SIZE_MB: z.string().default('50').transform(Number),
  ALLOWED_FILE_TYPES: z.string().default('csv,xlsx,pdf,wav,mp3'),

  // Backup Configuration
  BACKUP_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  BACKUP_CRON: z.string().default('0 2 * * *'),
  BACKUP_RETENTION_DAYS: z.string().default('30').transform(Number),
  BACKUP_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      JSON.stringify(parsed.error.format(), null, 2),
    );
    process.exit(1);
  }

  const config = parsed.data;

  // Production-specific validations
  if (config.NODE_ENV === 'production') {
    const warnings: string[] = [];

    if (config.JWT_SECRET.startsWith('jwt-')) {
      warnings.push('JWT_SECRET is using auto-generated default. Set a secure value in production!');
    }

    if (config.API_KEY_SECRET.startsWith('api-')) {
      warnings.push('API_KEY_SECRET is using auto-generated default. Set a secure value in production!');
    }

    if (!config.SMTP_HOST) {
      warnings.push('SMTP_HOST not configured. Email notifications will not work.');
    }

    if (!config.RAZORPAY_KEY_ID) {
      warnings.push('RAZORPAY_KEY_ID not configured. Payment processing will not work.');
    }

    if (!config.REDIS_URL) {
      warnings.push('REDIS_URL not configured. Using in-memory rate limiting (not recommended for production).');
    }

    if (warnings.length > 0) {
      console.warn('⚠️  Production configuration warnings:');
      warnings.forEach((w) => console.warn(`   - ${w}`));
    }
  }

  return config;
};

export const config = parseEnv();

// Export typed config helpers
export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';
