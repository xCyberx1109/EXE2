import prisma from '../prisma/client.js';

const includeIngredients = { ingredients: { include: { ingredient: true } } };

const ALLOWED_FIELDS = [
  'name', 'price', 'cost', 'description', 'imageUrl',
  'available', 'deletedAt', 'accountId',
];

function sanitizePayload(data) {
  const clean = {};
  for (const key of Object.keys(data)) {
    if (ALLOWED_FIELDS.includes(key)) {
      clean[key] = data[key];
    }
  }
  return clean;
}

export const menuItemRepository = {
  findMany: (where = {}, options = {}) => {
    const finalWhere = { deletedAt: null, ...where };
    const { page, limit } = options;
    if (page && limit) {
      const skip = (page - 1) * limit;
      return Promise.all([
        prisma.menuItem.findMany({
          where: finalWhere,
          include: includeIngredients,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        prisma.menuItem.count({ where: finalWhere }),
      ]);
    }
    return prisma.menuItem.findMany({
      where: finalWhere,
      include: includeIngredients,
      orderBy: { name: 'asc' },
    });
  },

  findManyLight: (where = {}) =>
    prisma.menuItem.findMany({
      where: { deletedAt: null, ...where },
      orderBy: { name: 'asc' },
    }),

  findById: (id) =>
    prisma.menuItem.findUnique({
      where: { id },
      include: includeIngredients,
    }),

  create: (data) =>
    prisma.menuItem.create({ data: sanitizePayload(data) }),

  update: (id, data) =>
    prisma.menuItem.update({ where: { id }, data: sanitizePayload(data), include: includeIngredients }),

  delete: (id) => prisma.menuItem.delete({ where: { id } }),

  softDelete: (id) =>
    prisma.menuItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),

  count: (where = {}) => prisma.menuItem.count({ where }),
};
