import prisma from '../prisma/client.js';

const txInclude = {
  ingredient: true,
  account: { select: { id: true, fullName: true } },
};

export const inventoryTransactionRepository = {
  findMany: (where = {}, take = 100) =>
    prisma.inventoryTransaction.findMany({
      where,
      include: txInclude,
      orderBy: { createdAt: 'desc' },
      take,
    }),

  findByIngredient: (ingredientId, take = 50) =>
    prisma.inventoryTransaction.findMany({
      where: { ingredientId },
      include: txInclude,
      orderBy: { createdAt: 'desc' },
      take,
    }),

  create: (data) =>
    prisma.inventoryTransaction.create({
      data,
      include: txInclude,
    }),
};
