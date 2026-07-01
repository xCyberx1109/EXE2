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
      menuItem: { include: { category: true } },
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
  async listQueueOrders(user, posDevice, { search, status, paymentStatus } = {}) {
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

    // ── Filter theo posDeviceId cho CASHIER / CASHIER_KITCHEN ─────────────────
    // machineId lấy từ posDevice (auth middleware) hoặc user.machineId (compat)
    const machineId = posDevice?.id || user?.machineId || null;
    const template = posDevice?.template || null;

    // KITCHEN không filter posDeviceId — thấy toàn bộ đơn cần chế biến
    // CASHIER / CASHIER_KITCHEN chỉ thấy đơn của chính máy đó
    // paymentStatus=PAID là request từ OrdersToMakePanel (kitchen view) → không filter
    const isKitchenView = paymentStatus === 'PAID';
    const shouldFilterByDevice =
      machineId &&
      !isKitchenView &&
      template !== 'KITCHEN';

    if (shouldFilterByDevice) {
      where.posDeviceId = machineId;
    }

    console.log('[ORDER QUEUE FILTER]', {
      template: template ?? 'unknown (account user)',
      machineId: machineId ?? 'none',
      appliedFilter: shouldFilterByDevice ? `posDeviceId = ${machineId}` : 'none (kitchen or account view)',
      isKitchenView,
      paymentStatus,
      accountId,
    });

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
  async createQueueOrder(body, user = null, posDevice = null) {
    console.log("[REQUEST BODY]", JSON.stringify(body, null, 2));

    const normalizedItems = await normalizeOrderItems(body.items);
    console.log("[NORMALIZED ITEMS]", JSON.stringify(normalizedItems, null, 2));

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

    console.log("[ORDER ITEMS DATA - chưa lưu]", JSON.stringify(orderItemsData, null, 2));
    console.log("[CALC] subtotal =", subtotal, ", cost =", cost);

    const tax = 0;
    const total = subtotal;
    const profit = subtotal - cost;
    const orderNumber = `ORD-${Date.now()}`;

    console.log("[CALC] tax =", tax, ", total =", total, ", profit =", profit);

    const accountId = resolveAccountId(body, user);
    const orderData = {
      orderNumber,
      accountId,
      createdBy: user ? user.id : body.createdBy,
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

    // Tự động inject posDeviceId từ POS Machine auth context
    // Ưu tiên: posDevice.id (auth middleware) > user.machineId (compat) > body.posDeviceId (legacy)
    const resolvedPosDeviceId = posDevice?.id || user?.machineId || body.posDeviceId || null;
    if (resolvedPosDeviceId) {
      orderData.posDeviceId = resolvedPosDeviceId;
    }

    console.log('[ORDER QUEUE FILTER]', {
      template: posDevice?.template ?? 'unknown (account user)',
      machineId: resolvedPosDeviceId ?? 'none',
      appliedFilter: resolvedPosDeviceId ? `posDeviceId = ${resolvedPosDeviceId}` : 'none',
      action: 'CREATE',
    });

    console.log("[ORDER PAYLOAD]", JSON.stringify(orderData, null, 2));

    // Tao don + giu cho ton kho trong cung 1 transaction: neu khong du hang kha dung
    // (co the da bi don khac giu cho), toan bo viec tao don se bi rollback.
    // Include giong het orderRepository.create (items.menuItem.category) de khong mat du lieu
    // hien thi (mapPosOrder dung item.menuItem?.category?.name).
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({ data: orderData, include: ORDER_ITEMS_INCLUDE });
      await reserveInventoryForOrderTx(tx, created);
      return created;
    });

    // Kiểm tra OrderItems sau khi tạo
    const createdItems = order.items;
    console.log("[ORDER ITEMS - sau khi tạo]", JSON.stringify(createdItems.map(i => ({
      id: i.id,
      name: i.name,
      price: Number(i.price),
      cost: Number(i.cost),
      quantity: i.quantity,
      total: Number(i.total),
    })), null, 2));

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      posDeviceId: order.posDeviceId,
      action: 'ORDER_CREATED',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber, itemCount: orderItemsData.length, total: order.total, source: 'ORDER_QUEUE_POS' },
    });

    return { data: mapPosOrder(order), created: true };
  },

  /** Cập nhật Order Queue */
  async updateQueueOrder(id, body, user = null) {
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
      posDeviceId: order.posDeviceId,
      action: 'ORDER_UPDATED',
      module: 'POS_ORDER',
      details: { orderId: order.id, orderNumber: order.orderNumber, changes: Object.keys(updateData), itemsReplaced: needsItems },
    });

    return mapPosOrder(updated);
  },

  /** Thanh toán Order Queue (atomic: update + deduct inventory) */
  async completeQueuePayment(id, paymentMethod = 'CASH', user = null) {
    try {
      console.log("[STEP 1] Find order by ID:", id);

      const order = await orderRepository.findById(id);
      console.log("[STEP 1 RESULT] order found:", order ? `YES - ${order.orderNumber}` : "NO - NULL");
      if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
      if (user) {
        const accountId = user.accountId || user.id;
        if (accountId && order.accountId !== accountId) {
          throw new AppError('Bạn không có quyền thanh toán đơn hàng này', 403);
        }
      }

      const method = paymentMethod.toUpperCase();
      const paymentMethodFinal = ['CASH', 'CARD', 'BANKING', 'E_WALLET', 'OTHER'].includes(method) ? method : 'CASH';
      const userId = user ? user.id : null;

      console.log(`[CHECKOUT] Start queue payment order=${id} method=${paymentMethodFinal}`);
      console.log("[ORDER DATA]", JSON.stringify({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: Number(order.total),
        subtotal: Number(order.subtotal),
        itemCount: order.items?.length || 0,
      }, null, 2));

      console.log("[STEP 2] Load order items from DB for order ID:", id);
      const beforeItems = await prisma.orderItem.findMany({ where: { orderId: id } });
      console.log("[STEP 2 RESULT] order items count:", beforeItems.length);
      console.log("[ORDER ITEMS DB]", JSON.stringify(beforeItems.map(i => ({
        id: i.id,
        name: i.name,
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        price: Number(i.price),
        total: Number(i.total),
      })), null, 2));
      if (beforeItems.length === 0) {
        console.warn("[CHECKOUT] WARNING: Order has NO items in database! Payment will process an empty order.");
      }

      console.log("[STEP 3] Calculate totals - using DB values");
      console.log("[TOTALS]", JSON.stringify({
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        discount: Number(order.discount || 0),
        serviceCharge: Number(order.serviceCharge || 0),
        total: Number(order.total),
      }, null, 2));

      // PRE-VALIDATION: Check inventory sufficiency before payment
      console.log("[STEP 3.5] Pre-validate inventory for order");
      const inventoryIssues = await validateInventoryForOrder(order);
      if (inventoryIssues.length > 0) {
        console.log("[STEP 3.5 RESULT] Inventory issues found, returning without processing payment");
        return { inventoryIssues, orderId: id };
      }
      console.log("[STEP 3.5 RESULT] Inventory validation passed");

      const updated = await prisma.$transaction(async (tx) => {
        console.log("[TRANSACTION START] Payment transaction for order:", id);

        const lockedOrder = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });
        console.log("[TRANSACTION] Locked order:", lockedOrder ? lockedOrder.orderNumber : "NOT FOUND");
        if (!lockedOrder) throw new AppError('Không tìm thấy đơn hàng', 404);

        if (lockedOrder.inventoryDeducted) {
          console.log(`[CHECKOUT] Order ${lockedOrder.orderNumber} already deducted, skip`);
          return lockedOrder;
        }

        console.log(`[CHECKOUT] Set paymentStatus PAID for order ${lockedOrder.orderNumber}`);

        const updateData = {
          paymentStatus: 'PAID',
          paymentMethod: paymentMethodFinal,
        };

        const updatedOrder = await tx.order.update({
          where: { id },
          data: updateData,
          include: { items: { include: { menuItem: true } } },
        });
        console.log("[TRANSACTION] Order updated - paymentStatus=PAID, paymentMethod=" + paymentMethodFinal);

        const payment = await tx.payment.create({
          data: {
            orderId: id,
            amount: Number(lockedOrder.total),
            method: paymentMethodFinal,
            status: 'PAID',
          },
        });
        console.log("[STEP 4 RESULT] Payment created:", payment.id);

        console.log(`[CHECKOUT] Calculate ingredients for order ${lockedOrder.orderNumber}`);
        await deductInventoryForOrderTx(tx, updatedOrder, userId || lockedOrder.createdBy);

        // Da tru kho that su -> khong can giu cho tam thoi nua.
        await releaseReservationsForOrder(tx, id);

        console.log("[STEP 5] Update order - mark inventoryDeducted=true");
        await tx.order.update({
          where: { id },
          data: { inventoryDeducted: true },
        });
        console.log("[TRANSACTION] inventoryDeducted set to true");

        console.log(`[CHECKOUT] Success for order ${lockedOrder.orderNumber}`);
        return updatedOrder;
      }, {
        timeout: 30000,
      });

      console.log(`[TRANSACTION END] Payment transaction committed for order: ${id}`);

      logAction({
        accountId: order.accountId,
        employeeId: user?.employeeId,
        posDeviceId: order.posDeviceId,
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
  async cancelQueueOrder(id, user = null) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
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
      posDeviceId: order.posDeviceId,
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

    if (body.posDeviceId) {
      orderData.posDeviceId = body.posDeviceId;
    }

    console.log("[ORDER CREATE DATA]", JSON.stringify(orderData, null, 2));
    const order = await orderRepository.create(orderData);

    logAction({
      accountId: order.accountId,
      employeeId: user?.employeeId,
      posDeviceId: order.posDeviceId,
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
      posDeviceId: order.posDeviceId,
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
     const userId = user ? user.id : null;

      for (const order of orders) {
        console.log(`[CHECKOUT] Start table payment order=${order.id} table=${tableNumber}`);

        const updated = await prisma.$transaction(async (tx) => {
          const lockedOrder = await tx.order.findUnique({
            where: { id: order.id },
            include: { items: true },
          });
          if (!lockedOrder) throw new AppError('Không tìm thấy đơn hàng', 404);

          if (lockedOrder.inventoryDeducted) {
            console.log(`[CHECKOUT] Order ${lockedOrder.orderNumber} already deducted, skip`);
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
          timeout: 30000,
        });

        completed.push(mapPosOrder(updated));

        logAction({
          accountId: order.accountId,
          employeeId: user?.employeeId,
          posDeviceId: order.posDeviceId,
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
        console.log(`[CHECKOUT] Released ${tableIds.length} table(s) to AVAILABLE`);
      } else {
        const accountId = user?.accountId || user?.id;
        if (accountId) {
          await prisma.table.updateMany({
            where: { tableCode: String(tableNumber), accountId },
            data: { status: 'AVAILABLE' },
          });
          console.log(`[CHECKOUT] Released table by code ${tableNumber}`);
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
  console.log(`[INVENTORY VALIDATE] Validating inventory for order ${order.orderNumber} (${order.id})`);

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
      console.log(`[INVENTORY VALIDATE] Skip item "${orderItem.name}" - no menuItemId`);
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

      console.log(`[INVENTORY VALIDATE] ${orderItem.name} x${orderItem.quantity}: ${ingredient.name} need=${totalUsage}, available=${available}`);

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

  console.log(`[INVENTORY VALIDATE] Result: ${issues.length} issue(s) found`);
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

  for (const [ingredientId, amount] of required.entries()) {
    const locked = await tx.$queryRaw`SELECT "id", "name", "quantity" FROM "ingredients" WHERE "id" = ${ingredientId} FOR UPDATE`;
    const ingredient = locked[0];
    if (!ingredient) continue; // nguyen lieu khong con ton tai — se duoc phat hien o buoc validate/deduct khac

    const reservedElsewhere = await tx.inventoryReservation.aggregate({
      _sum: { quantity: true },
      where: { ingredientId, orderId: { not: order.id } },
    });
    const reserved = Number(reservedElsewhere._sum.quantity || 0);
    const available = Number(ingredient.quantity) - reserved;

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
 */
async function deductInventoryForOrderTx(tx, order, createdBy) {
  const orderItems = order.items || [];

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

      await tx.inventoryTransaction.create({
        data: {
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
        },
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

      await tx.inventoryTransaction.create({
        data: {
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
        },
      });
      await consumeIngredientBatchesFEFO(tx, recipe.ingredientId, totalUsage);
    }
  }
}

/** Chuẩn hóa items từ POS (full MenuItem) hoặc QR (itemId, name, price) */
async function normalizeOrderItems(items = []) {
  const result = [];

  for (const raw of items) {
    let menuItem = null;

    const id = raw.id || raw.itemId || raw.menuItemId;
    console.log("[NORMALIZE] raw item:", JSON.stringify(raw));
    if (id) {
      console.log("[NORMALIZE] looking up menuItemId:", id);
      menuItem = await menuItemRepository.findById(String(id));
      console.log("[MENU ITEMS] found:", menuItem ? JSON.stringify({ id: menuItem.id, name: menuItem.name, price: Number(menuItem.price), cost: Number(menuItem.cost) }) : "NULL - not found");
    } else {
      console.log("[NORMALIZE] No ID found in raw item!");
    }

    const quantity = parseInt(raw.quantity || 1, 10);
    const name = raw.name || menuItem?.name || 'Món không xác định';
    const price = Number(raw.price ?? menuItem?.price ?? 0);
    const itemCost = Number(raw.cost ?? menuItem?.cost ?? 0);

    console.log("[NORMALIZE] resolved: name=%s, price=%d, cost=%d, quantity=%d", name, price, itemCost, quantity);

    result.push({
      menuItemId: menuItem?.id || id || null,
      name,
      price,
      cost: itemCost,
      quantity,
    });
  }

  console.log("[NORMALIZE] final result:", JSON.stringify(result));
  return result;
}

/**
 * Resolve accountId from auth context ONLY.
 * NEVER trust client-supplied body.accountId to prevent cross-account injection.
 * Handles both user auth and POS device auth.
 */
function resolveAccountId(body, user) {
  if (!user) return undefined;
  return user.accountId || user.id;
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
