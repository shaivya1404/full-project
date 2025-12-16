import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    const clientConfig: ConstructorParameters<typeof PrismaClient>[0] = {
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    };

    prisma = new PrismaClient(clientConfig);

    prisma.$connect().catch((error: Error) => {
      logger.error('Failed to connect to database', error);
      throw error;
    });
  }

  return prisma;
};

export const disconnectPrisma = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
  }
};
