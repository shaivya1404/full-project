import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Global prisma client singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = (): PrismaClient => {
  const clientConfig: ConstructorParameters<typeof PrismaClient>[0] = {
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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
