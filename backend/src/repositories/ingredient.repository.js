import prisma from '../prisma/client.js';

export const ingredientRepository = {
  findMany: (where = {}) =>
    prisma.ingredient.findMany({ where, orderBy: { name: 'asc' } }),

  findById: (id) => prisma.ingredient.findUnique({ where: { id } }),

  create: (data) => prisma.ingredient.create({ data }),

  update: (id, data) => prisma.ingredient.update({ where: { id }, data }),

  delete: (id) => prisma.ingredient.delete({ where: { id } }),

  findLowStock: async () => {
    const items = await prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
    return items
      .filter((i) => Number(i.quantity) < Number(i.minQuantity))
      .sort((a, b) => Number(b.minQuantity) - Number(b.quantity) - (Number(a.minQuantity) - Number(a.quantity)));
  },
};
