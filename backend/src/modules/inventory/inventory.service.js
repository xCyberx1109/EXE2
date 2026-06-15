import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { mapIngredient, mapInventoryTransaction } from '../../utils/mappers.js';
import { ingredientRepository } from '../../repositories/ingredient.repository.js';
import { inventoryTransactionRepository } from '../../repositories/inventoryTransaction.repository.js';

export const inventoryService = {
  async listIngredients({ search, lowStock, status }, user) {
    const where = {};
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      where.accountId = user.accountId || user.id;
    }

    const validStatuses = ['ACTIVE', 'INACTIVE'];
    const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : undefined;
    const effectiveStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : undefined;

    let items;
    if (effectiveStatus === 'ACTIVE') {
      items = await ingredientRepository.findMany(where);
    } else if (effectiveStatus === 'INACTIVE') {
      items = await ingredientRepository.findMany(where, { includeInactive: true });
      items = items.filter((i) => !i.available);
    } else {
      items = await ingredientRepository.findMany(where);
    }

    if (lowStock === 'true') {
      items = items.filter((i) => Number(i.quantity) <= Number(i.warningQuantity));
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.supplier.toLowerCase().includes(q)
      );
    }

    return items.map(mapIngredient);
  },

  async getIngredient(id, user) {
    const item = await ingredientRepository.findById(id);
    if (!item) throw new AppError('Không tìm thấy nguyên liệu', 404);
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && item.accountId !== accountId) {
        throw new AppError('Bạn không có quyền xem nguyên liệu này', 403);
      }
    }
    return mapIngredient(item);
  },

  async createIngredient(body, user) {
    const data = {
      name: body.name,
      unit: body.unit,
      quantity: body.quantity ?? 0,
      warningQuantity: body.warningQuantity ?? body.minQuantity ?? 0,
      price: body.price,
      supplier: body.supplier,
      lastUpdated: new Date(),
    };
    if (user) data.accountId = user.accountId || user.id;
    const item = await ingredientRepository.create(data);
    return mapIngredient(item);
  },

  async updateIngredient(id, body, user) {
    const existing = await ingredientRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy nguyên liệu', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với nguyên liệu này', 403);
      }
    }

    const item = await ingredientRepository.update(id, {
      ...body,
      lastUpdated: new Date(),
    });
    return mapIngredient(item);
  },

  async deleteIngredient(id, user) {
    const existing = await ingredientRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy nguyên liệu', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với nguyên liệu này', 403);
      }
    }

    await ingredientRepository.delete(id);
  },

  async getLowStock(user) {
    const where = {};
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      where.accountId = user.accountId || user.id;
    }
    const items = await ingredientRepository.findMany(where);
    return items
      .filter((i) => Number(i.quantity) <= Number(i.warningQuantity))
      .map(mapIngredient);
  },

  async getStats(user) {
    const where = {};
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      where.accountId = user.accountId || user.id;
    }
    const items = await ingredientRepository.findMany(where);
    const lowStockCount = items.filter(
      (i) => Number(i.quantity) <= Number(i.warningQuantity)
    ).length;
    const totalValue = items.reduce(
      (sum, i) => sum + Number(i.quantity) * Number(i.price),
      0
    );
    return {
      totalItems: items.length,
      lowStockCount,
      totalValue,
    };
  },

  /** Nhập kho */
  async stockIn(ingredientId, { quantity, note }, user) {
    return applyTransaction(ingredientId, 'IN', quantity, note, user);
  },

  /** Xuất kho */
  async stockOut(ingredientId, { quantity, note }, user) {
    return applyTransaction(ingredientId, 'OUT', quantity, note, user);
  },

  async getTransactionHistory(ingredientId, user) {
    const ingredient = await ingredientRepository.findById(ingredientId);
    if (!ingredient) throw new AppError('Không tìm thấy nguyên liệu', 404);
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && ingredient.accountId !== accountId) {
        throw new AppError('Bạn không có quyền xem lịch sử nguyên liệu này', 403);
      }
    }
    const txs = await inventoryTransactionRepository.findByIngredient(ingredientId);
    return txs.map(mapInventoryTransaction);
  },

  async listAllTransactions(user) {
    const where = {};
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      where.ingredient = { accountId: user.accountId || user.id };
    }
    const txs = await inventoryTransactionRepository.findMany(where);
    return txs.map(mapInventoryTransaction);
  },
};

async function applyTransaction(ingredientId, type, quantity, note, user) {
  const ingredient = await ingredientRepository.findById(ingredientId);
  if (!ingredient) throw new AppError('Không tìm thấy nguyên liệu', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && ingredient.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với nguyên liệu này', 403);
      }
    }

    const qty = Number(quantity);
  const current = Number(ingredient.quantity);

  if (type === 'OUT' && current < qty) {
    throw new AppError('Số lượng tồn kho không đủ để xuất', 400);
  }

  const newQty = type === 'IN' ? current + qty : current - qty;

  const txData = {
    ingredientId,
    accountId: ingredient.accountId,
    type,
    quantity: qty,
    beforeQuantity: current,
    afterQuantity: newQty,
    note,
    createdBy: user?.id || 'system',
  };
  console.log("[INVENTORY TRANSACTION CREATE]", JSON.stringify(txData, null, 2));

  const [updated, transaction] = await prisma.$transaction([
    prisma.ingredient.update({
      where: { id: ingredientId },
      data: { quantity: newQty, lastUpdated: new Date() },
    }),
    prisma.inventoryTransaction.create({
      data: txData,
      include: {
        ingredient: true,
        account: { select: { id: true, fullName: true } },
      },
    }),
  ]);

  return {
    ingredient: mapIngredient(updated),
    transaction: mapInventoryTransaction(transaction),
  };
}
