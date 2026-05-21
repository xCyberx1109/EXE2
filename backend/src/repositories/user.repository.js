import prisma from '../prisma/client.js';

export const userRepository = {
  findByEmail: (email) =>
    prisma.account.findUnique({ where: { email } }),

  findById: (id) =>
    prisma.account.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isSuperAdmin: true,
        mustChangePassword: true,
        branchId: true,
        createdAt: true,
      },
    }),

  findRawById: (id) =>
    prisma.account.findUnique({
      where: { id },
    }),

  create: (data) => prisma.account.create({ data }),

  updateById: (id, data) =>
    prisma.account.update({
      where: { id },
      data,
    }),

  findBranchManagerByBranchId: (branchId) =>
    prisma.account.findFirst({
      where: {
        branchId,
        role: 'MANAGER',
      },
    }),

  count: () => prisma.account.count(),
};
