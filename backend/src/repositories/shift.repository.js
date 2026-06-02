import prisma from '../prisma/client.js';

export const shiftRepository = {
  findById: (id) =>
    prisma.shift.findUnique({
      where: { id },
      include: { account: { select: { id: true, fullName: true } } },
    }),

  findOpenShiftByDevice: (posDeviceId) =>
    prisma.shift.findFirst({
      where: { posDeviceId, status: 'OPEN' },
      include: { account: { select: { id: true, fullName: true } } },
    }),

  findOpenShiftByDeviceAndAccount: (posDeviceId, accountId) =>
    prisma.shift.findFirst({
      where: { posDeviceId, accountId, status: 'OPEN' },
    }),

  create: (data) => prisma.shift.create({ data }),

  update: (id, data) =>
    prisma.shift.update({ where: { id }, data }),

  closeOpenShifts: async (posDeviceId) =>
    prisma.shift.updateMany({
      where: { posDeviceId, status: 'OPEN' },
      data: { status: 'CLOSED', endTime: new Date(), isOnline: false },
    }),

  markOfflineByDevice: (posDeviceId) =>
    prisma.shift.updateMany({
      where: { posDeviceId, isOnline: true, status: 'OPEN' },
      data: { isOnline: false },
    }),

  markOfflineByTimeout: async (timeoutMinutes = 2) => {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    return prisma.shift.updateMany({
      where: {
        isOnline: true,
        status: 'OPEN',
        lastActive: { lt: cutoff },
      },
      data: { isOnline: false },
    });
  },
};
