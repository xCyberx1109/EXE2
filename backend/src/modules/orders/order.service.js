import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { mapPosOrder, mapOrderDetail } from '../../utils/mappers.js';
import { orderRepository } from '../../repositories/order.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { inventoryTransactionRepository } from '../../repositories/inventoryTransaction.repository.js';
import { ingredientRepository } from '../../repositories/ingredient.repository.js';

const TAX_RATE = 0.1;

export const orderService = {
  /** Lấy tất cả đơn cho kitchen queue */
  async listKitchenQueue(user) {
    const where = {
      kitchenStatus: { in: ['PENDING', 'RECEIVED', 'PREPARING', 'READY'] },
      deletedAt: null,
    };
    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId) {
      where.branchId = user.branchId;
    }
    if (user && user.authType === 'device' && user.branchId) {
      where.branchId = user.branchId;
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
    if (!validStatuses.includes(status)) {
      throw new AppError(`Trạng thái bếp không hợp lệ: ${status}`, 400);
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { kitchenStatus: status },
    });

    if (status === 'READY') {
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
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    if (!isAdmin) {
      where.createdBy = user.id;
    }

    if (!isAdmin && user?.branchId) {
      where.branchId = user.branchId;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(mapOrderDetail);
  },

  /** Lấy tất cả đơn pending/preparing cho POS */
  async listActiveOrders(user) {
    const where = { status: { in: ['PENDING', 'PREPARING'] } };
    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId) {
      where.branchId = user.branchId;
    }
    const orders = await orderRepository.findMany(where);
    return orders.map(mapPosOrder);
  },

  /** Order Queue POS - lấy danh sách order queue */
  async listQueueOrders(user, { search, status } = {}) {
    const where = {
      source: 'ORDER_QUEUE_POS',
      status: { in: ['PENDING', 'OPEN', 'PREPARING'] },
      deletedAt: null,
    };
    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId) {
      where.branchId = user.branchId;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { note: { contains: search } },
      ];
    }
    const orders = await orderRepository.findMany(where);
    return orders.map(mapPosOrder);
  },

  /** Tạo Order Queue POS (không gắn bàn) */
  async createQueueOrder(body, user = null) {
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

    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    const profit = subtotal - cost;
    const orderNumber = `ORD-${Date.now()}`;

    const orderData = {
      orderNumber,
      branchId: body.branchId || (user ? user.branchId : undefined),
      posDeviceId: body.posDeviceId,
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

    const order = await orderRepository.create(orderData);
    return { data: mapPosOrder(order), created: true };
  },

  /** Cập nhật Order Queue */
  async updateQueueOrder(id, body, user = null) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && order.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền cập nhật đơn hàng này', 403);
    }

    const updateData = {};
    if (body.status) updateData.status = body.status;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.orderType) updateData.orderType = body.orderType;
    if (body.discount !== undefined) updateData.discount = Number(body.discount);

    if (body.items) {
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

    const updated = await orderRepository.update(id, updateData);
    return mapPosOrder(updated);
  },

  /** Thanh toán Order Queue */
  async completeQueuePayment(id, paymentMethod = 'CASH', user = null) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && order.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền thanh toán đơn hàng này', 403);
    }

    const method = paymentMethod.toUpperCase();
    const updated = await orderRepository.update(id, {
      status: 'COMPLETED',
      paymentMethod: ['CASH', 'CARD', 'QR'].includes(method) ? method : 'CASH',
      completedAt: new Date(),
    });

    await this.deductInventoryForOrder(id, user ? user.id : null);
    return mapPosOrder(updated);
  },

  /** Hủy Order Queue */
  async cancelQueueOrder(id, user = null) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && order.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền hủy đơn hàng này', 403);
    }

    const updated = await orderRepository.update(id, {
      status: 'CANCELLED',
      deletedAt: new Date(),
    });
    return mapPosOrder(updated);
  },

  /** Chi tiết đơn hàng - dùng cho Order Detail view */
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

    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId) {
      where.branchId = user.branchId;
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

    const orderData = {
      orderNumber,
      branchId: body.branchId || (user ? user.branchId : undefined),
      posDeviceId: body.posDeviceId,
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

    return mapPosOrder(order);
  },

  async deleteOrder(id, user) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && order.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền xóa đơn hàng này', 403);
    }
    await orderRepository.delete(id);
  },

   /** Thanh toán - hoàn tất đơn và cập nhật revenue */
   async completeTableOrders(tableNumber, paymentMethod = 'CASH', user = null) {
     const where = {
       tableNumber,
       status: { in: ['PENDING', 'PREPARING'] },
     };
      if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId) {
        where.branchId = user.branchId;
      }
      const orders = await orderRepository.findMany(where);
      if (orders.length === 0) {
        throw new AppError('Không có đơn hàng để thanh toán', 404);
     }

     const method = paymentMethod.toUpperCase();
     const completed = [];
     const userId = user ? user.id : null;

     for (const order of orders) {
       const updated = await orderRepository.update(order.id, {
         status: 'COMPLETED',
         paymentMethod: ['CASH', 'CARD', 'QR'].includes(method) ? method : 'CASH',
         completedAt: new Date(),
       });
       completed.push(mapPosOrder(updated));

       // Deduct inventory when order is COMPLETED
       await this.deductInventoryForOrder(order.id, userId);
     }

      return completed;
   },

   /**
    * Deduct inventory based on order items and their recipes (MenuItemIngredient)
    * Business rule: Only deduct when order.status === COMPLETED
    * Prevents negative inventory and creates InventoryTransaction records
    */
   async deductInventoryForOrder(orderId, userId = null) {
     const order = await orderRepository.findById(orderId);
     if (!order || order.status !== 'COMPLETED') return;

     // Use transaction to ensure atomicity
     await prisma.$transaction(async (tx) => {
       const orderItems = await tx.orderItem.findMany({
         where: { orderId },
         include: { menuItem: true },
       });

       for (const orderItem of orderItems) {
         if (!orderItem.menuItemId) continue;

         // Get recipe for this menu item (MenuItemIngredient)
         const recipes = await tx.menuItemIngredient.findMany({
           where: { menuItemId: orderItem.menuItemId },
           include: { ingredient: true },
         });

         for (const recipe of recipes) {
           // Calculate total ingredient usage: recipe.amount * orderItem.quantity
           const totalUsage = Number(recipe.amount) * orderItem.quantity;

           // Get current ingredient
           const ingredient = await tx.ingredient.findUnique({
             where: { id: recipe.ingredientId },
           });

           if (!ingredient) continue;

           const newQuantity = Number(ingredient.quantity) - totalUsage;

           // Prevent negative inventory
           if (newQuantity < 0) {
             throw new AppError(
               `Không đủ nguyên liệu: ${ingredient.name}. Cần ${totalUsage}, có ${ingredient.quantity}`,
               400
             );
           }

           // Update ingredient quantity
           await tx.ingredient.update({
             where: { id: recipe.ingredientId },
             data: { quantity: newQuantity, lastUpdated: new Date() },
           });

            // Create inventory transaction record (type: OUT)
            await tx.inventoryTransaction.create({
              data: {
                ingredientId: recipe.ingredientId,
                branchId: order.branchId,
                type: 'OUT',
                quantity: totalUsage,
                beforeQuantity: ingredient.quantity,
                afterQuantity: newQuantity,
                note: `Deduction from order ${order.orderNumber}`,
                referenceType: 'ORDER',
                referenceId: orderId,
                createdBy: userId || order.createdBy,
              },
            });
         }
       }
     });
   },
};

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
