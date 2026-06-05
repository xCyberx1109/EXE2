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

  create: async (data) => {
    console.log("[ACCOUNT_CREATE_HIT]", data.email, Date.now());
    try {
      return await prisma.account.create({ data });
    } catch (err) {
      if (err.code === 'P2002') {
        const existing = await prisma.account.findUnique({ where: { email: data.email } });
        if (existing) {
          const conflict = new Error('Email đã được sử dụng');
          conflict.statusCode = 409;
          conflict.code = 'P2002';
          throw conflict;
        }
      }
      throw err;
    }
  },

  updateById: (id, data) =>
    prisma.account.update({
      where: { id },
      data,
    }),

  count: () => prisma.account.count(),
};
