import { seedDatabase } from '../src/seed/runSeed.js';
import { disconnectPrisma } from '../src/prisma/client.js';

seedDatabase()
  .catch((e) => {
    console.error('Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
