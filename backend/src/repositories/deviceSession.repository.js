import prisma from '../prisma/client.js';

export const deviceSessionRepository = {
  findById: (id) =>
    prisma.deviceSession.findUnique({ where: { id } }),

  findByTokenHash: (tokenHash) =>
    prisma.deviceSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    }),

  findActiveByDevice: (deviceId) =>
    prisma.deviceSession.findMany({
      where: { deviceId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),

  create: (data) => prisma.deviceSession.create({ data }),

  update: (id, data) =>
    prisma.deviceSession.update({ where: { id }, data }),

  revokeAllByDevice: (deviceId) =>
    prisma.deviceSession.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),

  revokeExpired: async () => {
    const result = await prisma.deviceSession.updateMany({
      where: { expiresAt: { lt: new Date() }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  },
};
