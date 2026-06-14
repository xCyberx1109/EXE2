import prisma from '../prisma/client.js';

function buildWhere({ search, active, includeDeleted, deleted } = {}) {
  const where = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (active === true || active === 'true') {
    where.active = true;
  } else if (active === false || active === 'false') {
    where.active = false;
  }

  if (includeDeleted === true || includeDeleted === 'true') {

  } else if (deleted === true || deleted === 'true') {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }

  return where;
}

function buildOrderBy(sort, orderDir) {
  const direction = orderDir === 'desc' ? 'desc' : 'asc';
  const sortMap = {
    createdAt: { createdAt: direction },
    sortOrder: { sortOrder: direction },
    name: { name: direction },
  };
  return sortMap[sort] || { sortOrder: 'asc' };
}

export const categoryRepository = {
  findAll: ({ page = 1, limit = 20, search, sort, sortOrder, active, includeDeleted, deleted } = {}) => {
    const skip = (page - 1) * limit;
    const where = buildWhere({ search, active, includeDeleted, deleted });
    const orderBy = buildOrderBy(sort, sortOrder);

    return prisma.category.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: { _count: { select: { menuItems: true } } },
    });
  },

  count: ({ search, active, includeDeleted, deleted } = {}) => {
    const where = buildWhere({ search, active, includeDeleted, deleted });
    return prisma.category.count({ where });
  },

  findById: (id) =>
    prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { menuItems: true } } },
    }),

  findBySlug: (slug) =>
    prisma.category.findFirst({
      where: { slug, deletedAt: null },
    }),

  create: (data) => prisma.category.create({ data }),

  update: (id, data) =>
    prisma.category.update({
      where: { id },
      data,
      include: { _count: { select: { menuItems: true } } },
    }),

  softDelete: (id) =>
    prisma.category.update({ where: { id }, data: { deletedAt: new Date() } }),

  restore: (id) =>
    prisma.category.update({ where: { id }, data: { deletedAt: null } }),

  findByName: (name) => {
    const where = { name, deletedAt: null };
    return prisma.category.findFirst({ where });
  },

  findMany: (where = {}) =>
    prisma.category.findMany({
      where: { deletedAt: null, ...where },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { menuItems: true } } },
    }),
};
