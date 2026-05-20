import prisma from '../prisma/client.js';

export const inventoryTransactionRepository = {
  findMany: (where = {}, take = 100) =>
    prisma.inventoryTransaction.findMany({
      where,
      include: { ingredient: true, user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    }),

  findByIngredient: (ingredientId, take = 50) =>
    prisma.inventoryTransaction.findMany({
      where: { ingredientId },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    }),

  create: (data) =>
    prisma.inventoryTransaction.create({
      data,
      include: { ingredient: true, user: { select: { id: true, fullName: true } } },
    }),
};
