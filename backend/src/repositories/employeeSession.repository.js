import prisma from '../prisma/client.js';

export const employeeSessionRepository = {
  findById: (id) =>
    prisma.employeeSession.findUnique({ where: { id }, include: { employee: true, shift: true } }),

  findActiveByEmployee: (employeeId) =>
    prisma.employeeSession.findFirst({
      where: { employeeId, logoutAt: null, isActive: true },
      include: { employee: true, shift: true },
    }),

  findActiveByAccount: (accountId) =>
    prisma.employeeSession.findMany({
      where: { accountId, logoutAt: null, isActive: true },
      include: { employee: true, shift: true },
      orderBy: { loginAt: 'desc' },
    }),

  findActiveByShift: (shiftId) =>
    prisma.employeeSession.findMany({
      where: { shiftId, logoutAt: null, isActive: true },
      include: { employee: true },
    }),

  create: (data) => prisma.employeeSession.create({ data }),

  update: (id, data) =>
    prisma.employeeSession.update({ where: { id }, data }),

  logoutAllByEmployee: (employeeId) =>
    prisma.employeeSession.updateMany({
      where: { employeeId, logoutAt: null, isActive: true },
      data: { logoutAt: new Date(), isActive: false },
    }),

  logoutAllByAccount: (accountId) =>
    prisma.employeeSession.updateMany({
      where: { accountId, logoutAt: null, isActive: true },
      data: { logoutAt: new Date(), isActive: false },
    }),

  logout: (id) =>
    prisma.employeeSession.update({
      where: { id },
      data: { logoutAt: new Date(), isActive: false },
    }),
};
