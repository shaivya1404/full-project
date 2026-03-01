import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'demo@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'demo123';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Create or update demo user
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      id: randomUUID(),
      email: adminEmail,
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
      isActive: true,
      emailVerified: true,
      updatedAt: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded user: ${user.email} (id: ${user.id})`);

  // Seed baseline ML models so management endpoints respond with data
  await prisma.mlModel.upsert({
    where: { name_type_version: { name: 'vits_multilingual', type: 'tts', version: '1.0.0' } },
    update: {},
    create: {
      name: 'vits_multilingual',
      type: 'tts',
      version: '1.0.0',
      status: 'active',
    },
  });

  await prisma.mlModel.upsert({
    where: { name_type_version: { name: 'conformer_rnnt', type: 'stt', version: '1.0.0' } },
    update: {},
    create: {
      name: 'conformer_rnnt',
      type: 'stt',
      version: '1.0.0',
      status: 'active',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
