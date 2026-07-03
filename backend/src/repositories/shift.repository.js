import prisma from '../prisma/client.js';

export const shiftRepository = {
  findById: (id) =>
    prisma.shift.findUnique({
      where: { id },
      include: { account: { select: { id: true, fullName: true } } },
    }),

  create: (data) => prisma.shift.create({ data }),

  update: (id, data) =>
    prisma.shift.update({ where: { id }, data }),

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
