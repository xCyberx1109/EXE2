import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { mapIngredient, mapInventoryTransaction } from '../../utils/mappers.js';
import { ingredientRepository } from '../../repositories/ingredient.repository.js';
import { inventoryTransactionRepository } from '../../repositories/inventoryTransaction.repository.js';
import { assertBranchAccess, buildBranchWhere, branchDataForCreate } from '../../middlewares/branchScope.js';

const UNIT_MAP = {
  kg: 'KG', kilogram: 'KG', kilograms: 'KG',
  g: 'G', gram: 'G', grams: 'G',
  lít: 'LITER', lit: 'LITER', liter: 'LITER', liters: 'LITER',
  ml: 'ML', milliliter: 'ML', milliliters: 'ML',
  chiếc: 'PIECE', cái: 'PIECE', c: 'PIECE', piece: 'PIECE', pieces: 'PIECE',
  gói: 'UNIT', unit: 'UNIT', units: 'UNIT', pack: 'UNIT',
};

function normalizeUnit(unit) {
  if (!unit) return unit;
  return UNIT_MAP[unit.toLowerCase().trim()] || unit;
}

export const inventoryService = {
  async listIngredients({ search, lowStock, status }, user) {
    const where = buildBranchWhere(user);
    let items = await ingredientRepository.findMany(where);

    if (lowStock === 'true') {
      items = items.filter((i) => Number(i.quantity) <= Number(i.warningQuantity));
    }

    if (status === 'LOW_STOCK') {
      items = items.filter((i) => Number(i.quantity) <= Number(i.warningQuantity));
    } else if (status === 'NORMAL') {
      items = items.filter((i) => Number(i.quantity) > Number(i.warningQuantity));
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
    assertBranchAccess(item, user, 'nguyên liệu');
    return mapIngredient(item);
  },

  async createIngredient(body, user) {
    const data = {
      name: body.name,
      unit: normalizeUnit(body.unit),
      quantity: body.quantity ?? 0,
      warningQuantity: body.warningQuantity ?? 0,
      price: body.price,
      supplier: body.supplier,
      lastUpdated: new Date(),
      ...branchDataForCreate(user),
    };
    const item = await ingredientRepository.create(data);
    if (Number(data.quantity) <= Number(data.warningQuantity)) {
      await createStockAlert(item, user);
    }
    return mapIngredient(item);
  },

  async updateIngredient(id, body, user) {
    const existing = await ingredientRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy nguyên liệu', 404);
    assertBranchAccess(existing, user, 'nguyên liệu');

    const data = {
      name: body.name ?? existing.name,
      unit: body.unit ? normalizeUnit(body.unit) : existing.unit,
      quantity: body.quantity !== undefined ? Number(body.quantity) : existing.quantity,
      warningQuantity: body.warningQuantity !== undefined ? Number(body.warningQuantity) : existing.warningQuantity,
      price: body.price !== undefined ? Number(body.price) : existing.price,
      supplier: body.supplier ?? existing.supplier,
      lastUpdated: new Date(),
    };
    const item = await ingredientRepository.update(id, data);
    const newQty = Number(item.quantity);
    const warnQty = Number(item.warningQuantity);
    if (newQty <= warnQty) {
      await createStockAlert(item, user);
    }
    return mapIngredient(item);
  },

  async deleteIngredient(id, user) {
    const existing = await ingredientRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy nguyên liệu', 404);
    assertBranchAccess(existing, user, 'nguyên liệu');

    await ingredientRepository.delete(id);
  },

  async getLowStock(user) {
    const where = buildBranchWhere(user);
    const items = await ingredientRepository.findMany(where);
    return items
      .filter((i) => Number(i.quantity) <= Number(i.warningQuantity))
      .map(mapIngredient);
  },

  async getStats(user) {
    const where = buildBranchWhere(user);
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
    assertBranchAccess(ingredient, user, 'nguyên liệu');
    const txs = await inventoryTransactionRepository.findByIngredient(ingredientId);
    return txs.map(mapInventoryTransaction);
  },

  async listAllTransactions(user) {
    const branchWhere = buildBranchWhere(user);
    const where = branchWhere.branchId ? { ingredient: { branchId: branchWhere.branchId } } : {};
    const txs = await inventoryTransactionRepository.findMany(where);
    return txs.map(mapInventoryTransaction);
  },
};

async function applyTransaction(ingredientId, type, quantity, note, user) {
  const ingredient = await ingredientRepository.findById(ingredientId);
  if (!ingredient) throw new AppError('Không tìm thấy nguyên liệu', 404);
  assertBranchAccess(ingredient, user, 'nguyên liệu');

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
    inventoryTransactionRepository.create({
      ingredientId,
      branchId: ingredient.branchId,
      type,
      quantity: qty,
      beforeQuantity: current,
      afterQuantity: newQty,
      note,
      createdBy: user?.id || 'system',
    }),
  ]);

  if (newQty <= Number(ingredient.warningQuantity)) {
    await createStockAlert(updated, user);
  }

  return {
    ingredient: mapIngredient(updated),
    transaction: mapInventoryTransaction(transaction),
  };
}

async function createStockAlert(ingredient, user) {
  const qty = Number(ingredient.quantity);
  const threshold = Number(ingredient.warningQuantity);
  if (threshold <= 0 || qty > threshold) return;

  const existing = await prisma.stockAlert.findFirst({
    where: {
      ingredientId: ingredient.id,
      isResolved: false,
    },
  });
  if (existing) return;

  await prisma.stockAlert.create({
    data: {
      ingredientId: ingredient.id,
      branchId: ingredient.branchId,
      alertType: 'LOW_STOCK',
      threshold,
      message: `Nguyên liệu ${ingredient.name} đã xuống dưới ngưỡng cảnh báo. (Tồn: ${qty}, Ngưỡng: ${threshold})`,
    },
  });
}
