import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { parsePagination, paginatedResponse } from '../../utils/pagination.js';
import { mapIngredient, mapInventoryTransaction, mapAdjustmentRequest, mapIngredientBatch } from '../../utils/mappers.js';
import { ingredientRepository } from '../../repositories/ingredient.repository.js';
import { inventoryTransactionRepository } from '../../repositories/inventoryTransaction.repository.js';
import { logAction } from '../../utils/auditLogger.js';
import { STOCK_IN_TYPES, STOCK_OUT_TYPES, REASON_REQUIRED_TYPES } from '../../validators/inventory.validator.js';
import { consumeIngredientBatchesFEFO, createIngredientBatch } from '../../utils/inventoryBatches.js';

const DEFAULT_APPROVAL_THRESHOLD = 500000;
const ADJUSTMENT_REQUEST_INCLUDE = {
  ingredient: true,
  account: { select: { id: true, fullName: true } },
  reviewer: { select: { id: true, fullName: true } },
};

// Mac dinh 30 ngay gan nhat neu khong truyen from/to, dung chung cho cac bao cao.
function resolveDateRange(from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  // Bao gom tron ngay "to" (het ngay 23:59:59) neu chi truyen ngay khong kem gio.
  if (to && !to.includes('T')) {
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

function normalizeTransactionType(type, fallback, allowedTypes) {
  const normalized = typeof type === 'string' && type.trim() ? type.trim().toUpperCase() : fallback;
  return allowedTypes.includes(normalized) ? normalized : fallback;
}

async function getApprovalThreshold(accountId) {
  if (!accountId) return DEFAULT_APPROVAL_THRESHOLD;
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { inventoryApprovalThreshold: true },
  });
  return account ? Number(account.inventoryApprovalThreshold) : DEFAULT_APPROVAL_THRESHOLD;
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

    // Frontend (form sửa hàng hóa) giờ đã có ô nhập lý do, nên không còn lý do gì để cho phép
    // đổi số lượng mà không giải trình — bắt buộc note giống như stock-in/out với WASTE/ADJUST.
    if (hasQuantityChange && !note) {
      throw new AppError('Vui lòng nhập lý do khi thay đổi số lượng tồn kho', 400);
    }

    const afterQuantity = hasQuantityChange ? Number(updateFields.quantity) : beforeQuantity;

    // Nếu số lượng thay đổi vượt ngưỡng giá trị, KHÔNG áp dụng ngay — tạo yêu cầu chờ
    // quản lý duyệt. Các field khác (tên, giá, NCC...) trong cùng request vẫn được lưu bình
    // thường, chỉ riêng quantity bị giữ nguyên cho tới khi được duyệt.
    let pendingRequest = null;
    if (hasQuantityChange) {
      const changeAmount = Math.abs(afterQuantity - beforeQuantity);
      const estimatedValue = changeAmount * Number(existing.price);
      const threshold = await getApprovalThreshold(existing.accountId);
      if (estimatedValue >= threshold) {
        const created = await prisma.inventoryAdjustmentRequest.create({
          data: {
            ingredientId: id,
            accountId: existing.accountId,
            type: 'ADJUST',
            quantity: changeAmount,
            beforeQuantity,
            afterQuantity,
            estimatedValue,
            note,
            requestedBy: user?.id || 'system',
          },
          include: ADJUSTMENT_REQUEST_INCLUDE,
        });
        pendingRequest = mapAdjustmentRequest(created);
      }
    }

    const fieldsToApplyNow = pendingRequest
      ? Object.fromEntries(Object.entries(updateFields).filter(([key]) => key !== 'quantity'))
      : updateFields;

    const applyQuantityChange = hasQuantityChange && !pendingRequest;

    const item = await prisma.$transaction(async (tx) => {
      const updatedIngredient = await tx.ingredient.update({
        where: { id },
        data: { ...fieldsToApplyNow, lastUpdated: new Date() },
      });

      if (applyQuantityChange) {
        await tx.inventoryTransaction.create({
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
        });

        if (afterQuantity > beforeQuantity) {
          await createIngredientBatch(tx, {
            accountId: existing.accountId,
            ingredientId: id,
            quantity: afterQuantity - beforeQuantity,
            unitCost: Number(existing.price),
            createdBy: user?.id || 'system',
            note,
          });
        } else {
          await consumeIngredientBatchesFEFO(tx, id, beforeQuantity - afterQuantity);
        }
      }

      return updatedIngredient;
    });

    logAction({
      accountId: item.accountId,
      employeeId: user?.employeeId,
      action: pendingRequest ? 'INVENTORY_ADJUSTMENT_REQUESTED' : 'INVENTORY_UPDATED',
      module: 'INVENTORY',
      details: {
        ingredientId: item.id,
        name: item.name,
        changes: Object.keys(fieldsToApplyNow),
        quantityAdjusted: hasQuantityChange && !pendingRequest,
        pendingApproval: !!pendingRequest,
        beforeQuantity: hasQuantityChange ? beforeQuantity : undefined,
        afterQuantity: hasQuantityChange ? afterQuantity : undefined,
      },
    });

    if (pendingRequest) {
      return { ingredient: mapIngredient(item), pending: true, request: pendingRequest };
    }
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
  async stockIn(ingredientId, { quantity, note, type, expiryDate, batchCode, unitCost }, user) {
    const txType = normalizeTransactionType(type, 'IMPORT', STOCK_IN_TYPES);
    return applyTransaction(ingredientId, 'IN', txType, quantity, note, user, { expiryDate, batchCode, unitCost });
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

  /** Ngưỡng giá trị (VND) từ đó WASTE/ADJUST phải chờ phê duyệt */
  async getThresholdSetting(user) {
    const accountId = user?.accountId || user?.id;
    return { threshold: await getApprovalThreshold(accountId) };
  },

  async updateThresholdSetting(threshold, user) {
    const accountId = user?.accountId || user?.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);
    const value = Number(threshold);
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError('Ngưỡng phê duyệt phải là số >= 0', 400);
    }
    await prisma.account.update({ where: { id: accountId }, data: { inventoryApprovalThreshold: value } });
    return { threshold: value };
  },

  async listAdjustmentRequests({ status } = {}, user) {
    const where = {};
    if (user) where.accountId = user.accountId || user.id;
    if (status) where.status = status;
    const rows = await prisma.inventoryAdjustmentRequest.findMany({
      where,
      include: ADJUSTMENT_REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapAdjustmentRequest);
  },

  async approveAdjustmentRequest(id, user) {
    const request = await prisma.inventoryAdjustmentRequest.findUnique({ where: { id } });
    if (!request) throw new AppError('Không tìm thấy yêu cầu', 404);

    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && request.accountId !== accountId) {
        throw new AppError('Bạn không có quyền xử lý yêu cầu này', 403);
      }
    }
    if (request.status !== 'PENDING') {
      throw new AppError('Yêu cầu này đã được xử lý trước đó', 400);
    }

    const ingredient = await ingredientRepository.findById(request.ingredientId);
    if (!ingredient) throw new AppError('Nguyên liệu không còn tồn tại', 404);

    // Dùng số lượng tồn kho HIỆN TẠI (không dùng snapshot lúc gửi yêu cầu) vì có thể đã
    // có giao dịch khác xảy ra trong lúc chờ duyệt — tránh ghi đè sai lệch.
    const isIncrease = Number(request.afterQuantity) > Number(request.beforeQuantity);
    const currentQty = Number(ingredient.quantity);
    const changeAmount = Number(request.quantity);
    const newQty = isIncrease ? currentQty + changeAmount : currentQty - changeAmount;

    if (!isIncrease && newQty < 0) {
      throw new AppError(
        'Số lượng tồn kho hiện tại không đủ để duyệt yêu cầu này (tồn kho đã thay đổi kể từ lúc gửi yêu cầu)',
        400
      );
    }

    const { updatedIngredient, transaction, updatedRequest } = await prisma.$transaction(async (tx) => {
      const ingredientAfter = await tx.ingredient.update({
        where: { id: ingredient.id },
        data: { quantity: newQty, lastUpdated: new Date() },
      });
      const createdTransaction = await tx.inventoryTransaction.create({
        data: {
          ingredientId: ingredient.id,
          accountId: ingredient.accountId,
          type: request.type,
          quantity: changeAmount,
          beforeQuantity: currentQty,
          afterQuantity: newQty,
          note: request.note,
          createdBy: request.requestedBy,
          referenceType: 'ADJUSTMENT_REQUEST',
          referenceId: request.id,
        },
        include: { ingredient: true, account: { select: { id: true, fullName: true } } },
      });
      const approvedRequest = await tx.inventoryAdjustmentRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedBy: user?.id || 'system', reviewedAt: new Date() },
        include: ADJUSTMENT_REQUEST_INCLUDE,
      });

      if (isIncrease) {
        await createIngredientBatch(tx, {
          accountId: ingredient.accountId,
          ingredientId: ingredient.id,
          quantity: changeAmount,
          unitCost: Number(ingredient.price),
          createdBy: request.requestedBy,
          note: request.note,
        });
      } else {
        await consumeIngredientBatchesFEFO(tx, ingredient.id, changeAmount);
      }

      return { updatedIngredient: ingredientAfter, transaction: createdTransaction, updatedRequest: approvedRequest };
    });

    logAction({
      accountId: ingredient.accountId,
      employeeId: user?.employeeId,
      action: 'INVENTORY_ADJUSTMENT_APPROVED',
      module: 'INVENTORY',
      details: { requestId: id, ingredientId: ingredient.id, quantity: changeAmount, beforeQuantity: currentQty, afterQuantity: newQty },
    });

    return {
      ingredient: mapIngredient(updatedIngredient),
      transaction: mapInventoryTransaction(transaction),
      request: mapAdjustmentRequest(updatedRequest),
    };
  },

  async rejectAdjustmentRequest(id, reason, user) {
    const request = await prisma.inventoryAdjustmentRequest.findUnique({ where: { id } });
    if (!request) throw new AppError('Không tìm thấy yêu cầu', 404);

    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && request.accountId !== accountId) {
        throw new AppError('Bạn không có quyền xử lý yêu cầu này', 403);
      }
    }
    if (request.status !== 'PENDING') {
      throw new AppError('Yêu cầu này đã được xử lý trước đó', 400);
    }
    if (!reason || !reason.trim()) {
      throw new AppError('Vui lòng nhập lý do từ chối', 400);
    }

    const updated = await prisma.inventoryAdjustmentRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: user?.id || 'system',
        reviewedAt: new Date(),
        rejectionReason: reason.trim(),
      },
      include: ADJUSTMENT_REQUEST_INCLUDE,
    });

    logAction({
      accountId: request.accountId,
      employeeId: user?.employeeId,
      action: 'INVENTORY_ADJUSTMENT_REJECTED',
      module: 'INVENTORY',
      details: { requestId: id, ingredientId: request.ingredientId, rejectionReason: reason.trim() },
    });

    return mapAdjustmentRequest(updated);
  },

  async listBatchesForIngredient(ingredientId, user) {
    const ingredient = await ingredientRepository.findById(ingredientId);
    if (!ingredient) throw new AppError('Không tìm thấy nguyên liệu', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && ingredient.accountId !== accountId) {
        throw new AppError('Bạn không có quyền xem lô hàng của nguyên liệu này', 403);
      }
    }
    const batches = await prisma.ingredientBatch.findMany({
      where: { ingredientId },
      include: { ingredient: true, creator: { select: { id: true, fullName: true } } },
      orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
    });
    return batches.map(mapIngredientBatch);
  },

  /** Các lô ACTIVE sắp hết hạn trong vòng `days` ngày tới, dùng cho cảnh báo. */
  async listExpiringBatches(days, user) {
    const daysAhead = Number(days) > 0 ? Number(days) : 7;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysAhead);

    const where = {
      status: 'ACTIVE',
      quantity: { gt: 0 },
      expiryDate: { not: null, lte: threshold },
    };
    if (user) {
      where.accountId = user.accountId || user.id;
    }

    const batches = await prisma.ingredientBatch.findMany({
      where,
      include: { ingredient: true, creator: { select: { id: true, fullName: true } } },
      orderBy: { expiryDate: 'asc' },
    });
    return batches.map(mapIngredientBatch);
  },

  /**
   * Báo cáo hao hụt (WASTE) theo khoảng thời gian — tổng giá trị, top nguyên liệu hao hụt nhiều
   * nhất. Giá trị ước tính dùng đơn giá HIỆN TẠI của nguyên liệu (không có lịch sử giá theo lô
   * cho từng giao dịch cụ thể) — cùng cách tính đã dùng cho ngưỡng phê duyệt, chấp nhận sai số nhỏ.
   */
  async getWasteReport({ from, to } = {}, user) {
    const { start, end } = resolveDateRange(from, to);
    const where = {
      type: 'WASTE',
      createdAt: { gte: start, lte: end },
    };
    if (user) {
      where.ingredient = { accountId: user.accountId || user.id };
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: { ingredient: true },
    });

    const byIngredientMap = new Map();
    let totalValue = 0;
    let totalQuantity = 0;

    for (const tx of transactions) {
      const qty = Number(tx.quantity);
      const price = Number(tx.ingredient?.price ?? 0);
      const value = qty * price;
      totalValue += value;
      totalQuantity += qty;

      const key = tx.ingredientId;
      const existing = byIngredientMap.get(key) || {
        ingredientId: key,
        ingredientName: tx.ingredient?.name ?? 'Không rõ',
        ingredientUnit: tx.ingredient?.unit,
        totalQuantity: 0,
        totalValue: 0,
        transactionCount: 0,
      };
      existing.totalQuantity += qty;
      existing.totalValue += value;
      existing.transactionCount += 1;
      byIngredientMap.set(key, existing);
    }

    const byIngredient = Array.from(byIngredientMap.values()).sort((a, b) => b.totalValue - a.totalValue);

    return {
      from: start,
      to: end,
      totalValue,
      totalQuantity,
      transactionCount: transactions.length,
      byIngredient,
    };
  },

  /**
   * Food cost % thực tế (giá vốn nguyên liệu thực sự tiêu thụ, tính theo đơn giá hiện tại) so với
   * định mức (giá vốn công thức đã lưu tại thời điểm bán trong Order.cost) trên cùng doanh thu.
   * Chênh lệch dương -> đang dùng nguyên liệu nhiều hơn công thức quy định (hao hụt/lãng phí ẩn).
   */
  async getFoodCostReport({ from, to } = {}, user) {
    const { start, end } = resolveDateRange(from, to);
    const accountId = user?.accountId || user?.id;

    const orderWhere = {
      paymentStatus: 'PAID',
      createdAt: { gte: start, lte: end },
    };
    if (accountId) orderWhere.accountId = accountId;

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: { total: true, cost: true },
    });
    const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const standardCost = orders.reduce((sum, o) => sum + Number(o.cost), 0);

    const txWhere = {
      type: { in: ['OUT', 'SALE'] },
      referenceType: 'ORDER',
      createdAt: { gte: start, lte: end },
    };
    if (accountId) txWhere.ingredient = { accountId };

    const transactions = await prisma.inventoryTransaction.findMany({
      where: txWhere,
      include: { ingredient: true },
    });
    const actualCost = transactions.reduce(
      (sum, tx) => sum + Number(tx.quantity) * Number(tx.ingredient?.price ?? 0),
      0
    );

    const standardCostPercent = revenue > 0 ? (standardCost / revenue) * 100 : 0;
    const actualCostPercent = revenue > 0 ? (actualCost / revenue) * 100 : 0;

    return {
      from: start,
      to: end,
      revenue,
      standardCost,
      actualCost,
      standardCostPercent,
      actualCostPercent,
      variancePercent: actualCostPercent - standardCostPercent,
      orderCount: orders.length,
    };
  },
};

/**
 * @param {'IN'|'OUT'} direction - chiều tăng/giảm số lượng (không được lưu xuống DB).
 * @param {string} type - giá trị enum InventoryTransactionType thực sự lưu xuống DB
 *   (IMPORT/OUT/ADJUST/RETURN/WASTE). Tách riêng khỏi `direction` vì trước đây code
 *   lưu thẳng 'IN' xuống cột `type`, nhưng enum không có giá trị 'IN' -> Prisma throw lỗi
 *   mỗi lần gọi stock-in. Xem STOCK_IN_TYPES/STOCK_OUT_TYPES trong inventory.validator.js.
 */
async function applyTransaction(ingredientId, direction, type, quantity, note, user, batchOptions = {}) {
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

  // WASTE/ADJUST vượt ngưỡng giá trị -> tạo yêu cầu chờ duyệt, KHÔNG trừ/cộng kho ngay.
  if (REASON_REQUIRED_TYPES.includes(type)) {
    const estimatedValue = qty * Number(ingredient.price);
    const threshold = await getApprovalThreshold(ingredient.accountId);
    if (estimatedValue >= threshold) {
      const created = await prisma.inventoryAdjustmentRequest.create({
        data: {
          ingredientId,
          accountId: ingredient.accountId,
          type,
          quantity: qty,
          beforeQuantity: current,
          afterQuantity: newQty,
          estimatedValue,
          note,
          requestedBy: user?.id || 'system',
        },
        include: ADJUSTMENT_REQUEST_INCLUDE,
      });

      logAction({
        accountId: ingredient.accountId,
        employeeId: user?.employeeId,
        action: 'INVENTORY_ADJUSTMENT_REQUESTED',
        module: 'INVENTORY',
        details: { ingredientId: ingredient.id, name: ingredient.name, type, quantity: qty, estimatedValue, threshold, note },
      });

      return { pending: true, request: mapAdjustmentRequest(created) };
    }
  }

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

  const { updated, transaction } = await prisma.$transaction(async (tx) => {
    const updatedIngredient = await tx.ingredient.update({
      where: { id: ingredientId },
      data: { quantity: newQty, lastUpdated: new Date() },
    });
    const createdTransaction = await tx.inventoryTransaction.create({
      data: txData,
      include: {
        ingredient: true,
        account: { select: { id: true, fullName: true } },
      },
    });

    if (direction === 'IN') {
      await createIngredientBatch(tx, {
        accountId: ingredient.accountId,
        ingredientId,
        quantity: qty,
        unitCost: batchOptions.unitCost ?? Number(ingredient.price),
        expiryDate: batchOptions.expiryDate,
        batchCode: batchOptions.batchCode,
        createdBy: user?.id || 'system',
        note,
      });
    } else {
      await consumeIngredientBatchesFEFO(tx, ingredientId, qty);
    }

    return { updated: updatedIngredient, transaction: createdTransaction };
  });

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
