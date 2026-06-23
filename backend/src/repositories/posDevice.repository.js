import prisma from '../prisma/client.js';

export const posDeviceRepository = {
  findById: (id) =>
    prisma.pos_machines.findUnique({ where: { id } }),

  findByIdWithAccount: (id) =>
    prisma.pos_machines.findUnique({
      where: { id, deletedAt: null },
    }),

  findByAccountId: (accountId) => {
    const where = { deletedAt: null };
    if (accountId) where.accountId = accountId;
    return prisma.pos_machines.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  findAll: (where = {}) =>
    prisma.pos_machines.findMany({
      where: { deletedAt: null, ...where },
      orderBy: { createdAt: 'desc' },
    }),

  create: (data) => prisma.pos_machines.create({ data }),

  update: (id, data) =>
    prisma.pos_machines.update({ where: { id }, data }),

  countByAccount: (accountId) =>
    prisma.pos_machines.count({ where: { accountId, deletedAt: null } }),

  softDelete: (id) =>
    prisma.pos_machines.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
};
