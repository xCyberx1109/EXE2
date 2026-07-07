import { Prisma } from '@prisma/client';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { parsePagination, paginatedResponse } from '../../utils/pagination.js';
import { mapPosOrder, mapOrderDetail } from '../../utils/mappers.js';
import { orderRepository } from '../../repositories/order.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { logAction } from '../../utils/auditLogger.js';
import { mapConcurrent } from '../../utils/concurrency.js';
import { validateInventoryForOrder, releaseReservationsForOrder, reserveInventoryForOrderTx } from '../../utils/inventoryOperations.js';

// Phai khop voi `includeItems` trong order.repository.js (khong export) - dung khi tao/sua don
// qua tx truc tiep (khong qua repository) de giu cho ton kho trong cung 1 transaction.
const ORDER_ITEMS_INCLUDE = {
  items: {
    include: {
      menuItem: true,
    },
  },
};

/**
 * Chup lai cong thuc hien tai cua 1 menu item de luu vao OrderItem.recipeSnapshot.
 * Muc dich: du sau nay cong thuc bi sua doi, don hang da tao van tru kho theo dung
 * cong thuc tai thoi diem khach dat mon — khong bi anh huong boi thay doi cong thuc sau do.
 */
async function buildRecipeSnapshot(menuItemId) {
  if (!menuItemId) return null;
  const recipes = await prisma.menuItemIngredient.findMany({
    where: { menuItemId },
    include: { ingredient: { select: { name: true, unit: true } } },
  });
  if (recipes.length === 0) return null;
  return recipes.map((r) => ({
    ingredientId: r.ingredientId,
    ingredientName: r.ingredient?.name,
    unit: r.ingredient?.unit,
    amount: Number(r.amount),
  }));
}

/**
 * Chuyen recipeSnapshot (JSON luu san) thanh danh sach { ingredientId, amount, ingredient }
 * giong het shape ma deductInventoryForOrderTx/validateInventoryForOrder mong doi tu
 * menuItemIngredient.findMany({include:{ingredient:true}}) — chi khac la "amount" lay tu
 */

export const orderService = {
  /** Lấy tất cả đơn cho kitchen queue */
  async listKitchenQueue(user) {
    if (!user) return [];
    const where = {
      kitchenStatus: { in: ['PENDING', 'RECEIVED', 'PREPARING', 'READY'] },
      status: { not: 'PENDING_PAYMENT' },
      accountId: user.accountId || user.id,
      deletedAt: null,
    };
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { select: { id: true, name: true, quantity: true, note: true } },
        kots: { select: { id: true, kotNumber: true, status: true, priority: true, note: true } },
      },
      orderBy: [{ kitchenStatus: 'asc' }, { createdAt: 'asc' }],
    });
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      tableNumber: o.tableNumber,
      kitchenStatus: o.kitchenStatus,
      priority: o.kots?.[0]?.priority || 0,
      note: o.note,
      items: o.items,
      kots: o.kots,
      createdAt: o.createdAt,
    }));
  },

  /** Cập nhật kitchen status của order */
  async updateKitchenStatus(orderId, status, user = null) {
    const validStatuses = ['PENDING', 'RECEIVED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
    const normalized = String(status).toUpperCase();
    if (!validStatuses.includes(normalized)) {
      throw new AppError(`Trạng thái bếp không hợp lệ: ${status}`, 400);
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Bạn không có quyền cập nhật đơn hàng này', 403);
      }
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        kitchenStatus: normalized,
        ...(normalized === 'PREPARING' || normalized === 'READY' || normalized === 'SERVED'
          ? { status: normalized }
          : {}),
      },
    });

    if (normalized === 'READY') {
      await prisma.kot.updateMany({
        where: { orderId, status: { in: ['PENDING', 'RECEIVED', 'PREPARING'] } },
        data: { status: 'READY', completedAt: new Date() },
      });
    }

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      action: 'ORDER_KITCHEN_STATUS',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber, oldStatus: order.kitchenStatus, newStatus: normalized },
    });

    return { id: updated.id, kitchenStatus: updated.kitchenStatus };
  },

  /** Order History - permission-based access control */
  async listOrderHistory(user, { startDate, endDate, status, source, page, limit } = {}) {
    if (!user) return [];
    const where = {
      accountId: user.accountId || user.id,
      deletedAt: null,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (status) {
      where.status = String(status).toUpperCase();
    }

    if (source) {
      where.source = source;
    }

    if (page && limit) {
      const { page: p, limit: l } = parsePagination({ page, limit });
      const [orders, total] = await orderRepository.findMany(where, { page: p, limit: l });
      return paginatedResponse(
        orders.map(mapOrderDetail),
        total,
        { page: p, limit: l }
      );
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(mapOrderDetail);
  },

  /** Lấy tất cả đơn pending/preparing cho POS */
  async listActiveOrders(user) {
    if (!user) return [];
    const where = { status: { in: ['PENDING', 'PREPARING'] }, accountId: user.accountId || user.id };
    const orders = await orderRepository.findMany(where);
    return orders.map(mapPosOrder);
  },

  /** Order Queue POS - lấy danh sách order queue */
  async listQueueOrders(user, { search, status, paymentStatus } = {}, authType) {
    const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
    const statusFilter = status ? String(status).toUpperCase() : null;
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      throw new AppError(`Trạng thái không hợp lệ: ${status}`, 400);
    }

    const where = {
      source: 'ORDER_QUEUE_POS',
      deletedAt: null,
    };

    if (paymentStatus === 'PAID' && !statusFilter) {
      // Orders To Make: lấy đơn đã thanh toán, chưa hoàn thành
      where.paymentStatus = 'PAID';
      where.status = { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] };
    } else {
      if (paymentStatus) where.paymentStatus = String(paymentStatus).toUpperCase();
      where.status = statusFilter || { in: ['PENDING', 'PENDING_PAYMENT', 'PREPARING'] };
    }

    if (!user) return [];
    const accountId = user.accountId || user.id;
    where.accountId = accountId;

    // POS employee: chỉ xem đơn của chính mình
    // Admin: xem tất cả
    // Kitchen (PAID case): xem tất cả (không thêm filter)
    if (paymentStatus !== 'PAID' && authType === 'employee') {
      where.createdByUserId = user.id;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { note: { contains: search } },
      ];
    }
    const orders = await orderRepository.findManyLight(where);
    return orders.map(mapPosOrder);
  },

  /** Tạo Order Queue POS (không gắn bàn) */
  async createQueueOrder(body, user = null) {
    const normalizedItems = await normalizeOrderItems(body.items);

    let subtotal = 0;
    let cost = 0;

    const orderItemsData = await mapConcurrent(normalizedItems, async (item) => {
      const lineTotal = item.price * item.quantity;
      const lineCost = item.cost * item.quantity;
      subtotal += lineTotal;
      cost += lineCost;
      return {
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        cost: item.cost,
        quantity: item.quantity,
        recipeSnapshot: await buildRecipeSnapshot(item.menuItemId),
      };
    }, 5);

    const tax = 0;
    const total = subtotal;
    const profit = subtotal - cost;
    const orderNumber = `ORD-${Date.now()}`;

    const accountId = resolveAccountId(body, user);
    const orderData = {
      orderNumber,
      accountId,
      createdBy: user?.accountId || user?.id || body.createdBy,
      createdByUserId: user?.id || null,
      status: 'PENDING',
      subtotal,
      tax,
      total,
      cost,
      profit,
      source: 'ORDER_QUEUE_POS',
      orderType: body.orderType || 'DINE_IN',
      items: orderItemsData.length > 0 ? { create: orderItemsData } : undefined,
    };

    // Tao don + giu cho ton kho trong cung 1 transaction: neu khong du hang kha dung
    // (co the da bi don khac giu cho), toan bo viec tao don se bi rollback.
    // Include giong het orderRepository.create de khong mat du lieu hien thi.
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({ data: orderData, include: ORDER_ITEMS_INCLUDE });
      await reserveInventoryForOrderTx(tx, created);
      return created;
    });

    // Kiểm tra OrderItems sau khi tạo
    const createdItems = order.items;

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      action: 'ORDER_CREATED',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber, itemCount: orderItemsData.length, total: order.total, source: 'ORDER_QUEUE_POS' },
    });

    return { data: mapPosOrder(order), created: true };
  },

  /** Cập nhật Order Queue */
  async updateQueueOrder(id, body, user = null, authType) {
    // Use lightweight permission check when not updating items
    const needsItems = !!body.items;
    const order = needsItems
      ? await orderRepository.findById(id)
      : await orderRepository.findByIdLight(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Bạn không có quyền cập nhật đơn hàng này', 403);
      }
      // Employee: chỉ được cập nhật đơn của chính mình
      if (authType === 'employee' && order.createdByUserId !== user.id) {
        throw new AppError('Bạn không có quyền cập nhật đơn hàng này', 403);
      }
    }

    const updateData = {};
    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }
    if (body.note !== undefined) updateData.note = body.note;
    if (body.orderType) updateData.orderType = body.orderType;
    if (body.discount !== undefined) updateData.discount = Number(body.discount);
    if (needsItems) {
      const normalizedItems = await normalizeOrderItems(body.items);
      let subtotal = 0;
      let cost = 0;
      const orderItemsData = await mapConcurrent(normalizedItems, async (item) => {
        const lineTotal = item.price * item.quantity;
        const lineCost = item.cost * item.quantity;
        subtotal += lineTotal;
        cost += lineCost;
        return {
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          cost: item.cost,
          quantity: item.quantity,
          recipeSnapshot: await buildRecipeSnapshot(item.menuItemId),
        };
      }, 5);
      const discount = body.discount !== undefined ? Number(body.discount) : 0;
      const tax = 0;
      const total = Math.max(0, subtotal - discount);
      const profit = subtotal - cost;
      updateData.subtotal = subtotal;
      updateData.tax = tax;
      updateData.total = total;
      updateData.cost = cost;
      updateData.profit = profit;
      updateData.items = {
        deleteMany: {},
        create: orderItemsData,
      };
    }

    // Use lighter update when only changing status (no items/discount).
    // Khi doi items, phai giu cho lai ton kho theo danh sach moi trong cung 1 transaction.
    const updated = needsItems
      ? await prisma.$transaction(async (tx) => {
          const result = await tx.order.update({ where: { id }, data: updateData, include: ORDER_ITEMS_INCLUDE });
          await reserveInventoryForOrderTx(tx, result);
          return result;
        })
      : await orderRepository.updateStatus(id, updateData);

    if (body.status === 'COMPLETED' && order.tableId) {
      await prisma.$transaction(async (tx) => {
        await tx.table.update({
          where: { id: order.tableId },
          data: {
            status: 'AVAILABLE',
            isMerged: false,
            mergedIntoTableId: null,
          },
        });

        if (Array.isArray(order.mergedTableIds)) {
          for (const mergedId of order.mergedTableIds) {
            await tx.table.update({
              where: { id: mergedId },
              data: {
                status: 'AVAILABLE',
                isMerged: false,
                mergedIntoTableId: null,
              },
            });
          }
        }
      });
    }

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      action: 'ORDER_UPDATED',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber, changes: Object.keys(updateData), itemsReplaced: needsItems },
    });

    return mapPosOrder(updated);
  },

  /** Validate Order Queue before payment (inventory check) */
  async completeQueuePayment(id, _paymentMethod, user = null, authType) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thanh toán đơn hàng này', 403);
      }
      if (authType === 'employee' && order.createdByUserId !== user.id) {
        throw new AppError('Bạn không có quyền thanh toán đơn hàng này', 403);
      }
    }

    const inventoryIssues = await validateInventoryForOrder(order);
    if (inventoryIssues.length > 0) {
      return { inventoryIssues, orderId: id };
    }

    return { valid: true, orderId: id, total: Number(order.total) };
  },

  /** Hủy Order Queue */
  async cancelQueueOrder(id, user = null, authType) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Bạn không có quyền hủy đơn hàng này', 403);
      }
      // Employee: chỉ được hủy đơn của chính mình
      if (authType === 'employee' && order.createdByUserId !== user.id) {
        throw new AppError('Bạn không có quyền hủy đơn hàng này', 403);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await releaseReservationsForOrder(tx, id);
      return tx.order.update({
        where: { id },
        data: { status: 'CANCELLED', deletedAt: new Date() },
      });
    });

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      action: 'ORDER_CANCELLED',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber },
    });

    return mapPosOrder(updated);
  },

  /** Chi tiết đơn hàng */
  async getOrderDetail(orderId, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập để xem đơn hàng', 401);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    const accountId = user.accountId || user.id;
    if (accountId && order.accountId !== accountId) {
      throw new AppError('Bạn không có quyền xem đơn hàng này', 403);
    }

    const isRestaurant = order.orderNumber?.startsWith('ORD-');

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: formatFullDateTime(order.createdAt),
      completedAt: order.completedAt ? formatFullDateTime(order.completedAt) : null,
      subtotal: Number(order.subtotal),
      tax: isRestaurant ? 0 : Number(order.tax),
      discount: Number(order.discount || 0),
      serviceCharge: Number(order.serviceCharge || 0),
      total: isRestaurant
        ? Number(order.subtotal) - Number(order.discount || 0) + Number(order.serviceCharge || 0)
        : Number(order.total),
      items: order.items.map((item) => ({
        name: item.menuItem?.name || item.name,
        quantity: item.quantity,
        price: Number(item.price),
        subtotal: Number(item.price) * item.quantity,
      })),
      // Billiard session snapshot
      tableName: order.tableName,
      tableCode: order.tableCode,
      tableType: order.tableType,
      sessionStartTime: order.sessionStartTime ? order.sessionStartTime.toISOString() : null,
      playingDurationMinutes: order.playingDurationMinutes,
      hourlyRate: order.hourlyRate ? Number(order.hourlyRate) : null,
      playingCost: order.playingCost ? Number(order.playingCost) : null,
      foodDrinkTotal: order.foodDrinkTotal ? Number(order.foodDrinkTotal) : null,
    };
  },

  /** Danh sách đơn trong ngày (mặc định hôm nay) */
  async listOrdersByDate({ date, status } = {}, user) {
    if (!user) return { date: date || formatDateKey(new Date()), summary: { totalOrders: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, completedCount: 0, pendingCount: 0 }, orders: [] };

    const dateStr = date || formatDateKey(new Date());
    const { start, end } = getDayBounds(dateStr);

    const where = {
      createdAt: { gte: start, lte: end },
      accountId: user.accountId || user.id,
    };

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    const orders = await orderRepository.findMany(where);
    const mapped = orders.map(mapOrderDetail);

    return {
      date: dateStr,
      summary: {
        totalOrders: mapped.length,
        totalRevenue: mapped.reduce((s, o) => s + o.total, 0),
        totalCost: mapped.reduce((s, o) => s + o.cost, 0),
        totalProfit: mapped.reduce((s, o) => s + o.profit, 0),
        completedCount: mapped.filter((o) => o.status === 'COMPLETED').length,
        pendingCount: mapped.filter((o) => ['PENDING', 'PREPARING'].includes(o.status)).length,
      },
      orders: mapped,
    };
  },

  /** Lấy đơn đang active của bàn (bao gồm cả billiard CONFIRMED status) */
  async getActiveOrderForTable(tableId, user = null) {
    const where = {
      tableId,
      status: { in: ['PENDING', 'PREPARING', 'CONFIRMED'] },
      deletedAt: null,
    };
    if (user) {
      where.accountId = user.accountId || user.id;
    }
    const order = await prisma.order.findFirst({
      where,
      include: {
        items: { include: { menuItem: { select: { id: true, name: true, price: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return order ? mapPosOrder(order) : null;
  },

  /** Tạo đơn từ POS hoặc QR Menu */
  async createOrder(body, user = null) {
    const tableNumber = parseInt(body.table, 10);
    if (Number.isNaN(tableNumber)) {
      throw new AppError('Số bàn không hợp lệ', 400);
    }

    const normalizedItems = await normalizeOrderItems(body.items);
    if (normalizedItems.length === 0) {
      throw new AppError('Đơn hàng phải có ít nhất 1 món', 400);
    }

    let subtotal = 0;
    let cost = 0;

    const orderItemsData = normalizedItems.map((item) => {
      const lineTotal = item.price * item.quantity;
      const lineCost = item.cost * item.quantity;
      subtotal += lineTotal;
      cost += lineCost;
      return {
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        cost: item.cost,
        quantity: item.quantity,
      };
    });

    const tax = 0;
    const total = subtotal;
    const profit = subtotal - cost;
    const orderNumber = `ORD-${Date.now()}-${tableNumber}`;

    const accountId = resolveAccountId(body, user);
    const orderData = {
      orderNumber,
      accountId,
      createdBy: user ? user.id : body.createdBy,
      tableNumber,
      status: 'PENDING',
      subtotal,
      tax,
      total,
      cost,
      profit,
      source: body.source || 'POS',
      orderType: body.orderType || 'DINE_IN',
      items: { create: orderItemsData },
    };

    const order = await orderRepository.create(orderData);

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      action: 'ORDER_CREATED',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber, tableNumber, itemCount: orderItemsData.length, total: order.total, source: order.source },
    });

    return mapPosOrder(order);
  },

  async deleteOrder(id, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập để xóa đơn hàng', 401);
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    const accountId = user.accountId || user.id;
    if (accountId && order.accountId !== accountId) {
      throw new AppError('Bạn không có quyền xóa đơn hàng này', 403);
    }
    await orderRepository.delete(id);

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      action: 'ORDER_DELETED',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber },
    });
  },

};

/** Chuẩn hóa items từ POS (full MenuItem) hoặc QR (itemId, name, price) */
async function normalizeOrderItems(items = []) {
  const result = [];

  // Batch resolve menu items: 1 query thay vì N queries
  const allIds = items
    .map(r => r.id || r.itemId || r.menuItemId)
    .filter(Boolean)
    .map(String);
  const menuItems = allIds.length > 0
    ? await prisma.menuItem.findMany({ where: { id: { in: allIds } } })
    : [];
  const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

  for (const raw of items) {
    const id = raw.id || raw.itemId || raw.menuItemId;
    const menuItem = id ? menuItemMap.get(String(id)) : null;

    const quantity = parseInt(raw.quantity || 1, 10);
    const name = raw.name || menuItem?.name || 'Món không xác định';
    const price = Number(raw.price ?? menuItem?.price ?? 0);
    const itemCost = Number(raw.cost ?? menuItem?.cost ?? 0);

    result.push({
      menuItemId: menuItem?.id || id || null,
      name,
      price,
      cost: itemCost,
      quantity,
    });
  }

  return result;
}

/**
 * Resolve accountId from auth context ONLY.
 * NEVER trust client-supplied body.accountId to prevent cross-account injection.
 * Handles both user auth and POS device auth.
 */
function resolveAccountId(body, user) {
  if (user) return user.accountId || user.id;
  return body.accountId;
}

function formatFullDateTime(date) {
  if (!date) return null;
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

function formatDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDayBounds(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}
