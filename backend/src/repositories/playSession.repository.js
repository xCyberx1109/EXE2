import prisma from '../prisma/client.js';
import { PlaySessionStatus } from '@prisma/client';
import { AppError } from '../utils/AppError.js';

const sessionInclude = {
  table: {
    select: { id: true, tableCode: true, tableName: true, status: true },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      subtotal: true,
      tax: true,
      serviceCharge: true,
      items: {
        select: { id: true, menuItemId: true, name: true, quantity: true, price: true, total: true },
      },
    },
  },
};

export const playSessionRepository = {
  findMany: (where = {}) => {
    const clean = Object.fromEntries(Object.entries(where).filter(([, v]) => v !== undefined));
    return prisma.playSession.findMany({
      where: clean,
      include: sessionInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  findById: (id) => {
    if (!id) return Promise.resolve(null);
    return prisma.playSession.findUnique({ where: { id }, include: sessionInclude });
  },

  findActiveByTableId: (tableId) => {
    if (!tableId) return Promise.resolve(null);
    return prisma.playSession.findFirst({
      where: { tableId, status: PlaySessionStatus.PLAYING },
      include: sessionInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  create: (data) => prisma.playSession.create({ data, include: sessionInclude }),

  update: (id, data) => {
    if (!id) return Promise.reject(new AppError('ID phiên chơi không hợp lệ', 400));
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    return prisma.playSession.update({ where: { id }, data: clean, include: sessionInclude });
  },
};
