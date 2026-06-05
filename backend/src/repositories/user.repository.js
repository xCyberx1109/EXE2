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
        mustChangePassword: true,
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

  count: () => prisma.account.count(),
};
