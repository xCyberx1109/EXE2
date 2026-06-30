import prisma from '../prisma/client.js';

export const posDeviceRepository = {
  findById: (id) => {
    console.log("[POS DEVICE REPO] findById - id:", id);
    return prisma.pos_machines.findUnique({ where: { id } });
  },

  findByIdWithAccount: (id, accountId) => {
    console.log("[POS DEVICE REPO] findByIdWithAccount - id:", id, "accountId:", accountId);

    if (!accountId) {
      throw new Error("Missing accountId (branch context lost)");
    }

    return prisma.pos_machines.findFirst({
      where: { id, accountId, deletedAt: null },
    });
  },

  findByAccountId: (accountId) => {
    console.log("[POS DEVICE REPO] findByAccountId - accountId:", accountId);

    if (!accountId) {
      throw new Error("Missing accountId (branch context lost)");
    }

    return prisma.pos_machines.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  findAll: (where = {}) =>
    prisma.pos_machines.findMany({
      where: { ...where, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),

  create: (data) => prisma.pos_machines.create({ data }),

  update: (id, data) =>
    prisma.pos_machines.update({ where: { id }, data }),

  countByAccount: (accountId) => {
    if (!accountId) {
      throw new Error("Missing accountId (branch context lost)");
    }
    return prisma.pos_machines.count({ where: { accountId, deletedAt: null } });
  },

  softDelete: (id) =>
    prisma.pos_machines.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
};
