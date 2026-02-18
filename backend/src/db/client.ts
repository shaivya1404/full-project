import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Global prisma client singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const buildDatasourceUrl = (): string | undefined => {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  // SQLite URLs (file:./dev.db) can't be parsed with `new URL` — leave them as-is
  if (raw.startsWith('file:')) return raw;

  try {
    const url = new URL(raw);
    // Raise the connection pool if the DATABASE_URL doesn't already set it.
    // Default of 3 is too low for production — causes P2024 timeout errors.
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '10');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30');
    }
    return url.toString();
  } catch {
    return raw;
  }
};

const createPrismaClient = (): PrismaClient => {
  const datasourceUrl = buildDatasourceUrl();

  const clientConfig: ConstructorParameters<typeof PrismaClient>[0] = {
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  };

  const client = new PrismaClient(clientConfig);

  client.$connect().catch((error: Error) => {
    logger.error('Failed to connect to database', error);
    throw error;
  });

  return client;
};

// Export singleton prisma instance
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Legacy function for backward compatibility
export const getPrismaClient = (): PrismaClient => prisma;

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};
