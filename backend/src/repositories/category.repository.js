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
    name: { name: direction },
  };
  return sortMap[sort] || { name: 'asc' };
}

export const categoryRepository = {
  findAll: ({ page = 1, limit = 20, search, sort, active, includeDeleted, deleted } = {}) => {
    const skip = (page - 1) * limit;
    const where = buildWhere({ search, active, includeDeleted, deleted });
    const orderBy = buildOrderBy(sort);

    return prisma.category.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: { _count: { select: { menuItems: { where: { deletedAt: null } } } } },
    });
  },

  count: ({ search, active, includeDeleted, deleted } = {}) => {
    const where = buildWhere({ search, active, includeDeleted, deleted });
    return prisma.category.count({ where });
  },

  findById: (id) =>
    prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { menuItems: { where: { deletedAt: null } } } } },
    }),

  /** Dùng cho màn hình xem chi tiết — kèm danh sách món ăn thuộc danh mục (chưa xóa). */
  findByIdWithItems: (id) =>
    prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { menuItems: { where: { deletedAt: null } } } },
        menuItems: {
          where: { deletedAt: null },
          select: { id: true, name: true, price: true, available: true },
          orderBy: { name: 'asc' },
        },
      },
    }),

  /** Dùng cho thống kê phân bổ danh mục — chỉ danh mục chưa xóa. */
  findAllWithCounts: () =>
    prisma.category.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { menuItems: { where: { deletedAt: null } } } } },
      orderBy: { name: 'asc' },
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
      include: { _count: { select: { menuItems: { where: { deletedAt: null } } } } },
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
      orderBy: { name: 'asc' },
      include: { _count: { select: { menuItems: { where: { deletedAt: null } } } } },
    }),
};
