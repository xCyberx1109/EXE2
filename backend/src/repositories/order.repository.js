import prisma from '../prisma/client.js';

const includeItems = {
  items: {
    include: {
      menuItem: { include: { category: true } },
    },
  },
};

export const orderRepository = {
  findMany: (where = {}) =>
    prisma.order.findMany({
      where,
      include: includeItems,
      orderBy: { createdAt: 'desc' },
    }),

  findPendingByTable: (tableNumber) =>
    prisma.order.findMany({
      where: {
        tableNumber,
        status: { in: ['PENDING', 'PREPARING'] },
      },
      include: includeItems,
      orderBy: { createdAt: 'asc' },
    }),

  findById: (id) =>
    prisma.order.findUnique({ where: { id }, include: includeItems }),

  create: (data) =>
    prisma.order.create({ data, include: includeItems }),

  update: (id, data) =>
    prisma.order.update({ where: { id }, data, include: includeItems }),

  delete: (id) => prisma.order.delete({ where: { id } }),

  aggregateTopItems: async (limit = 10, branchId) => {
    const where = {
      menuItemId: { not: null },
      order: { status: 'COMPLETED' },
    };
    if (branchId) {
      where.order.branchId = branchId;
    }
    const items = await prisma.orderItem.findMany({
      where,
      select: { menuItemId: true, quantity: true },
    });

    const totals = {};
    for (const item of items) {
      totals[item.menuItemId] = (totals[item.menuItemId] || 0) + item.quantity;
    }

    return Object.entries(totals)
      .map(([menuItemId, quantity]) => ({
        menuItemId,
        _sum: { quantity },
      }))
      .sort((a, b) => b._sum.quantity - a._sum.quantity)
      .slice(0, limit);
  },
};
