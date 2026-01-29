import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  // Twilio Credentials
  TWILIO_ACCOUNT_SID: z.string().min(1, 'Twilio Account SID is required'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'Twilio Auth Token is required'),
  TWILIO_PHONE_NUMBER: z.string().min(1, 'Twilio Phone Number is required'),
  // OpenAI Key & Model
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API Key is required'),
  OPENAI_REALTIME_MODEL: z.string().optional().default('gpt-4o-realtime-preview'),
  RECORDING_DOWNLOAD_TOKEN: z.string().optional(),
  // DB URL
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  // Recording Storage
  RECORDING_STORAGE_PATH: z.string().min(1, 'Recording storage path is required'),
  // Signing Secrets
  TWILIO_WEBHOOK_SECRET: z.string().min(1, 'Twilio Webhook Secret is required'),
  // JWT Configuration
  JWT_SECRET: z.string().default('default-jwt-secret-for-development-only'),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  // API Key Secret
  API_KEY_SECRET: z.string().default('default-api-key-secret-for-development-only'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      '❌ Invalid environment variables:',
      JSON.stringify(parsed.error.format(), null, 2),
    );
    process.exit(1);
  }

  return parsed.data;
};

export const config = parseEnv();
