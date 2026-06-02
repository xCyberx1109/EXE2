import app from './app.js';
import config from './config/index.js';
import prisma from './prisma/client.js';
import { runSeedIfEmpty, syncPermissions } from './seed/runSeed.js';
import { permissionService } from './modules/permissions/permission.service.js';
import { startHeartbeatCheck } from './jobs/heartbeatCheck.js';

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✓ Kết nối MySQL thành công');

    if (config.autoSeedOnStart) {
      // Luôn đồng bộ permissions trước, bất kể DB có data hay không
      await syncPermissions();
      permissionService.invalidateCache();
      await runSeedIfEmpty();
    }

    startHeartbeatCheck();

    const server = app.listen(config.port, () => {
      console.log(`✓ Server chạy tại http://localhost:${config.port}`);
      console.log(`  API: http://localhost:${config.port}/api`);
      console.log(`  POS: http://localhost:${config.port}/api/pos`);
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
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
