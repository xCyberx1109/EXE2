import prisma from '../prisma/client.js';

const employeeInclude = {
  permissions: {
    include: { permission: true },
  },
};

export const employeeRepository = {
  findById: (id) =>
    prisma.employee.findUnique({
      where: { id },
    }),

  findByIdWithAccount: (id) =>
    prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: employeeInclude,
    }),

  findByAccountId: (accountId, { search, status, page, limit } = {}) => {
    const where = { accountId, deletedAt: null };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (page && limit) {
      const skip = (page - 1) * limit;
      return Promise.all([
        prisma.employee.findMany({ where, include: employeeInclude, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.employee.count({ where }),
      ]);
    }
    return prisma.employee.findMany({ where, include: employeeInclude, orderBy: { createdAt: 'desc' } });
  },

  create: (data) =>
    prisma.employee.create({ data }),

  update: (id, data) =>
    prisma.employee.update({ where: { id }, data }),

  softDelete: (id) =>
    prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
};
