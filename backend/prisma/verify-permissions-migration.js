import prisma, { disconnectPrisma } from '../src/prisma/client.js';

const permissions = [
  { code: 'POS_ORDER_QUEUE_VIEW', name: 'Xem Order Queue POS', module: 'pos_order_queue' },
  { code: 'POS_ORDER_QUEUE_CREATE', name: 'Tạo Order Queue POS', module: 'pos_order_queue' },
  { code: 'POS_ORDER_QUEUE_UPDATE', name: 'Cập nhật Order Queue POS', module: 'pos_order_queue' },
  { code: 'POS_ORDER_QUEUE_DELETE', name: 'Xóa Order Queue POS', module: 'pos_order_queue' },
  { code: 'POS_ORDER_QUEUE_PAYMENT', name: 'Thanh toán Order Queue POS', module: 'pos_order_queue' },
];

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: permission,
    });
  }
  console.log('✅ Order Queue permissions added');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
