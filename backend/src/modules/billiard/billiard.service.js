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

export const billiardService = {
  async createTable({ tableCode, tableName, tableType, capacity = 4, posX = 0, posY = 0 }, user) {
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

      return {
        id: t.id,
        accountId: t.accountId,
        tableCode: t.tableCode,
        tableName: t.tableName,
        capacity: t.capacity,
        tableType: t.tableType,
        posX: t.posX,
        posY: t.posY,
        status: t.status,
        currentSession: session ? {
          id: session.id,
          startTime: session.startTime,
          expectedEndTime: session.expectedEndTime,
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
          tableFee: 0,
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
    const startTime = new Date();
    const durationMinutes = reservation.durationMinutes;
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
          tableFee: 0,
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

    const newExpectedEnd = new Date(session.expectedEndTime.getTime() + additionalMinutes * 60000);
    const newDuration = session.durationMinutes + additionalMinutes;

    return playSessionRepository.update(sessionId, {
      expectedEndTime: newExpectedEnd,
      durationMinutes: newDuration,
    });
  },

  async finishSession(tableId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    const session = await playSessionRepository.findActiveByTableId(tableId);
    if (!session) throw new AppError('Không tìm thấy phiên chơi đang hoạt động', 404);

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      await tx.playSession.update({
        where: { id: session.id },
        data: { status: 'FINISHED', endTime: now },
      });

      await tx.order.updateMany({
        where: { sessionId: session.id, status: { not: 'COMPLETED' } },
        data: { status: 'COMPLETED', completedAt: now },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'AVAILABLE' },
      });

      return { id: session.id, status: 'FINISHED' };
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

  async addOrderItem(orderId, { menuItemId, quantity, note }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) throw new AppError('Không tìm thấy món ăn', 404);

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

  async payOrder(orderId, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, session: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    if (order.paymentStatus === 'PAID') {
      throw new AppError('Đơn hàng đã được thanh toán', 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId,
          amount: order.total,
          method: 'CASH',
          status: 'PAID',
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      if (order.sessionId) {
        await tx.playSession.update({
          where: { id: order.sessionId },
          data: { status: 'FINISHED', endTime: new Date() },
        });
      }

      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      return { id: orderId, paymentStatus: 'PAID' };
    });
  },
};
