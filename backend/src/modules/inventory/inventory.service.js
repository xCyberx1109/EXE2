import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { parsePagination, paginatedResponse } from '../../utils/pagination.js';
import { mapIngredient, mapInventoryTransaction } from '../../utils/mappers.js';
import { ingredientRepository } from '../../repositories/ingredient.repository.js';
import { inventoryTransactionRepository } from '../../repositories/inventoryTransaction.repository.js';
import { logAction } from '../../utils/auditLogger.js';
import { STOCK_IN_TYPES, STOCK_OUT_TYPES, REASON_REQUIRED_TYPES } from '../../validators/inventory.validator.js';

function normalizeTransactionType(type, fallback, allowedTypes) {
  const normalized = typeof type === 'string' && type.trim() ? type.trim().toUpperCase() : fallback;
  return allowedTypes.includes(normalized) ? normalized : fallback;
}

export const inventoryService = {
  async listIngredients({ search, lowStock, status, page, limit }, user) {
    const where = {};
    if (user) {
      where.accountId = user.accountId || user.id;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
      ];
    }

    // lowStock filter requires comparison across columns, fetch all then filter
    if (lowStock === 'true') {
      const all = await ingredientRepository.findMany(where);
      let filtered = all.filter((i) => Number(i.quantity) <= Number(i.warningQuantity));
      const total = filtered.length;
      if (page && limit) {
        const { page: p, limit: l } = parsePagination({ page, limit });
        const start = (p - 1) * l;
        filtered = filtered.slice(start, start + l);
        return paginatedResponse(filtered.map(mapIngredient), total, { page: p, limit: l });
      }
      return filtered.map(mapIngredient);
    }

    const validStatuses = ['ACTIVE', 'INACTIVE'];
    const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : undefined;
    const effectiveStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : undefined;

    if (page && limit) {
      const { page: p, limit: l } = parsePagination({ page, limit });
      let options = { page: p, limit: l };
      if (effectiveStatus === 'INACTIVE') {
        options.includeInactive = true;
      }
      const [items, total] = await ingredientRepository.findMany(where, options);
      if (effectiveStatus === 'INACTIVE') {
        const filtered = items.filter((i) => !i.available);
        return paginatedResponse(filtered.map(mapIngredient), total, { page: p, limit: l });
      }
      return paginatedResponse(items.map(mapIngredient), total, { page: p, limit: l });
    }

    let items;
    if (effectiveStatus === 'ACTIVE') {
      items = await ingredientRepository.findMany(where);
    } else if (effectiveStatus === 'INACTIVE') {
      items = await ingredientRepository.findMany(where, { includeInactive: true });
      items = items.filter((i) => !i.available);
    } else {
      items = await ingredientRepository.findMany(where);
    }

    return items.map(mapIngredient);
  },

  async getIngredient(id, user) {
    const item = await ingredientRepository.findById(id);
    if (!item) throw new AppError('Không tìm thấy nguyên liệu', 404);
    if (user) {
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

    logAction({
      accountId: data.accountId,
      employeeId: user?.employeeId,
      action: 'INVENTORY_CREATED',
      module: 'INVENTORY',
      details: { ingredientId: item.id, name: item.name, unit: item.unit, quantity: Number(item.quantity) },
    });

    return mapIngredient(item);
  },

  async updateIngredient(id, body, user) {
    const existing = await ingredientRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy nguyên liệu', 404);

    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với nguyên liệu này', 403);
      }
    }

    // `note` không phải field của Ingredient — chỉ dùng để ghi lý do điều chỉnh tồn kho (nếu có).
    const { note, ...updateFields } = body;

    const beforeQuantity = Number(existing.quantity);
    const hasQuantityChange =
      updateFields.quantity !== undefined &&
      updateFields.quantity !== null &&
      updateFields.quantity !== '' &&
      Number(updateFields.quantity) !== beforeQuantity;

    if (hasQuantityChange && user) {
      const permissions = user.permissions || [];
      if (!permissions.includes('INVENTORY_ADJUST')) {
        throw new AppError('Bạn cần quyền Điều chỉnh tồn kho (INVENTORY_ADJUST) để thay đổi số lượng', 403);
      }
    }

    const afterQuantity = hasQuantityChange ? Number(updateFields.quantity) : beforeQuantity;

    const operations = [
      prisma.ingredient.update({
        where: { id },
        data: { ...updateFields, lastUpdated: new Date() },
      }),
    ];

    if (hasQuantityChange) {
      operations.push(
        prisma.inventoryTransaction.create({
          data: {
            ingredientId: id,
            accountId: existing.accountId,
            type: 'ADJUST',
            quantity: Math.abs(afterQuantity - beforeQuantity),
            beforeQuantity,
            afterQuantity,
            note: note || null,
            createdBy: user?.id || 'system',
          },
        })
      );
    }

    const [item] = await prisma.$transaction(operations);

    logAction({
      accountId: item.accountId,
      employeeId: user?.employeeId,
      action: 'INVENTORY_UPDATED',
      module: 'INVENTORY',
      details: {
        ingredientId: item.id,
        name: item.name,
        changes: Object.keys(updateFields),
        quantityAdjusted: hasQuantityChange,
        beforeQuantity: hasQuantityChange ? beforeQuantity : undefined,
        afterQuantity: hasQuantityChange ? afterQuantity : undefined,
      },
    });

    return mapIngredient(item);
  },

  async deleteIngredient(id, user) {
    const existing = await ingredientRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy nguyên liệu', 404);

    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với nguyên liệu này', 403);
      }
    }

    await ingredientRepository.delete(id);

    logAction({
      accountId: existing.accountId,
      employeeId: user?.employeeId,
      action: 'INVENTORY_DELETED',
      module: 'INVENTORY',
      details: { ingredientId: existing.id, name: existing.name },
    });
  },

  async getLowStock(user) {
    const where = {};
    if (user) {
      where.accountId = user.accountId || user.id;
    }
    const items = await ingredientRepository.findMany(where);
    return items
      .filter((i) => Number(i.quantity) <= Number(i.warningQuantity))
      .map(mapIngredient);
  },

  async getStats(user) {
    const where = {};
    if (user) {
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
  async stockIn(ingredientId, { quantity, note, type }, user) {
    const txType = normalizeTransactionType(type, 'IMPORT', STOCK_IN_TYPES);
    return applyTransaction(ingredientId, 'IN', txType, quantity, note, user);
  },

  /** Xuất kho */
  async stockOut(ingredientId, { quantity, note, type }, user) {
    const txType = normalizeTransactionType(type, 'OUT', STOCK_OUT_TYPES);
    return applyTransaction(ingredientId, 'OUT', txType, quantity, note, user);
  },

  async getTransactionHistory(ingredientId, user) {
    const ingredient = await ingredientRepository.findById(ingredientId);
    if (!ingredient) throw new AppError('Không tìm thấy nguyên liệu', 404);
    if (user) {
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
    if (user) {
      where.ingredient = { accountId: user.accountId || user.id };
    }
    const txs = await inventoryTransactionRepository.findMany(where);
    return txs.map(mapInventoryTransaction);
  },
};

/**
 * @param {'IN'|'OUT'} direction - chiều tăng/giảm số lượng (không được lưu xuống DB).
 * @param {string} type - giá trị enum InventoryTransactionType thực sự lưu xuống DB
 *   (IMPORT/OUT/ADJUST/RETURN/WASTE). Tách riêng khỏi `direction` vì trước đây code
 *   lưu thẳng 'IN' xuống cột `type`, nhưng enum không có giá trị 'IN' -> Prisma throw lỗi
 *   mỗi lần gọi stock-in. Xem STOCK_IN_TYPES/STOCK_OUT_TYPES trong inventory.validator.js.
 */
async function applyTransaction(ingredientId, direction, type, quantity, note, user) {
  const ingredient = await ingredientRepository.findById(ingredientId);
  if (!ingredient) throw new AppError('Không tìm thấy nguyên liệu', 404);

  if (user) {
    const accountId = user.accountId || user.id;
    if (accountId && ingredient.accountId !== accountId) {
      throw new AppError('Bạn không có quyền thao tác với nguyên liệu này', 403);
    }
  }

  if (REASON_REQUIRED_TYPES.includes(type) && !note) {
    throw new AppError('Vui lòng nhập lý do cho loại giao dịch này (hao hụt/điều chỉnh)', 400);
  }

  const qty = Number(quantity);
  const current = Number(ingredient.quantity);

  if (direction === 'OUT' && current < qty) {
    throw new AppError('Số lượng tồn kho không đủ để xuất', 400);
  }

  const newQty = direction === 'IN' ? current + qty : current - qty;

  const txData = {
    ingredientId,
    accountId: ingredient.accountId,
    type,
    quantity: qty,
    beforeQuantity: current,
    afterQuantity: newQty,
    note: note || null,
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

  logAction({
    accountId: ingredient.accountId,
    employeeId: user?.employeeId,
    action: direction === 'IN' ? 'INVENTORY_STOCK_IN' : 'INVENTORY_STOCK_OUT',
    module: 'INVENTORY',
    details: { ingredientId: ingredient.id, name: ingredient.name, type, quantity: qty, beforeQuantity: current, afterQuantity: newQty, note },
  });

  return {
    ingredient: mapIngredient(updated),
    transaction: mapInventoryTransaction(transaction),
  };
}
