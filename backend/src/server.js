import app from './app.js';
import config from './config/index.js';
import prisma from './prisma/client.js';
import { runSeedIfEmpty } from './seed/runSeed.js';

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✓ Kết nối MySQL thành công');

    if (config.autoSeedOnStart) {
      await runSeedIfEmpty();
    }

    const server = app.listen(config.port, () => {
      console.log(`✓ Server chạy tại http://localhost:${config.port}`);
      console.log(`  API: http://localhost:${config.port}/api`);
      console.log(`  POS Orders (legacy): http://localhost:${config.port}/orders`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`✗ Port ${config.port} đang được dùng bởi process khác.`);
        console.error('  Windows: Get-NetTCPConnection -LocalPort 3001 | %% ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }');
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
