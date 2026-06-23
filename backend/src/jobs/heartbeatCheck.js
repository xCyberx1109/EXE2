import prisma from '../prisma/client.js';

const TIMEOUT_MINUTES = 2;
const CHECK_INTERVAL_MS = 60 * 1000; // 1 phút

export function startHeartbeatCheck() {
  console.log(`✓ Đã khởi động heartbeat check (timeout: ${TIMEOUT_MINUTES} phút) — chỉ log, KHÔNG tự khóa máy`);

  setInterval(async () => {
    try {
      await checkHeartbeat();
    } catch (err) {
      console.error('[HeartbeatCheck] Lỗi:', err.message);
    }
  }, CHECK_INTERVAL_MS);
}

async function checkHeartbeat() {
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

  // Chỉ log cảnh báo — KHÔNG cập nhật status thành LOCKED
  // Máy POS ACTIVE sẽ duy trì ACTIVE cho đến khi admin/người dùng chủ động khóa.
  const inactiveMachines = await prisma.pos_machines.findMany({
    where: {
      status: 'ACTIVE',
      lastLoginAt: { lt: cutoff },
      deletedAt: null,
    },
    select: { id: true, name: true, lastLoginAt: true },
  });

  if (inactiveMachines.length > 0) {
    console.log(`[HeartbeatCheck] ${inactiveMachines.length} máy POS không có hoạt động trong ${TIMEOUT_MINUTES} phút (giữ ACTIVE — không tự khóa):`,
      inactiveMachines.map(m => ({ id: m.id, name: m.name, lastLoginAt: m.lastLoginAt }))
    );
  }

  // Chỉ đánh dấu shift offline (không đổi POS status)
  await prisma.shift.updateMany({
    where: {
      isOnline: true,
      status: 'OPEN',
      lastActive: { lt: cutoff },
    },
    data: { isOnline: false },
  });
}
