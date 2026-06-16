import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { assertBranchAccess, buildBranchWhere } from '../../middlewares/branchScope.js';
import { tableRepository } from '../../repositories/table.repository.js';
import { playSessionRepository } from '../../repositories/playSession.repository.js';
import { reservationRepository } from '../../repositories/reservation.repository.js';

const TABLE_PRIORITY = {
  OCCUPIED_SHORT: 0,
  OCCUPIED: 1,
  RESERVED: 2,
  AVAILABLE: 3,
  CLEANING: 4,
  CHECKING_OUT: 5,
  DISABLED: 6,
};

function sortTablesByPriority(tables) {
  return tables.sort((a, b) => {
    const priorityA = getTablePriority(a);
    const priorityB = getTablePriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.tableCode.localeCompare(b.tableCode);
  });
}

function getTablePriority(table) {
  if (table.status === 'OCCUPIED') {
    if (table.currentSession) {
      const now = new Date();
      const end = new Date(table.currentSession.expectedEndTime);
      const remainingMs = end.getTime() - now.getTime();
      const remainingMin = remainingMs / 60000;
      if (remainingMin <= 15) return TABLE_PRIORITY.OCCUPIED_SHORT;
    }
    return TABLE_PRIORITY.OCCUPIED;
  }
  return TABLE_PRIORITY[table.status] ?? 99;
}

function computePlayCost(hourlyRate, durationMinutes) {
  return Math.round((Number(hourlyRate) * Number(durationMinutes)) / 60);
}

export const billiardService = {
  async createTable({ tableCode, tableName, tableType, capacity = 4, posX = 0, posY = 0, hourlyRate }, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);
    const accountId = user.accountId || user.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);

    const existing = await tableRepository.findByAccountTableCode(accountId, tableCode);
    if (existing) throw new AppError(`Mã bàn "${tableCode}" đã tồn tại`, 409);

    return tableRepository.create({
      accountId,
      tableCode,
      tableName: tableName || null,
      tableType,
      capacity,
      posX,
      posY,
      status: 'AVAILABLE',
      hourlyRate: hourlyRate ?? 0,
    });
  },

  async listTables(user) {
    const where = buildBranchWhere(user, { isActive: true }, 'accountId');
    const tables = await tableRepository.findMany(where);
    if (!Array.isArray(tables)) return [];

    const enriched = await Promise.all(tables.map(async (t) => {
      const session = await playSessionRepository.findActiveByTableId(t.id);
      const reservation = await reservationRepository.findPendingByTableId(t.id);
      const activeOrder = t.orders?.[0] || null;

      const orderItems = activeOrder?.items?.map(item => ({
        id: item.id,
        menuItemId: item.menuItemId,
        inventoryId: item.inventoryId,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        lineTotal: Number(item.total || item.price * item.quantity),
      })) || [];

      const foodTotal = orderItems.reduce((s, i) => s + i.lineTotal, 0);
      const tableFee = session ? Number(session.tableFee) : 0;

      return {
        id: t.id,
        accountId: t.accountId,
        tableCode: t.tableCode,
        tableName: t.tableName,
        capacity: t.capacity,
        tableType: t.tableType,
        posX: t.posX,
        posY: t.posY,
        hourlyRate: t.hourlyRate ? Number(t.hourlyRate) : 0,
        status: t.status,
        currentSession: session ? {
          id: session.id,
          startTime: session.startTime,
          expectedEndTime: session.expectedEndTime,
          endTime: session.endTime,
          durationMinutes: session.durationMinutes,
          tableFee: Number(session.tableFee),
        } : null,
        currentReservation: reservation ? {
          id: reservation.id,
          customerName: reservation.customerName,
          reservationTime: reservation.reservationTime,
          durationMinutes: reservation.durationMinutes,
        } : null,
        currentOrder: activeOrder ? {
          id: activeOrder.id,
          orderNumber: activeOrder.orderNumber,
          status: activeOrder.status,
          total: Number(activeOrder.total || 0),
          itemCount: activeOrder.items
            ? activeOrder.items.reduce((s, i) => s + (i.quantity || 0), 0)
            : 0,
          items: orderItems,
          foodTotal,
          tableFee,
          grandTotal: foodTotal + tableFee,
        } : null,
        isActive: t.isActive,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    }));

    return sortTablesByPriority(enriched);
  },

  async updateLayout(tablePositions, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);
    const accountId = user.accountId || user.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);

    const results = [];
    for (const pos of tablePositions) {
      const table = await tableRepository.findById(pos.id);
      if (!table) throw new AppError(`Không tìm thấy bàn ${pos.id}`, 404);
      assertBranchAccess(table, user, 'bàn');

      const updated = await prisma.table.update({
        where: { id: pos.id },
        data: { posX: pos.posX, posY: pos.posY },
      });
      results.push(updated);
    }
    return results;
  },

  async playNow(tableId, { durationMinutes, customerName, phone }, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    if (table.status !== 'AVAILABLE') {
      throw new AppError('Bàn không ở trạng thái sẵn sàng', 400);
    }

    const accountId = user.accountId || user.id;
    const hourlyRate = Number(table.hourlyRate);
    const tableFee = computePlayCost(hourlyRate, durationMinutes);
    const startTime = new Date();
    const expectedEndTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const result = await prisma.$transaction(async (tx) => {
      const orderNumber = `BLL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const order = await tx.order.create({
        data: {
          accountId,
          createdBy: user.id || accountId,
          orderNumber,
          tableId,
          source: 'BILLIARD',
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          orderType: 'DINE_IN',
          subtotal: 0,
          tax: 0,
          total: 0,
          cost: 0,
          profit: 0,
        },
      });

      const session = await tx.playSession.create({
        data: {
          tableId,
          startTime,
          expectedEndTime,
          durationMinutes,
          tableFee,
          status: 'PLAYING',
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { sessionId: session.id },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      });

      return { session, order };
    });

    return result;
  },

  async reserveTable(tableId, { customerName, phone, reservationTime, durationMinutes, note }, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    if (table.status !== 'AVAILABLE') {
      throw new AppError('Bàn không ở trạng thái sẵn sàng để đặt', 400);
    }

    const accountId = user.accountId || user.id;

    const reservation = await prisma.$transaction(async (tx) => {
      const res = await tx.reservation.create({
        data: {
          tableId,
          branchId: accountId,
          customerName,
          phone,
          reservationTime: new Date(reservationTime),
          durationMinutes: durationMinutes || 60,
          note,
          status: 'PENDING',
        },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'RESERVED' },
      });

      return res;
    });

    return reservation;
  },

  async checkInReservation(tableId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    if (table.status !== 'RESERVED') {
      throw new AppError('Bàn không ở trạng thái đặt trước', 400);
    }

    const reservation = await reservationRepository.findPendingByTableId(tableId);
    if (!reservation) {
      throw new AppError('Không tìm thấy đặt bàn đang chờ', 404);
    }

    const accountId = user.accountId || user.id;
    const hourlyRate = Number(table.hourlyRate);
    const durationMinutes = reservation.durationMinutes;
    const tableFee = computePlayCost(hourlyRate, durationMinutes);
    const startTime = new Date();
    const expectedEndTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const result = await prisma.$transaction(async (tx) => {
      const orderNumber = `BLL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const order = await tx.order.create({
        data: {
          accountId,
          createdBy: user.id || accountId,
          orderNumber,
          tableId,
          source: 'BILLIARD',
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          orderType: 'DINE_IN',
          subtotal: 0,
          tax: 0,
          total: 0,
          cost: 0,
          profit: 0,
        },
      });

      const session = await tx.playSession.create({
        data: {
          tableId,
          startTime,
          expectedEndTime,
          durationMinutes,
          tableFee,
          status: 'PLAYING',
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { sessionId: session.id },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CHECKED_IN' },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      });

      return { session, order, reservation };
    });

    return result;
  },

  async cancelReservation(tableId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    const reservation = await reservationRepository.findPendingByTableId(tableId);
    if (!reservation) {
      throw new AppError('Không tìm thấy đặt bàn đang chờ', 404);
    }

    return prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CANCELLED' },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'AVAILABLE' },
      });

      return { id: reservation.id, status: 'CANCELLED' };
    });
  },

  async getCurrentSession(tableId, user) {
    const session = await playSessionRepository.findActiveByTableId(tableId);
    if (!session) return null;

    const table = await tableRepository.findById(tableId);
    if (table) assertBranchAccess(table, user, 'bàn');

    const now = new Date();
    const end = new Date(session.expectedEndTime);
    const remainingMs = Math.max(0, end.getTime() - now.getTime());
    const remainingMinutes = Math.floor(remainingMs / 60000);

    return {
      id: session.id,
      tableId: session.tableId,
      startTime: session.startTime,
      expectedEndTime: session.expectedEndTime,
      endTime: session.endTime,
      durationMinutes: session.durationMinutes,
      remainingMinutes,
      tableFee: Number(session.tableFee),
      status: session.status,
      order: session.order ? {
        id: session.order.id,
        orderNumber: session.order.orderNumber,
        status: session.order.status,
        total: Number(session.order.total),
        items: session.order.items,
      } : null,
    };
  },

  async extendSession(sessionId, additionalMinutes, user) {
    const session = await playSessionRepository.findById(sessionId);
    if (!session) throw new AppError('Không tìm thấy phiên chơi', 404);

    const table = await tableRepository.findById(session.tableId);
    if (table) assertBranchAccess(table, user, 'bàn');

    if (session.status !== 'PLAYING') {
      throw new AppError('Phiên chơi đã kết thúc', 400);
    }

    const hourlyRate = table ? Number(table.hourlyRate) : 0;
    const newDuration = session.durationMinutes + additionalMinutes;
    const newTableFee = computePlayCost(hourlyRate, newDuration);
    const newExpectedEnd = new Date(session.expectedEndTime.getTime() + additionalMinutes * 60000);

    return playSessionRepository.update(sessionId, {
      expectedEndTime: newExpectedEnd,
      durationMinutes: newDuration,
      tableFee: newTableFee,
    });
  },

  async finishSession(tableId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    const session = await playSessionRepository.findActiveByTableId(tableId);
    if (!session) throw new AppError('Không tìm thấy phiên chơi đang hoạt động', 404);

    const now = new Date();
    const accountId = user.accountId || user.id;
    const userId = user.id || accountId;

    const playingCost = Number(session.tableFee);

    return prisma.$transaction(async (tx) => {
      await tx.playSession.update({
        where: { id: session.id },
        data: { status: 'FINISHED', endTime: now },
      });

      const order = await tx.order.findFirst({
        where: { sessionId: session.id, status: { not: 'COMPLETED' } },
        include: { items: { include: { menuItem: true } } },
      });

      if (order) {
        if (!order.inventoryDeducted) {
          await deductInventoryForOrderTx(tx, order, userId);
          await tx.order.update({
            where: { id: order.id },
            data: { inventoryDeducted: true },
          });
        }

        const grandTotal = Number(order.total) + playingCost;

        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: grandTotal,
            method: 'CASH',
            status: 'PAID',
          },
        });

        const foodDrinkTotal = Number(order.total);

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            paymentMethod: 'CASH',
            completedAt: now,
            total: grandTotal,
            tableName: table.tableName,
            tableCode: table.tableCode,
            tableType: table.tableType,
            sessionStartTime: session.startTime,
            playingDurationMinutes: session.durationMinutes,
            hourlyRate: Number(table.hourlyRate),
            playingCost,
            foodDrinkTotal,
          },
        });
      }

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'AVAILABLE' },
      });

      return { id: session.id, status: 'FINISHED', orderCompleted: !!order, playingCost };
    });
  },

  async getSessionOrder(sessionId, user) {
    const session = await playSessionRepository.findById(sessionId);
    if (!session) throw new AppError('Không tìm thấy phiên chơi', 404);

    const table = await tableRepository.findById(session.tableId);
    if (table) assertBranchAccess(table, user, 'bàn');

    if (!session.order) return null;
    return session.order;
  },

  async addOrderItem(orderId, { menuItemId, inventoryId, quantity, note }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, items: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    // Direct inventory sale (no MenuItem link)
    if (inventoryId && !menuItemId) {
      const ingredient = await prisma.ingredient.findUnique({ where: { id: inventoryId } });
      if (!ingredient) throw new AppError('Không tìm thấy inventory item', 404);
      if (!ingredient.available) throw new AppError('Inventory item không khả dụng', 400);

      // Check for existing order item with same inventoryId -> merge
      const existingItem = order.items.find(i => i.inventoryId === inventoryId);
      if (existingItem) {
        const newQty = existingItem.quantity + quantity;
        const newTotal = Number(existingItem.price) * newQty;
        const totalDiff = newTotal - Number(existingItem.total);

        return prisma.$transaction(async (tx) => {
          const updated = await tx.orderItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQty, total: newTotal },
          });

          await tx.order.update({
            where: { id: orderId },
            data: {
              subtotal: { increment: totalDiff },
              total: { increment: totalDiff },
            },
          });

          return updated;
        });
      }

      const currentStock = Number(ingredient.quantity);
      if (currentStock <= 0) throw new AppError('Inventory item đã hết hàng', 400);

      const total = Number(ingredient.price) * quantity;
      const cost = 0;

      return prisma.$transaction(async (tx) => {
        const item = await tx.orderItem.create({
          data: {
            orderId,
            inventoryId,
            name: ingredient.name,
            price: ingredient.price,
            cost: 0,
            quantity,
            total,
          },
        });

        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: { increment: total },
            total: { increment: total },
            cost: { increment: cost },
            profit: { increment: total - cost },
          },
        });

        return item;
      });
    }

    // MenuItem flow (existing)
    const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) throw new AppError('Không tìm thấy món ăn', 404);

    const existingItem = order.items.find(i => i.menuItemId === menuItemId);

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      const newTotal = Number(menuItem.price) * newQty;
      const prevTotal = Number(existingItem.total);
      const totalDiff = newTotal - prevTotal;
      const costDiff = Number(menuItem.cost) * quantity;

      return prisma.$transaction(async (tx) => {
        const updated = await tx.orderItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQty, total: newTotal },
        });

        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: { increment: totalDiff },
            total: { increment: totalDiff },
            cost: { increment: costDiff },
            profit: { increment: totalDiff - costDiff },
          },
        });

        return updated;
      });
    }

    const total = Number(menuItem.price) * quantity;
    const cost = Number(menuItem.cost) * quantity;

    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.create({
        data: {
          orderId,
          menuItemId,
          name: menuItem.name,
          price: menuItem.price,
          cost: menuItem.cost,
          quantity,
          total,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: { increment: total },
          total: { increment: total },
          cost: { increment: cost },
          profit: { increment: total - cost },
        },
      });

      return item;
    });
  },

  async batchAddOrderItems(orderId, { items }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, items: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    return prisma.$transaction(async (tx) => {
      let subtotalDiff = 0;
      let totalDiff = 0;

      for (const { inventoryId, quantity } of items) {
        const ingredient = await tx.ingredient.findUnique({ where: { id: inventoryId } });
        if (!ingredient) throw new AppError(`Không tìm thấy inventory item ${inventoryId}`, 404);
        if (!ingredient.available) throw new AppError(`Inventory item ${inventoryId} không khả dụng`, 400);

        const existingItem = order.items.find(i => i.inventoryId === inventoryId);

        if (existingItem) {
          const newQty = existingItem.quantity + quantity;
          const newTotal = Number(existingItem.price) * newQty;
          const itemDiff = newTotal - Number(existingItem.total);

          await tx.orderItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQty, total: newTotal },
          });

          subtotalDiff += itemDiff;
          totalDiff += itemDiff;
        } else {
          const currentStock = Number(ingredient.quantity);
          if (currentStock <= 0) throw new AppError(`Inventory item ${inventoryId} đã hết hàng`, 400);

          const total = Number(ingredient.price) * quantity;

          await tx.orderItem.create({
            data: {
              orderId,
              inventoryId,
              name: ingredient.name,
              price: ingredient.price,
              cost: 0,
              quantity,
              total,
            },
          });

          subtotalDiff += total;
          totalDiff += total;
        }
      }

      if (subtotalDiff !== 0) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: { increment: subtotalDiff },
            total: { increment: totalDiff },
          },
        });
      }

      // Return updated order summary
      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      const session = await tx.playSession.findFirst({
        where: {
          status: 'PLAYING',
          order: { id: orderId },
        },
      });

      const mappedItems = (updatedOrder?.items || []).map(item => ({
        id: item.id,
        menuItemId: item.menuItemId,
        inventoryId: item.inventoryId,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        lineTotal: Number(item.total || item.price * item.quantity),
      }));

      const foodTotal = mappedItems.reduce((s, i) => s + i.lineTotal, 0);

      const tableRec = order.table;
      const storedTableFee = session ? Number(session.tableFee) : 0;
      const hourlyRate = tableRec ? Number(tableRec.hourlyRate) : 0;

      return {
        sessionId: session?.id || null,
        orderId: updatedOrder?.id || null,
        orderNumber: updatedOrder?.orderNumber || null,
        items: mappedItems,
        foodTotal,
        playingCost: storedTableFee,
        hourlyRate,
        tableFee: storedTableFee,
        serviceCharge: updatedOrder ? Number(updatedOrder.serviceCharge || 0) : 0,
        tax: updatedOrder ? Number(updatedOrder.tax || 0) : 0,
        grandTotal: foodTotal + storedTableFee,
        startTime: session?.startTime || null,
        tableStatus: tableRec?.status || 'OCCUPIED',
      };
    });
  },

  async updateOrderItem(orderId, itemId, { quantity, note }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    const existingItem = await prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!existingItem || existingItem.orderId !== orderId) {
      throw new AppError('Không tìm thấy món trong đơn hàng', 404);
    }

    const qtyDiff = quantity - existingItem.quantity;
    const newTotal = Number(existingItem.price) * quantity;
    const totalDiff = newTotal - Number(existingItem.total);
    const costDiff = Number(existingItem.cost) * qtyDiff;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: { quantity, total: newTotal },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: { increment: totalDiff },
          total: { increment: totalDiff },
          cost: { increment: costDiff },
          profit: { increment: totalDiff - costDiff },
        },
      });

      return updated;
    });
  },

  async removeOrderItem(orderId, itemId, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    const existingItem = await prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!existingItem || existingItem.orderId !== orderId) {
      throw new AppError('Không tìm thấy món trong đơn hàng', 404);
    }

    return prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: { decrement: Number(existingItem.total) },
          total: { decrement: Number(existingItem.total) },
          cost: { decrement: Number(existingItem.cost) * existingItem.quantity },
          profit: { decrement: Number(existingItem.total) - Number(existingItem.cost) * existingItem.quantity },
        },
      });

      return { id: itemId, deleted: true };
    });
  },

  async getTableOrderSummary(tableId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    const session = await playSessionRepository.findActiveByTableId(tableId);
    const order = session?.order || null;

    const items = order?.items?.map(item => ({
      id: item.id,
      menuItemId: item.menuItemId,
      inventoryId: item.inventoryId,
      name: item.name,
      price: Number(item.price),
      quantity: item.quantity,
      lineTotal: Number(item.total || item.price * item.quantity),
    })) || [];

    const foodTotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const storedTableFee = session ? Number(session.tableFee) : 0;
    const serviceCharge = order ? Number(order.serviceCharge || 0) : 0;
    const tax = order ? Number(order.tax || 0) : 0;
    const grandTotal = storedTableFee + foodTotal + serviceCharge + tax;

    return {
      sessionId: session?.id || null,
      orderId: order?.id || null,
      orderNumber: order?.orderNumber || null,
      items,
      foodTotal,
      tableFee: storedTableFee,
      playingCost: storedTableFee,
      hourlyRate: Number(table.hourlyRate),
      serviceCharge,
      tax,
      grandTotal,
      startTime: session?.startTime || null,
      tableStatus: table.status,
    };
  },

  async payOrder(orderId, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, session: true, items: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    if (order.paymentStatus === 'PAID') {
      throw new AppError('Đơn hàng đã được thanh toán', 400);
    }

    const userId = user?.id || user?.accountId || order.createdBy;
    const now = new Date();

    const playingCost = order.session ? Number(order.session.tableFee) : 0;

    return prisma.$transaction(async (tx) => {
      const totalWithPlaying = Number(order.total) + playingCost;

      await tx.payment.create({
        data: {
          orderId,
          amount: totalWithPlaying,
          method: 'CASH',
          status: 'PAID',
        },
      });

      await deductInventoryForOrderTx(tx, order, userId);

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          completedAt: now,
          inventoryDeducted: true,
        },
      });

      if (order.sessionId) {
        await tx.playSession.update({
          where: { id: order.sessionId },
          data: { status: 'FINISHED', endTime: now },
        });
      }

      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      return { id: orderId, paymentStatus: 'PAID', playingCost };
    });
  },
};

/**
 * Deduct inventory for order items inside a Prisma transaction.
 * Matches the logic from order.service.js.
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
      continue;
    }

    // MenuItem-based deduction (existing recipe flow)
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
