import prisma from '../prisma/client.js';

export const ingredientRepository = {
  findMany: (where = {}, options = {}) => {
    const { includeInactive = false } = options;
    const finalWhere = includeInactive ? where : { ...where, available: true };
    return prisma.ingredient.findMany({ where: finalWhere, orderBy: { name: 'asc' } });
  },

  findById: (id) => prisma.ingredient.findUnique({ where: { id } }),

  create: (data) => prisma.ingredient.create({ data }),

  update: (id, data) => prisma.ingredient.update({ where: { id }, data }),

  softDelete: (id) =>
    prisma.ingredient.update({
      where: { id },
      data: { available: false, deletedAt: new Date() },
    }),

  hardDelete: (id) => prisma.ingredient.delete({ where: { id } }),

  async findReferences(id) {
    const [menuItemIngredients, transactionCount, alertCount, auditCount] = await Promise.all([
      prisma.menuItemIngredient.findMany({
        where: { ingredientId: id },
        include: { menuItem: { select: { id: true, name: true } } },
      }),
      prisma.inventoryTransaction.count({ where: { ingredientId: id } }),
      prisma.stockAlert.count({ where: { ingredientId: id } }),
      prisma.stockAudit.count({ where: { ingredientId: id } }),
    ]);

    return {
      menuRecipes: menuItemIngredients.map((r) => ({
        menuItemId: r.menuItem.id,
        menuItemName: r.menuItem.name,
        amount: Number(r.amount),
      })),
      inventoryTransactions: transactionCount,
      stockAlerts: alertCount,
      stockAudits: auditCount,
      hasReferences:
        menuItemIngredients.length > 0 ||
        transactionCount > 0 ||
        alertCount > 0 ||
        auditCount > 0,
    };
  },
};
