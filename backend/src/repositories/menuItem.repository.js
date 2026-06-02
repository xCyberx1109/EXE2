import prisma from '../prisma/client.js';

const includeCategory = { category: true };

export const menuItemRepository = {
  findMany: (where = {}) =>
    prisma.menuItem.findMany({
      where: { deletedAt: null, ...where },
      include: includeCategory,
      orderBy: { name: 'asc' },
    }),

  findById: (id) =>
    prisma.menuItem.findUnique({
      where: { id },
      include: { ...includeCategory, ingredients: { include: { ingredient: true } } },
    }),

  create: (data) =>
    prisma.menuItem.create({ data, include: includeCategory }),

  update: (id, data) =>
    prisma.menuItem.update({ where: { id }, data, include: includeCategory }),

  delete: (id) => prisma.menuItem.delete({ where: { id } }),

  softDelete: (id) =>
    prisma.menuItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),

  count: (where = {}) => prisma.menuItem.count({ where }),
};
