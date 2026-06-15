import prisma from '../prisma/client.js';
import { AppError } from '../utils/AppError.js';

const includeItems = {
  items: {
    include: {
      menuItem: { include: { category: true } },
    },
  },
};

const ACTIVE_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'];

const tableWithActiveOrder = {
  include: {
    orders: {
      where: { status: { in: ACTIVE_ORDER_STATUSES }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        items: { select: { id: true, menuItemId: true, name: true, quantity: true, price: true, total: true } },
      },
    },
    _count: { select: { orders: true } },
  },
};

export const tableRepository = {
  findMany: (where = {}) => {
    const cleanWhere = Object.fromEntries(Object.entries(where).filter(([, v]) => v !== undefined));
    return prisma.table.findMany({ where: cleanWhere, ...tableWithActiveOrder, orderBy: [{ tableCode: 'asc' }] });
  },

  findById: (id) => {
    if (!id) return Promise.resolve(null);
    return prisma.table.findUnique({ where: { id }, ...tableWithActiveOrder });
  },

  create: (data) =>
    prisma.table.create({ data }),

  update: (id, data) => {
    if (!id) return Promise.reject(new AppError('ID bàn không hợp lệ', 400));
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    return prisma.table.update({ where: { id }, data: cleanData, ...tableWithActiveOrder });
  },

  softDelete: (id) => {
    if (!id) return Promise.reject(new AppError('ID bàn không hợp lệ', 400));
    return prisma.table.update({ where: { id }, data: { isActive: false } });
  },

  findByAccountTableCode: (accountId, tableCode) => {
    if (!accountId || !tableCode) return Promise.resolve(null);
    return prisma.table.findUnique({ where: { accountId_tableCode: { accountId, tableCode } } });
  },

  findActiveOrderForTable: (tableId) => {
    if (!tableId) return Promise.resolve(null);
    return prisma.order.findFirst({
      where: {
        tableId,
        status: { in: ACTIVE_ORDER_STATUSES },
        deletedAt: null,
      },
      include: includeItems,
      orderBy: { createdAt: 'desc' },
    });
  },
};
