import prisma from '../prisma/client.js';

export const staffSessionRepository = {
  findById: (id) =>
    prisma.staffSession.findUnique({ where: { id } }),

  findActiveByAccount: (accountId, deviceId) =>
    prisma.staffSession.findFirst({
      where: { accountId, deviceId, logoutAt: null },
    }),

  findActiveByDevice: (deviceId) =>
    prisma.staffSession.findMany({
      where: { deviceId, logoutAt: null },
      include: { account: { select: { id: true, fullName: true, role: true } } },
      orderBy: { loginAt: 'desc' },
    }),

  findActiveByShift: (shiftId) =>
    prisma.staffSession.findMany({
      where: { shiftId, logoutAt: null },
      include: { account: { select: { id: true, fullName: true, role: true } } },
    }),

  create: (data) => prisma.staffSession.create({ data }),

  update: (id, data) =>
    prisma.staffSession.update({ where: { id }, data }),

  logoutAllByDevice: (deviceId) =>
    prisma.staffSession.updateMany({
      where: { deviceId, logoutAt: null },
      data: { logoutAt: new Date() },
    }),

  logoutAllByAccount: (accountId, deviceId) =>
    prisma.staffSession.updateMany({
      where: { accountId, deviceId, logoutAt: null },
      data: { logoutAt: new Date() },
    }),
};
