import prisma from '../prisma/client.js';

export const userRepository = {
  findByEmail: (email) =>
    prisma.user.findUnique({ where: { email } }),

  findById: (id) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    }),

  create: (data) => prisma.user.create({ data }),

  count: () => prisma.user.count(),
};
