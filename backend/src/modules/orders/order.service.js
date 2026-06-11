import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { mapPosOrder, mapOrderDetail } from '../../utils/mappers.js';
import { orderRepository } from '../../repositories/order.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';

const TAX_RATE = 0.1;

export const orderService = {
  /** Lấy tất cả đơn cho kitchen queue */
  async listKitchenQueue(user) {
    const where = {
      kitchenStatus: { in: ['PENDING', 'RECEIVED', 'PREPARING', 'READY'] },
      deletedAt: null,
    };
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      where.accountId = user.accountId || user.id;
    }
    if (user && user.authType === 'device') {
      where.accountId = user.accountId || user.id;
    }
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

    return { id: updated.id, kitchenStatus: updated.kitchenStatus };
  },

  /** Order History - permission-based access control */
  async listOrderHistory(user, { startDate, endDate, status, source } = {}) {
    const isAdmin = user?.permissions?.includes('ADMIN_ALL');

    const where = {
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

    if (!isAdmin) {
      where.createdBy = user.id;
      where.accountId = user.accountId || user.id;
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
    const where = { status: { in: ['PENDING', 'PREPARING'] } };
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      where.accountId = user.accountId || user.id;
    }
    const orders = await orderRepository.findMany(where);
    return orders.map(mapPosOrder);
  },

  /** Order Queue POS - lấy danh sách order queue */
  async listQueueOrders(user, { search, status, paymentStatus } = {}) {
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

    const accountId = user ? (user.accountId || user.id) : null;
    if (accountId && !user.permissions?.includes('ADMIN_ALL')) {
      where.accountId = accountId;
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
    console.log("[REQUEST BODY]", JSON.stringify(body, null, 2));

    const normalizedItems = await normalizeOrderItems(body.items);
    console.log("[NORMALIZED ITEMS]", JSON.stringify(normalizedItems, null, 2));

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

    console.log("[ORDER ITEMS DATA - chưa lưu]", JSON.stringify(orderItemsData, null, 2));
    console.log("[CALC] subtotal =", subtotal, ", cost =", cost);

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
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

    if (body.posDeviceId) {
      orderData.posDeviceId = body.posDeviceId;
    }

    console.log("[ORDER PAYLOAD]", JSON.stringify(orderData, null, 2));
    const order = await orderRepository.create(orderData);

    // Kiểm tra OrderItems sau khi tạo
    const createdItems = await prisma.orderItem.findMany({
      where: { orderId: order.id },
    });
    console.log("[ORDER ITEMS - sau khi tạo]", JSON.stringify(createdItems.map(i => ({
      id: i.id,
      name: i.name,
      price: Number(i.price),
      cost: Number(i.cost),
      quantity: i.quantity,
      total: Number(i.total),
    })), null, 2));

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
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
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
      const discount = body.discount !== undefined ? Number(body.discount) : 0;
      const tax = (subtotal - discount) * TAX_RATE;
      const total = Math.max(0, subtotal - discount + tax);
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

    // Use lighter update when only changing status (no items/discount)
    const updated = needsItems
      ? await orderRepository.update(id, updateData)
      : await orderRepository.updateStatus(id, updateData);
    return mapPosOrder(updated);
  },

  /** Thanh toán Order Queue (atomic: update + deduct inventory) */
  async completeQueuePayment(id, paymentMethod = 'CASH', user = null) {
    try {
      console.log("[STEP 1] Find order by ID:", id);

      const order = await orderRepository.findById(id);
      console.log("[STEP 1 RESULT] order found:", order ? `YES - ${order.orderNumber}` : "NO - NULL");
      if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
      if (user && !user.permissions?.includes('ADMIN_ALL')) {
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
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Bạn không có quyền hủy đơn hàng này', 403);
      }
    }

    const updated = await orderRepository.update(id, {
      status: 'CANCELLED',
      deletedAt: new Date(),
    });
    return mapPosOrder(updated);
  },

  /** Chi tiết đơn hàng */
  async getOrderDetail(orderId, user) {
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

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: formatFullDateTime(order.createdAt),
      completedAt: order.completedAt ? formatFullDateTime(order.completedAt) : null,
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      discount: Number(order.discount || 0),
      serviceCharge: Number(order.serviceCharge || 0),
      total: Number(order.total),
      items: order.items.map((item) => ({
        name: item.menuItem?.name || item.name,
        quantity: item.quantity,
        price: Number(item.price),
        subtotal: Number(item.price) * item.quantity,
      })),
    };
  },

  /** Danh sách đơn trong ngày (mặc định hôm nay) */
  async listOrdersByDate({ date, status } = {}, user) {
    const dateStr = date || formatDateKey(new Date());
    const { start, end } = getDayBounds(dateStr);

    const where = {
      createdAt: { gte: start, lte: end },
    };

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      where.accountId = user.accountId || user.id;
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

  /** Lấy đơn đang active của bàn */
  async getActiveOrderForTable(tableId, user = null) {
    const where = {
      tableId,
      status: { in: ['PENDING', 'PREPARING'] },
      deletedAt: null,
    };
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
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

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
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

    return mapPosOrder(order);
  },

  async deleteOrder(id, user) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Bạn không có quyền xóa đơn hàng này', 403);
      }
    }
    await orderRepository.delete(id);
  },

   /** Thanh toán - hoàn tất đơn + trừ kho (atomic per order) */
   async completeTableOrders(tableNumber, paymentMethod = 'CASH', user = null) {
     const where = {
       tableNumber,
       status: { in: ['PENDING', 'PREPARING'] },
     };
      if (user && !user.permissions?.includes('ADMIN_ALL')) {
        where.accountId = user.accountId || user.id;
      }
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
    if (!orderItem.menuItemId) {
      console.log(`[INVENTORY VALIDATE] Skip item "${orderItem.name}" - no menuItemId`);
      continue;
    }

    const recipes = await prisma.menuItemIngredient.findMany({
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

/**
 * Deduct inventory inside an existing Prisma transaction.
 */
async function deductInventoryForOrderTx(tx, order, createdBy) {
  const orderItems = order.items || [];

  for (const orderItem of orderItems) {
    if (!orderItem.menuItemId) {
      continue;
    }

    const recipes = await tx.menuItemIngredient.findMany({
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
 * Resolve accountId from request body or auth context.
 * Handles both user auth and POS device auth.
 */
function resolveAccountId(body, user) {
  if (body && body.accountId) return body.accountId;
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
