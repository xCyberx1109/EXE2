import prisma from '../prisma/client.js';

export const posDeviceRepository = {
  findById: (id) =>
    prisma.posDevice.findUnique({ where: { id } }),

  findByIdWithAccount: (id) =>
    prisma.posDevice.findUnique({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { orders: true } },
      },
    }),

  findByDeviceCode: (deviceCode) =>
    prisma.posDevice.findUnique({ where: { deviceCode } }),

  findByPin: (pin) =>
    prisma.posDevice.findFirst({
      where: { devicePin: pin, deletedAt: null },
    }),

  findByDeviceToken: (token) =>
    prisma.posDevice.findFirst({
      where: { deviceToken: token, deletedAt: null },
    }),

  findByBranchId: (branchId) => {
    const where = { deletedAt: null };
    if (branchId) where.branchId = branchId;
    return prisma.posDevice.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: {
              where: {
                createdAt: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
              },
            },
          },
        },
        shifts: {
          where: { status: 'OPEN' },
          orderBy: { startTime: 'desc' },
          take: 1,
          include: { account: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  findAll: (where = {}) =>
    prisma.posDevice.findMany({
      where: { deletedAt: null, ...where },
      orderBy: { createdAt: 'desc' },
    }),

  create: (data) => prisma.posDevice.create({ data }),

  update: (id, data) =>
    prisma.posDevice.update({ where: { id }, data }),

  countByBranch: (branchId) =>
    prisma.posDevice.count({ where: { branchId, deletedAt: null } }),

  findDeviceCode: (deviceCode) =>
    prisma.posDevice.findUnique({ where: { deviceCode } }),

  softDelete: (id) =>
    prisma.posDevice.update({
      where: { id },
      data: { deletedAt: new Date(), active: false, deviceToken: null },
    }),
};
