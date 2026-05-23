import prisma from '../prisma/client.js';

export const categoryRepository = {
  findAll: (where = {}) =>
    prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { menuItems: true } } },
    }),

  findById: (id) => prisma.category.findUnique({ where: { id } }),

  findByName: (name) => prisma.category.findUnique({ where: { name } }),

  create: (data) => prisma.category.create({ data }),

  update: (id, data) => prisma.category.update({ where: { id }, data }),

  delete: (id) => prisma.category.delete({ where: { id } }),
};
