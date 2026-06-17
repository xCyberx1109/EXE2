import app from './app.js';
import config from './config/index.js';
import prisma from './prisma/client.js';
import { syncPermissions } from './seed/runSeed.js';
import { permissionService } from './modules/permissions/permission.service.js';
import { startHeartbeatCheck } from './jobs/heartbeatCheck.js';
import { mailLogger } from './utils/logger.js';

function validateDatabaseProvider() {
  const url = config.databaseUrl || '';
  if (!url.startsWith('postgresql://')) {
    console.error('✗ DATABASE_URL không hợp lệ. Phải bắt đầu bằng postgresql://');
    console.error(`  Giá trị hiện tại: ${url.replace(/\/\/.*@/, '//***@')}`);
    console.error('  Hãy kiểm tra biến môi trường DATABASE_URL trên Render');
    process.exit(1);
  }
}

const startServer = async () => {
  try {
    validateDatabaseProvider();
    await prisma.$connect();
    console.log('✓ Kết nối PostgreSQL thành công');

    // Đồng bộ permissions khi start (nhẹ, chỉ upsert nếu cần)
    try {
      console.log('→ Đồng bộ permissions...');
      await syncPermissions();
      permissionService.invalidateCache();
      console.log('✓ Hoàn tất đồng bộ permissions');
    } catch (syncError) {
      console.error('⚠ Lỗi đồng bộ permissions:', syncError.message);
    }

    // Seed riêng qua CLI: npx prisma db seed

    startHeartbeatCheck();

    if (config.email.apiKey) {
      mailLogger.log('SYSTEM', 'Resend API key configured — email sending ready');
    } else {
      mailLogger.log('SYSTEM', 'RESEND_API_KEY not configured — email sending disabled');
    }

    const server = app.listen(config.port, () => {
      console.log(`✓ Server chạy tại http://localhost:${config.port}`);
      console.log(`  API: http://localhost:${config.port}/api`);
      console.log(`  POS: http://localhost:${config.port}/api/pos`);
      console.log('');
      console.log('━'.repeat(52));
      console.log('  Server Startup Summary');
      console.log('━'.repeat(52));
      console.log(`  NODE_ENV        : ${config.nodeEnv}`);
      console.log(`  PORT            : ${config.port}`);
      console.log(`  Database        : Connected`);
      console.log(`  DB Provider     : PostgreSQL (Supabase)`);
      console.log(`  DB URL          : ${(config.databaseUrl || '').replace(/\/\/.*@/, '//***@')}`);
      console.log(`  API Base URL    : http://localhost:${config.port}/api`);
      console.log('━'.repeat(52));
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`✗ Port ${config.port} đang được dùng bởi process khác.`);
        console.error(`  Windows: Get-NetTCPConnection -LocalPort ${config.port} | %% ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
        console.error('  Hoặc đổi PORT trong file .env');
      } else {
        console.error('✗ Lỗi server:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('✗ Không thể khởi động server:', error.message);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  console.log('SIGINT received — disconnecting Prisma and exiting');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received — disconnecting Prisma and exiting');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION — server continues but this should be fixed:');
  console.error(reason);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — server continues but this should be fixed:');
  console.error(err);
});

startServer();
