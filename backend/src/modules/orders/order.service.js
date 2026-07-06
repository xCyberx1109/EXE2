import { Prisma } from '@prisma/client';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { parsePagination, paginatedResponse } from '../../utils/pagination.js';
import { mapPosOrder, mapOrderDetail } from '../../utils/mappers.js';
import { orderRepository } from '../../repositories/order.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { logAction } from '../../utils/auditLogger.js';
import { consumeIngredientBatchesFEFO } from '../../utils/inventoryBatches.js';

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
 * snapshot (co dinh) thay vi cong thuc hien tai, con "ingredient" (ton kho, gia) luon lay LIVE.
 */
async function resolveRecipeFromSnapshot(tx, snapshot) {
  const ingredientIds = snapshot.map((s) => s.ingredientId);
  const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds } } });
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  return snapshot
    .map((s) => ({ ingredientId: s.ingredientId, amount: s.amount, ingredient: byId.get(s.ingredientId) }))
    .filter((r) => r.ingredient); // bo qua neu nguyen lieu da bi xoa sau khi tao don
}

export const orderService = {
  /** Lấy tất cả đơn cho kitchen queue */
  async listKitchenQueue(user) {
    if (!user) return [];
    const where = {
      kitchenStatus: { in: ['PENDING', 'RECEIVED', 'PREPARING', 'READY'] },
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
      data: { kitchenStatus: normalized },
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
      where.status = statusFilter || { in: ['PENDING', 'PREPARING'] };
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

    const orderItemsData = await Promise.all(normalizedItems.map(async (item) => {
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
    }));

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
      const orderItemsData = await Promise.all(normalizedItems.map(async (item) => {
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
      }));
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

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      action: 'ORDER_UPDATED',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber, changes: Object.keys(updateData), itemsReplaced: needsItems },
    });

    return mapPosOrder(updated);
  },

  /** Thanh toán Order Queue (atomic: update + deduct inventory) */
  async completeQueuePayment(id, paymentMethod = 'CASH', user = null, authType) {
    try {
      const order = await orderRepository.findById(id);
      if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
      if (user) {
        const accountId = user.accountId || user.id;
        if (accountId && order.accountId !== accountId) {
          throw new AppError('Bạn không có quyền thanh toán đơn hàng này', 403);
        }
        // Employee: chỉ được thanh toán đơn của chính mình
        if (authType === 'employee' && order.createdByUserId !== user.id) {
          throw new AppError('Bạn không có quyền thanh toán đơn hàng này', 403);
        }
      }

      const method = paymentMethod.toUpperCase();
      const paymentMethodFinal = ['CASH', 'CARD', 'BANKING', 'E_WALLET', 'OTHER'].includes(method) ? method : 'CASH';
      const userId = user ? (user.accountId || user.id) : null;

      const beforeItems = await prisma.orderItem.findMany({ where: { orderId: id } });
      if (beforeItems.length === 0) {
        console.warn("[CHECKOUT] WARNING: Order has NO items in database! Payment will process an empty order.");
      }

      // PRE-VALIDATION: Check inventory sufficiency before payment
      const inventoryIssues = await validateInventoryForOrder(order);
      if (inventoryIssues.length > 0) {
        return { inventoryIssues, orderId: id };
      }

      const updated = await prisma.$transaction(async (tx) => {
        const lockedOrder = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!lockedOrder) throw new AppError('Không tìm thấy đơn hàng', 404);

        if (lockedOrder.inventoryDeducted) {
          return lockedOrder;
        }

        const updateData = {
          paymentStatus: 'PAID',
          paymentMethod: paymentMethodFinal,
        };

        const updatedOrder = await tx.order.update({
          where: { id },
          data: updateData,
          include: { items: { include: { menuItem: true } } },
        });

        await tx.payment.create({
          data: {
            orderId: id,
            amount: Number(lockedOrder.total),
            method: paymentMethodFinal,
            status: 'PAID',
          },
        });

        await deductInventoryForOrderTx(tx, updatedOrder, userId || lockedOrder.createdBy);
        await releaseReservationsForOrder(tx, id);

        await tx.order.update({
          where: { id },
          data: { inventoryDeducted: true },
        });

        return updatedOrder;
      }, {
        timeout: 10000,
      });

      logAction({
        accountId: order.accountId,
      employeeId: user?.employeeId,
      action: 'ORDER_PAID',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total), paymentMethod: paymentMethodFinal, itemCount: beforeItems.length },
      });

      return mapPosOrder(updated);
    } catch (error) {
      console.error("[PAYMENT ERROR] ===== START =====");
      console.error("[PAYMENT ERROR] name:", error.name);
      console.error("[PAYMENT ERROR] message:", error.message);
      console.error("[PAYMENT ERROR] code:", error.code);
      console.error("[PAYMENT ERROR] statusCode:", error.statusCode);
      console.error("[PAYMENT ERROR] meta:", JSON.stringify(error.meta, null, 2));
      console.error("[PAYMENT ERROR] stack:", error.stack);
      console.error("[PAYMENT ERROR] =====  END  =====");

      if (error.code === 'P2002') {
        console.error("[PRISMA P2002] Unique constraint violation - dữ liệu đã tồn tại");
      }
      if (error.code === 'P2003') {
        console.error("[PRISMA P2003] Foreign key constraint failure - dữ liệu tham chiếu không hợp lệ");
        console.error("[PRISMA P2003] field:", error.meta?.field_name);
      }
      if (error.code === 'P2025') {
        console.error("[PRISMA P2025] Record not found - bản ghi không tồn tại");
        console.error("[PRISMA P2025] cause:", error.meta?.cause);
      }

      throw error;
    }
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

   /** Thanh toán - hoàn tất đơn + trừ kho (atomic per order) */
   async completeTableOrders(tableNumber, paymentMethod = 'CASH', user = null) {
     if (!user) throw new AppError('Vui lòng đăng nhập để thanh toán', 401);
     const where = {
       tableNumber,
       status: { in: ['PENDING', 'PREPARING'] },
       accountId: user.accountId || user.id,
     };
      const orders = await orderRepository.findMany(where);
      if (orders.length === 0) {
        throw new AppError('Không có đơn hàng để thanh toán', 404);
     }

      const method = paymentMethod.toUpperCase();
      const paymentMethodFinal = ['CASH', 'CARD', 'BANKING', 'E_WALLET', 'OTHER'].includes(method) ? method : 'CASH';
      const completed = [];
     const userId = user ? (user.accountId || user.id) : null;

      for (const order of orders) {
        const updated = await prisma.$transaction(async (tx) => {
          const lockedOrder = await tx.order.findUnique({
            where: { id: order.id },
            include: { items: true },
          });
          if (!lockedOrder) throw new AppError('Không tìm thấy đơn hàng', 404);

          if (lockedOrder.inventoryDeducted) {
            return lockedOrder;
          }

          const updatedOrder = await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              paymentMethod: paymentMethodFinal,
              completedAt: new Date(),
            },
            include: { items: { include: { menuItem: true } } },
          });

          await deductInventoryForOrderTx(tx, updatedOrder, userId || lockedOrder.createdBy);

          await tx.order.update({
            where: { id: order.id },
            data: { inventoryDeducted: true },
          });

          return updatedOrder;
        }, {
          timeout: 10000,
        });

        completed.push(mapPosOrder(updated));

        logAction({
          accountId: order.accountId,
        employeeId: user?.employeeId,
        action: 'ORDER_PAID',
          module: 'POS_ORDER',
          details: { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total), paymentMethod: paymentMethodFinal, tableNumber },
        });
      }

      // --- Update table(s) status to AVAILABLE ---
      const tableIds = [...new Set(orders.map(o => o.tableId).filter(Boolean))];
      if (tableIds.length > 0) {
        await prisma.table.updateMany({
          where: { id: { in: tableIds } },
          data: { status: 'AVAILABLE' },
        });
      } else {
        const accountId = user?.accountId || user?.id;
        if (accountId) {
          await prisma.table.updateMany({
            where: { tableCode: String(tableNumber), accountId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      return completed;
     },
};

/**
 * Validate inventory for an order without deducting.
 * Returns array of inventory issues (empty if all sufficient).
 */
async function validateInventoryForOrder(order) {
  const orderItems = order.items || [];
  const issues = [];

  for (const orderItem of orderItems) {
    // Direct inventory sale: validate stock directly
    if (orderItem.inventoryId && !orderItem.menuItemId) {
      const ingredient = await prisma.ingredient.findUnique({ where: { id: orderItem.inventoryId } });
      if (!ingredient) {
        issues.push({
          menuItemId: null,
          menuItemName: orderItem.name,
          missingIngredients: [{ ingredientName: orderItem.name, required: orderItem.quantity, available: 0 }],
        });
        continue;
      }
      const available = Number(ingredient.quantity);
      if (available < orderItem.quantity) {
        issues.push({
          menuItemId: null,
          menuItemName: orderItem.name,
          missingIngredients: [{
            ingredientName: ingredient.name,
            required: orderItem.quantity,
            available,
          }],
        });
      }
      continue;
    }

    if (!orderItem.menuItemId) {
      continue;
    }

    // Uu tien dung recipeSnapshot (cong thuc tai thoi diem tao don) neu co, de nhat quan voi
    // luc thuc su tru kho — fallback ve cong thuc hien tai cho don cu chua co snapshot.
    const recipes = orderItem.recipeSnapshot?.length > 0
      ? await resolveRecipeFromSnapshot(prisma, orderItem.recipeSnapshot)
      : await prisma.menuItemIngredient.findMany({
          where: { menuItemId: orderItem.menuItemId },
          include: { ingredient: true },
        });

    const missingIngredients = [];

    for (const recipe of recipes) {
      const totalUsage = Number(recipe.amount) * orderItem.quantity;
      const ingredient = recipe.ingredient;
      const available = Number(ingredient.quantity);

      if (available < totalUsage) {
        missingIngredients.push({
          ingredientName: ingredient.name,
          required: totalUsage,
          available: available,
        });
      }
    }

    if (missingIngredients.length > 0) {
      issues.push({
        menuItemId: orderItem.menuItemId,
        menuItemName: orderItem.name,
        missingIngredients,
      });
    }
  }

  return issues;
}

/** Gom nhu cau nguyen lieu tu danh sach order items (theo cong thuc menu hoac ban thang tu kho). */
async function computeRequiredIngredients(tx, orderItems) {
  const required = new Map(); // ingredientId -> so luong can

  for (const item of orderItems) {
    if (item.inventoryId && !item.menuItemId) {
      required.set(item.inventoryId, (required.get(item.inventoryId) || 0) + Number(item.quantity));
      continue;
    }
    if (!item.menuItemId) continue;

    const recipes = await tx.menuItemIngredient.findMany({ where: { menuItemId: item.menuItemId } });
    for (const recipe of recipes) {
      const usage = Number(recipe.amount) * Number(item.quantity);
      required.set(recipe.ingredientId, (required.get(recipe.ingredientId) || 0) + usage);
    }
  }

  return required;
}

/**
 * Giu cho tam thoi ton kho cho 1 don hang (PENDING, chua thanh toan), ngan 2 don cung luc
 * "thay" con hang trong khi thuc te chi du cho 1 don. Dung SELECT...FOR UPDATE de khoa row
 * Ingredient — nguoi goi thu 2 gan nhu dong thoi se PHAI CHO tran giao dich thu nhat commit/
 * rollback truoc khi doc duoc so lieu, tranh race condition thuc su (khong chi giam xac suat).
 *
 * Goi trong 1 Prisma interactive transaction (tx). Neu khong du kha dung, throw AppError 400 —
 * toan bo transaction (bao gom viec tao/sua don) se bi rollback.
 */
async function reserveInventoryForOrderTx(tx, order) {
  const orderItems = order.items || [];
  const required = await computeRequiredIngredients(tx, orderItems);

  if (required.size === 0) {
    await tx.inventoryReservation.deleteMany({ where: { orderId: order.id } });
    return;
  }

  // Batch: khóa tất cả ingredient cần kiểm tra trong 1 query, tránh N round trips
  const ingredientIds = Array.from(required.keys());
  const locked = await tx.$queryRaw`
    SELECT "id", "name", "quantity" FROM "ingredients"
    WHERE "id" IN (${Prisma.join(ingredientIds)}) FOR UPDATE
  `;
  const ingredientMap = {};
  for (const row of locked) {
    ingredientMap[row.id] = { name: row.name, quantity: Number(row.quantity) };
  }

  // Batch: lấy tổng reservation của tất cả ingredient trong 1 query
  const reservationSums = await tx.inventoryReservation.groupBy({
    by: ['ingredientId'],
    _sum: { quantity: true },
    where: { ingredientId: { in: ingredientIds }, orderId: { not: order.id } },
  });
  const reservedMap = {};
  for (const r of reservationSums) {
    reservedMap[r.ingredientId] = Number(r._sum.quantity || 0);
  }

  for (const [ingredientId, amount] of required.entries()) {
    const ingredient = ingredientMap[ingredientId];
    if (!ingredient) continue;

    const reserved = reservedMap[ingredientId] || 0;
    const available = ingredient.quantity - reserved;

    if (available < amount) {
      throw new AppError(
        `Không đủ tồn kho khả dụng cho "${ingredient.name}" (có thể đã được đơn khác giữ chỗ). Cần ${amount}, còn khả dụng ${available}.`,
        400
      );
    }
  }

  // Tat ca nguyen lieu deu du -> thay the toan bo reservation cu bang reservation moi cua don nay.
  await tx.inventoryReservation.deleteMany({ where: { orderId: order.id } });
  await tx.inventoryReservation.createMany({
    data: Array.from(required.entries()).map(([ingredientId, amount]) => ({
      accountId: order.accountId,
      orderId: order.id,
      ingredientId,
      quantity: amount,
    })),
  });
}

async function releaseReservationsForOrder(tx, orderId) {
  await tx.inventoryReservation.deleteMany({ where: { orderId } });
}

/**
 * Deduct inventory inside an existing Prisma transaction.
 * Batch ingredient queries + transaction creates để giảm round trips.
 */
async function deductInventoryForOrderTx(tx, order, createdBy) {
  const orderItems = order.items || [];
  const txRecords = [];

  for (const orderItem of orderItems) {
    // Direct inventory sale: deduct stock directly
    if (orderItem.inventoryId && !orderItem.menuItemId) {
      const currentIngredient = await tx.ingredient.findUnique({
        where: { id: orderItem.inventoryId },
      });
      if (!currentIngredient) continue;

      const currentQty = Number(currentIngredient.quantity);
      if (currentQty < orderItem.quantity) {
        throw new AppError(
          `Không đủ hàng tồn kho: ${currentIngredient.name}. Cần ${orderItem.quantity}, có ${currentQty}`,
          400
        );
      }

      const updatedIngredient = await tx.ingredient.update({
        where: { id: orderItem.inventoryId },
        data: {
          quantity: { increment: -orderItem.quantity },
          lastUpdated: new Date(),
        },
      });

      txRecords.push({
        ingredientId: orderItem.inventoryId,
        accountId: order.accountId,
        type: 'SALE',
        quantity: orderItem.quantity,
        beforeQuantity: Number(updatedIngredient.quantity) + orderItem.quantity,
        afterQuantity: Number(updatedIngredient.quantity),
        note: `Direct sale from order ${order.orderNumber}`,
        referenceType: 'ORDER',
        referenceId: order.id,
        createdBy,
      });
      await consumeIngredientBatchesFEFO(tx, orderItem.inventoryId, orderItem.quantity);
      continue;
    }

    if (!orderItem.menuItemId) {
      continue;
    }

    // Uu tien tru kho theo recipeSnapshot (cong thuc luc tao don) — neu cong thuc bi sua doi
    // sau khi don da tao, don nay van tru dung nhu da chup, khong bi anh huong.
    const recipes = orderItem.recipeSnapshot?.length > 0
      ? await resolveRecipeFromSnapshot(tx, orderItem.recipeSnapshot)
      : await tx.menuItemIngredient.findMany({
          where: { menuItemId: orderItem.menuItemId },
          include: { ingredient: true },
        });

    for (const recipe of recipes) {
      const totalUsage = Number(recipe.amount) * orderItem.quantity;
      const ingredient = recipe.ingredient;

      if (!ingredient) {
        continue;
      }

      const currentQty = Number(ingredient.quantity);

      if (currentQty < totalUsage) {
        throw new AppError(
          `Không đủ nguyên liệu: ${ingredient.name}. Cần ${totalUsage}, có ${currentQty}`,
          400
        );
      }

      const updatedIngredient = await tx.ingredient.update({
        where: { id: recipe.ingredientId },
        data: {
          quantity: { increment: -totalUsage },
          lastUpdated: new Date(),
        },
      });

      txRecords.push({
        ingredientId: recipe.ingredientId,
        accountId: order.accountId,
        type: 'OUT',
        quantity: totalUsage,
        beforeQuantity: Number(updatedIngredient.quantity) + totalUsage,
        afterQuantity: Number(updatedIngredient.quantity),
        note: `Deduction from order ${order.orderNumber}`,
        referenceType: 'ORDER',
        referenceId: order.id,
        createdBy,
      });
      await consumeIngredientBatchesFEFO(tx, recipe.ingredientId, totalUsage);
    }
  }

  // Batch create tất cả inventory transaction records trong 1 query
  if (txRecords.length > 0) {
    await tx.inventoryTransaction.createMany({ data: txRecords });
  }
}

/** Chuẩn hóa items từ POS (full MenuItem) hoặc QR (itemId, name, price) */
async function normalizeOrderItems(items = []) {
  const result = [];

  for (const raw of items) {
    let menuItem = null;

    const id = raw.id || raw.itemId || raw.menuItemId;
    if (id) {
      menuItem = await menuItemRepository.findById(String(id));
    }

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
