const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const allOrders = await prisma.order.findMany({
    where: { source: "ORDER_QUEUE_POS", deletedAt: null },
    select: {
      id: true, orderNumber: true, orderType: true, source: true,
      status: true, paymentStatus: true, total: true, cost: true, profit: true,
      createdAt: true, completedAt: true, accountId: true,
      createdBy: true, createdByUserId: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log("=== ALL ORDER_QUEUE_POS ORDERS ===");
  console.log("Total:", allOrders.length);
  for (const o of allOrders) {
    console.log(JSON.stringify(o));
  }
  await prisma.$disconnect();
})();
