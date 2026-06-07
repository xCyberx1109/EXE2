import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function validateDatabaseUrl() {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('postgresql://')) {
    console.error('✗ DATABASE_URL phải bắt đầu bằng postgresql://');
    console.error(`  Giá trị hiện tại: ${url.replace(/\/\/.*@/, '//***@')}`);
    console.error('  Kiểm tra file .env hoặc biến môi trường');
    process.exit(1);
  }
  if (!url.includes('connection_limit')) {
    console.warn('⚠ DATABASE_URL chưa có ?connection_limit=15. Thêm vào để tránh pool exhaustion.');
  }
  if (!url.includes('pool_timeout')) {
    console.warn('⚠ DATABASE_URL chưa có pool_timeout. Thêm &pool_timeout=30 để tránh treo connection.');
  }
}

validateDatabaseUrl();

const prismaClientConfig = {
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient(prismaClientConfig);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export default prisma;

export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error('[PRISMA] Error during disconnect:', err.message);
  }
}
