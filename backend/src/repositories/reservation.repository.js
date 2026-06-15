import prisma from '../prisma/client.js';
import { AppError } from '../utils/AppError.js';

const reservationInclude = {
  table: {
    select: { id: true, tableCode: true, tableName: true, status: true },
  },
};

export const reservationRepository = {
  findMany: (where = {}) => {
    const clean = Object.fromEntries(Object.entries(where).filter(([, v]) => v !== undefined));
    return prisma.reservation.findMany({
      where: clean,
      include: reservationInclude,
      orderBy: { reservationTime: 'asc' },
    });
  },

  findById: (id) => {
    if (!id) return Promise.resolve(null);
    return prisma.reservation.findUnique({ where: { id }, include: reservationInclude });
  },

  findPendingByTableId: (tableId) => {
    if (!tableId) return Promise.resolve(null);
    return prisma.reservation.findFirst({
      where: { tableId, status: 'PENDING' },
      include: reservationInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  create: (data) => prisma.reservation.create({ data, include: reservationInclude }),

  update: (id, data) => {
    if (!id) return Promise.reject(new AppError('ID đặt bàn không hợp lệ', 400));
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    return prisma.reservation.update({ where: { id }, data: clean, include: reservationInclude });
  },
};
