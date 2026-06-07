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

  delete: (id) =>
    prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),

  softDelete: (id) =>
    prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED', deletedAt: new Date() },
    }),

  aggregateTopItems: async (limit = 10, accountId) => {
    const where = { order: { status: 'COMPLETED' }, menuItemId: { not: { equals: null } } };
    if (accountId) {
      where.order.accountId = accountId;
    }
    const result = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });
    return result.map((r) => ({
      menuItemId: r.menuItemId,
      _sum: { quantity: r._sum.quantity, total: r._sum.total },
    }));
  },
};
