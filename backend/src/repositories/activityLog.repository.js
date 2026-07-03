import prisma from '../prisma/client.js';

export const activityLogRepository = {
  create: (data) => prisma.activityLog.create({ data }),

  findByAccount: (accountId, limit = 50) =>
    prisma.activityLog.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { account: { select: { id: true, fullName: true } } },
    }),

  findByEmployee: (employeeId, { page = 1, limit = 20, action, module, startDate, endDate } = {}) => {
    const where = { employeeId };
    if (action) where.action = action;
    if (module) where.module = module;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    const skip = (page - 1) * limit;
    return Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);
  },
};
