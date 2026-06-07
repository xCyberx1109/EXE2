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

  findByDevice: (posDeviceId, limit = 50) =>
    prisma.activityLog.findMany({
      where: { posDeviceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { account: { select: { id: true, fullName: true } } },
    }),
};
