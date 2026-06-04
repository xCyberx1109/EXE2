import prisma from '../prisma/client.js';

export const categoryRepository = {
  findAll: (where = {}) =>
    prisma.category.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { menuItems: true } } },
    }),

  findById: (id) =>
    prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { menuItems: true } } },
    }),

  findByName: (name, branchId) => {
    const where = { name, deletedAt: null };
    if (branchId) where.branchId = branchId;
    return prisma.category.findFirst({ where });
  },

  create: (data) => prisma.category.create({ data }),

  update: (id, data) =>
    prisma.category.update({
      where: { id },
      data,
      include: { _count: { select: { menuItems: true } } },
    }),

  softDelete: (id) =>
    prisma.category.update({ where: { id }, data: { deletedAt: new Date() } }),
};
