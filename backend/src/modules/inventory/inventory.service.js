import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { mapIngredient, mapInventoryTransaction } from '../../utils/mappers.js';
import { ingredientRepository } from '../../repositories/ingredient.repository.js';
import { inventoryTransactionRepository } from '../../repositories/inventoryTransaction.repository.js';

export const inventoryService = {
  async listIngredients({ search, lowStock }) {
    let items = await ingredientRepository.findMany();

    if (lowStock === 'true') {
      items = items.filter((i) => Number(i.quantity) < Number(i.minQuantity));
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

  async getIngredient(id) {
    const item = await ingredientRepository.findById(id);
    if (!item) throw new AppError('Không tìm thấy nguyên liệu', 404);
    return mapIngredient(item);
  },

  async createIngredient(body) {
    const item = await ingredientRepository.create({
      name: body.name,
      unit: body.unit,
      quantity: body.quantity ?? 0,
      minQuantity: body.minQuantity,
      price: body.price,
      supplier: body.supplier,
      lastUpdated: new Date(),
    });
    return mapIngredient(item);
  },

  async updateIngredient(id, body) {
    const existing = await ingredientRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy nguyên liệu', 404);

    const item = await ingredientRepository.update(id, {
      ...body,
      lastUpdated: new Date(),
    });
    return mapIngredient(item);
  },

  async deleteIngredient(id) {
    await ingredientRepository.delete(id);
  },

  async getLowStock() {
    const items = await ingredientRepository.findMany();
    return items
      .filter((i) => Number(i.quantity) < Number(i.minQuantity))
      .map(mapIngredient);
  },

  async getStats() {
    const items = await ingredientRepository.findMany();
    const lowStockCount = items.filter(
      (i) => Number(i.quantity) < Number(i.minQuantity)
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
  async stockIn(ingredientId, { quantity, note }, userId) {
    return applyTransaction(ingredientId, 'IN', quantity, note, userId);
  },

  /** Xuất kho */
  async stockOut(ingredientId, { quantity, note }, userId) {
    return applyTransaction(ingredientId, 'OUT', quantity, note, userId);
  },

  async getTransactionHistory(ingredientId) {
    const txs = await inventoryTransactionRepository.findByIngredient(ingredientId);
    return txs.map(mapInventoryTransaction);
  },

  async listAllTransactions() {
    const txs = await inventoryTransactionRepository.findMany();
    return txs.map(mapInventoryTransaction);
  },
};

async function applyTransaction(ingredientId, type, quantity, note, userId) {
  const ingredient = await ingredientRepository.findById(ingredientId);
  if (!ingredient) throw new AppError('Không tìm thấy nguyên liệu', 404);

  const qty = Number(quantity);
  const current = Number(ingredient.quantity);

  if (type === 'OUT' && current < qty) {
    throw new AppError('Số lượng tồn kho không đủ để xuất', 400);
  }

  const newQty = type === 'IN' ? current + qty : current - qty;

  const [updated, transaction] = await prisma.$transaction([
    prisma.ingredient.update({
      where: { id: ingredientId },
      data: { quantity: newQty, lastUpdated: new Date() },
    }),
    prisma.inventoryTransaction.create({
      data: {
        ingredientId,
        type,
        quantity: qty,
        note,
        userId: userId || null,
      },
      include: {
        ingredient: true,
        user: { select: { id: true, fullName: true } },
      },
    }),
  ]);

  return {
    ingredient: mapIngredient(updated),
    transaction: mapInventoryTransaction(transaction),
  };
}
