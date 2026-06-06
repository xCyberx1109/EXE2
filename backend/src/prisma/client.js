import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function validateDatabaseUrl() {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('postgresql://')) {
    console.error('✗ DATABASE_URL phải bắt đầu bằng postgresql://');
    console.error(`  Giá trị hiện tại: ${url.replace(/\/\/.*@/, '//***@')}`);
    console.error('  Kiểm tra file .env hoặc biến môi trường trên Render');
    process.exit(1);
  }
}

validateDatabaseUrl();

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
