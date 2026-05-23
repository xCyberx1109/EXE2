import prisma from '../prisma/client.js';

const TIMEOUT_MINUTES = 2;
const CHECK_INTERVAL_MS = 60 * 1000; // 1 phút

export function startHeartbeatCheck() {
  console.log(`✓ Đã khởi động heartbeat check (timeout: ${TIMEOUT_MINUTES} phút)`);

  setInterval(async () => {
    try {
      await checkAndMarkOffline();
    } catch (err) {
      console.error('[HeartbeatCheck] Lỗi:', err.message);
    }
  }, CHECK_INTERVAL_MS);
}

async function checkAndMarkOffline() {
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

  const result = await prisma.posDevice.updateMany({
    where: {
      status: 'ONLINE',
      lastActive: { lt: cutoff },
    },
    data: { status: 'OFFLINE' },
  });

  if (result.count > 0) {
    console.log(`[HeartbeatCheck] Đã đánh dấu ${result.count} thiết bị OFFLINE do timeout`);

    // Đánh dấu shift tương ứng offline
    await prisma.shift.updateMany({
      where: {
        isOnline: true,
        status: 'OPEN',
        lastActive: { lt: cutoff },
      },
      data: { isOnline: false },
    });
  }
}
