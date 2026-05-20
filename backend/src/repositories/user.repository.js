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
        branchId: true,
        createdAt: true,
      },
    }),

  create: (data) => prisma.account.create({ data }),

  count: () => prisma.account.count(),
};
