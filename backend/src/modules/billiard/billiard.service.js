import prisma from '../../prisma/client.js';
import { PlaySessionStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError.js';
import { assertBranchAccess, buildBranchWhere } from '../../middlewares/branchScope.js';
import { tableRepository } from '../../repositories/table.repository.js';
import { playSessionRepository } from '../../repositories/playSession.repository.js';
import { reservationRepository } from '../../repositories/reservation.repository.js';
import { rectsOverlap, findAvailablePosition } from '../../utils/tableOverlap.js';
import { consumeIngredientBatchesFEFO } from '../../utils/inventoryBatches.js';

function computeElapsedMinutes(startTime) {
  if (!startTime) return 0;
  return Math.floor((Date.now() - new Date(startTime).getTime()) / 60000);
}

function getAccountId(user) {
  return user?.accountId || user?.id || null;
}

const OPEN_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'];

function buildOpenOrderWhere(tableId, accountId) {
  return {
    tableId,
    ...(accountId ? { accountId } : {}),
    source: 'RESTAURANT',
    status: { in: OPEN_ORDER_STATUSES },
    paymentStatus: { not: 'PAID' },
    deletedAt: null,
  };
}

function mapOrderSummary(order) {
  if (!order) return null;

  const items = (order.items || []).map(item => ({
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.name,
    price: Number(item.price),
    quantity: item.quantity,
    lineTotal: Number(item.total || item.price * item.quantity),
  }));

  const foodTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const startTime = order.id;
  const elapsedMinutes = computeElapsedMinutes(startTime);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    items,
    foodTotal,
    serviceCharge: Number(order.serviceCharge || 0),
    tax: Number(order.tax || 0),
    discount: Number(order.discount || 0),
    grandTotal: Number(order.total || foodTotal),
    guestCount: order.guestCount || 1,
    note: order.note,
    startTime,
    elapsedMinutes,
    mergedTableIds: order.mergedTableIds,
  };
}

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
  async createTable({ tableCode, tableName, tableType, capacity = 4, posX = 1, posY = 1, hourlyRate, width, height }, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);
    const accountId = user.accountId || user.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);

    const existing = await tableRepository.findByAccountTableCode(accountId, tableCode);
    if (existing) throw new AppError(`Mã bàn "${tableCode}" đã tồn tại`, 409);

    const allTables = await prisma.table.findMany({
      where: { accountId, isActive: true, mode: 'BILLIARD', id: { not: undefined } },
      select: { id: true, posX: true, posY: true },
    });

    const reqWidth = width ? Number(width) : 10;
    const reqHeight = height ? Number(height) : 12;
    const candidateRect = { posX, posY, width: reqWidth, height: reqHeight };
    const isOverlap = allTables.length > 0 && allTables.some(t => rectsOverlap(candidateRect, t));

    let finalPosX = posX;
    let finalPosY = posY;

    if (isOverlap) {
      const position = findAvailablePosition(allTables, reqWidth, reqHeight);
      finalPosX = position.x;
      finalPosY = position.y;
    }

    const VALID_TABLE_TYPES = ['POOL', 'SNOOKER', 'VIP'];
    const finalTableType = VALID_TABLE_TYPES.includes(tableType) ? tableType : 'POOL';

    return tableRepository.create({
      accountId,
      tableCode,
      tableName: tableName || null,
      mode: 'BILLIARD',
      tableType: finalTableType,
      capacity,
      posX: finalPosX,
      posY: finalPosY,
      status: 'AVAILABLE',
      hourlyRate: hourlyRate ?? 0,
    });
  },

  async listTables(user) {
    const where = buildBranchWhere(user, { isActive: true, mode: 'BILLIARD' }, 'accountId');
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
        mode: t.mode,
        posX: t.posX,
        posY: t.posY,
        hourlyRate: t.hourlyRate ? Number(t.hourlyRate) : 0,
        status: t.status,
        currentSession: session ? {
          id: session.id,
          status: session.status,
          startTime: session.startTime,
          expectedEndTime: session.expectedEndTime,
          endTime: session.endTime,
          durationMinutes: session.durationMinutes,
          tableFee: Number(session.tableFee),
        } : null,
        currentReservation: reservation ? {
          id: reservation.id,
          customerName: reservation.customerName,
          phone: reservation.phone,
          reservationTime: reservation.reservationTime,
          durationMinutes: reservation.durationMinutes,
          note: reservation.note,
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

    const allTables = await prisma.table.findMany({
      where: { accountId, isActive: true, mode: 'BILLIARD' },
      select: { id: true, tableCode: true, posX: true, posY: true },
    });

    const results = [];
    const positionsMap = {};
    for (const t of allTables) {
      positionsMap[t.id] = t;
    }

    for (const pos of tablePositions) {
      const table = await tableRepository.findById(pos.id);
      if (!table) throw new AppError(`Không tìm thấy bàn ${pos.id}`, 404);
      if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
      assertBranchAccess(table, user, 'bàn');

      // Remove current table from positionsMap so it never overlaps with itself
      delete positionsMap[pos.id];

      const newRect = { posX: pos.posX, posY: pos.posY, width: pos.width, height: pos.height };
      const overlap = Object.values(positionsMap).find(other => {
        const isOverlap = rectsOverlap(newRect, other);
        return isOverlap;
      });
      if (overlap) {
        throw new AppError(`Table "${table.tableCode}" overlaps with table "${overlap.tableCode}"`, 400);
      }

      positionsMap[pos.id] = { id: pos.id, tableCode: table.tableCode, posX: pos.posX, posY: pos.posY };

      const updated = await prisma.table.update({
        where: { id: pos.id },
        data: { posX: pos.posX, posY: pos.posY },
      });
      results.push(updated);
    }
    return results;
  },

  async updateRestaurantTableLayout(tablePositions, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);
    const accountId = user.accountId || user.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);

    const allTables = await prisma.table.findMany({
      where: { accountId, isActive: true, mode: 'RESTAURANT' },
      select: { id: true, tableCode: true, posX: true, posY: true },
    });

    const results = [];
    const positionsMap = {};
    for (const t of allTables) {
      positionsMap[t.id] = t;
    }

    for (const pos of tablePositions) {
      const table = await tableRepository.findById(pos.id);
      if (!table) throw new AppError(`Không tìm thấy bàn ${pos.id}`, 404);
      if (table.mode !== 'RESTAURANT') {
        console.error('INVALID TABLE MODE', {
          tableId: table.id,
          tableCode: table.tableCode,
          mode: table.mode,
        });
        throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
      }
      assertBranchAccess(table, user, 'bàn');

      delete positionsMap[pos.id];

      const newRect = { posX: pos.posX, posY: pos.posY, width: pos.width, height: pos.height };
      const overlap = Object.values(positionsMap).find(other => {
        const isOverlap = rectsOverlap(newRect, other);
        return isOverlap;
      });
      if (overlap) {
        throw new AppError(`Bàn "${table.tableCode}" bị chồng lên với bàn "${overlap.tableCode}"`, 400);
      }

      positionsMap[pos.id] = { id: pos.id, tableCode: table.tableCode, posX: pos.posX, posY: pos.posY };

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
    if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
    assertBranchAccess(table, user, 'bàn');

    if (table.status !== 'AVAILABLE') {
      throw new AppError('Bàn không ở trạng thái sẵn sàng', 400);
    }

    const hourlyRate = Number(table.hourlyRate);
    const now = new Date();
    const effectiveDuration = durationMinutes && durationMinutes > 0 ? durationMinutes : 60;

    const startTime = now;
    const expectedEndTime = new Date(now.getTime() + effectiveDuration * 60000);
    const tableFee = computePlayCost(hourlyRate, effectiveDuration);
    const status = PlaySessionStatus.PLAYING;

    const data = {
      tableId,
      startTime,
      expectedEndTime,
      durationMinutes: effectiveDuration,
      tableFee,
      status,
    };
    const result = await prisma.$transaction(async (tx) => {
      const orderNumber = `BLL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const accountId = user.accountId || user.id;

      const order = await tx.order.create({
        data: {
          accountId,
          createdBy: accountId,
          orderNumber,
          tableId,
          source: 'BILLIARD',
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          orderType: 'DINE_IN',
          tableName: table.tableName,
          tableCode: table.tableCode,
          subtotal: 0,
          tax: 0,
          total: 0,
          cost: 0,
          profit: 0,
        },
      });
      const session = await tx.playSession.create({ data });

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

  async reserveTable(tableId, { customerName, phone, reservationDate, note }, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
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
          reservationTime: reservationDate ? new Date(reservationDate) : new Date(),
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
    if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
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
    const durationMinutes = reservation.durationMinutes || 60;
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
          status: PlaySessionStatus.PLAYING,
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
    if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
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
    if (table) {
      if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
      assertBranchAccess(table, user, 'bàn');
    }

    const now = new Date();
    let remainingMinutes = 0;
    if (session.expectedEndTime) {
      const end = new Date(session.expectedEndTime);
      remainingMinutes = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
    }

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

  async finishSession(tableId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
    assertBranchAccess(table, user, 'bàn');

    const session = await playSessionRepository.findActiveByTableId(tableId);
    if (!session) throw new AppError('Không tìm thấy phiên chơi đang hoạt động', 404);

    const now = new Date();
    const accountId = user.accountId || user.id;
    const userId = user.accountId || user.id;

    const startedAt = session.startTime ? new Date(session.startTime).getTime() : now.getTime();
    const elapsedMinutes = Math.ceil((now.getTime() - startedAt) / 60000);
    const hourlyRate = Number(table.hourlyRate);
    const playingCost = computePlayCost(hourlyRate, elapsedMinutes);

    return prisma.$transaction(async (tx) => {
      await tx.playSession.update({
        where: { id: session.id },
        data: {
          status: PlaySessionStatus.COMPLETED,
          endTime: now,
          durationMinutes: elapsedMinutes,
          tableFee: playingCost,
        },
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

        const foodDrinkTotal = Number(order.total);
        const grandTotal = foodDrinkTotal + playingCost;

        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: grandTotal,
            method: 'CASH',
            status: 'PAID',
          },
        });

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
            sessionStartTime: session.startTime || now,
            playingDurationMinutes: elapsedMinutes,
            hourlyRate,
            playingCost,
            foodDrinkTotal,
          },
        });
      }

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'AVAILABLE' },
      });

      return { id: session.id, status: PlaySessionStatus.COMPLETED, orderCompleted: !!order, playingCost };
    });
  },

  async getSessionOrder(sessionId, user) {
    const session = await playSessionRepository.findById(sessionId);
    if (!session) throw new AppError('Không tìm thấy phiên chơi', 404);

    const table = await tableRepository.findById(session.tableId);
    if (table) {
      if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
      assertBranchAccess(table, user, 'bàn');
    }

    if (!session.order) return null;
    return session.order;
  },

  async addOrderItem(orderId, { menuItemId, inventoryId, quantity, note }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, items: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
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
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    const ingredientMap = {};
    for (const { inventoryId } of items) {
      if (!ingredientMap[inventoryId]) {
        ingredientMap[inventoryId] = await prisma.ingredient.findUnique({ where: { id: inventoryId } });
        if (!ingredientMap[inventoryId]) throw new AppError(`Không tìm thấy inventory item ${inventoryId}`, 404);
        if (!ingredientMap[inventoryId].available) throw new AppError(`Inventory item ${inventoryId} không khả dụng`, 400);
      }
    }

    await prisma.$transaction(async (tx) => {
      let subtotalDiff = 0;
      let totalDiff = 0;

      for (const { inventoryId, quantity } of items) {
        const ingredient = ingredientMap[inventoryId];

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
    });

    // Build response outside transaction
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    const session = await prisma.playSession.findFirst({
      where: {
        status: PlaySessionStatus.PLAYING,
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
  },

  async updateOrderItem(orderId, itemId, { quantity, note }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
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
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
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
    if (table.mode !== 'BILLIARD') throw new AppError('Bàn này không thuộc hệ thống bi-a', 400);
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

  async payOrder(orderId, { paymentMethod = 'CASH' } = {}, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, session: true, items: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
    if (order.table) assertBranchAccess(order.table, user, 'bàn');

    if (order.paymentStatus === 'PAID') {
      throw new AppError('Đơn hàng đã được thanh toán', 400);
    }

    const userId = user?.accountId || user?.id || order.createdBy;
    const now = new Date();
    const method = paymentMethod || 'CASH';

    return prisma.$transaction(async (tx) => {
      if (order.table?.mode === 'BILLIARD') {
        const playingCost = order.session ? Number(order.session.tableFee) : 0;
        const totalWithPlaying = Number(order.total) + playingCost;

        await tx.payment.create({
          data: { orderId, amount: totalWithPlaying, method, status: 'PAID' },
        });

        await deductInventoryForOrderTx(tx, order, userId);

        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID', status: 'COMPLETED', completedAt: now, inventoryDeducted: true },
        });

        if (order.sessionId) {
          await tx.playSession.update({
            where: { id: order.sessionId },
            data: { status: PlaySessionStatus.COMPLETED, endTime: now },
          });
        }

        if (order.tableId) {
          await tx.table.update({
            where: { id: order.tableId },
            data: { status: 'AVAILABLE' },
          });
        }

        return { id: orderId, paymentStatus: 'PAID', playingCost, method };
      }

      // RESTAURANT payment
      const total = Number(order.total);

      await tx.payment.create({
        data: { orderId, amount: total, method, status: 'PAID' },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID', status: 'COMPLETED', completedAt: now },
      });

      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE', isMerged: false, mergedIntoTableId: null },
        });
      }

      if (order.mergedTableIds && Array.isArray(order.mergedTableIds)) {
        for (const mergedId of order.mergedTableIds) {
          await tx.table.update({
            where: { id: mergedId },
            data: { status: 'AVAILABLE', isMerged: false, mergedIntoTableId: null },
          });
        }
      }

      return { id: orderId, paymentStatus: 'PAID', method };
    });
  },

  // ==================== RESTAURANT-SPECIFIC OPERATIONS ====================

  async listRestaurantTables(user) {
    const accountId = getAccountId(user);
    const where = buildBranchWhere(user, { isActive: true, mode: 'RESTAURANT' }, 'accountId');
    const tables = await tableRepository.findMany(where);
    if (!Array.isArray(tables)) return [];

    const enriched = await Promise.all(tables.map(async (t) => {
      const activeOrder = await prisma.order.findFirst({
        where: {
          tableId: t.id,
          ...(accountId ? { accountId } : {}),
          source: 'RESTAURANT',
          status: { in: OPEN_ORDER_STATUSES },
          paymentStatus: { not: 'PAID' },
          deletedAt: null,
        },
        include: {
          items: { orderBy: { id: 'asc' }, select: { id: true, menuItemId: true, name: true, price: true, quantity: true, total: true } },
        },
        orderBy: { id: 'desc' },
      });

      const startTime = activeOrder?.id || null;
      const elapsedMinutes = computeElapsedMinutes(startTime);

      return {
        id: t.id,
        accountId: t.accountId,
        tableCode: t.tableCode,
        tableName: t.tableName,
        capacity: t.capacity,
        mode: t.mode,
        posX: t.posX,
        posY: t.posY,
        status: activeOrder && t.status !== 'RESERVED' ? 'OCCUPIED' : (!activeOrder && t.status === 'OCCUPIED' ? 'AVAILABLE' : t.status),
        isMerged: t.isMerged,
        mergedIntoTableId: t.mergedIntoTableId,
        currentOrder: activeOrder ? mapOrderSummary(activeOrder) : null,
        isActive: t.isActive,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    }));

    return enriched;
  },

  async createRestaurantTable(data, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);
    const accountId = user.accountId || user.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);

    const existing = await tableRepository.findByAccountTableCode(accountId, data.tableCode);
    if (existing) throw new AppError(`Mã bàn "${data.tableCode}" đã tồn tại`, 409);

    const allTables = await prisma.table.findMany({
      where: { accountId, isActive: true, mode: 'RESTAURANT' },
      select: { id: true, tableCode: true, posX: true, posY: true },
    });

    const reqWidth = data.width ? Number(data.width) : 10;
    const reqHeight = data.height ? Number(data.height) : 12;
    const reqPosX = Number(data.posX) || 1;
    const reqPosY = Number(data.posY) || 1;

    const candidateRect = { posX: reqPosX, posY: reqPosY, width: reqWidth, height: reqHeight };
    const isOverlap = allTables.length > 0 && allTables.some(t => rectsOverlap(candidateRect, t));

    let posX = reqPosX;
    let posY = reqPosY;

    if (isOverlap) {
      const position = findAvailablePosition(allTables, reqWidth, reqHeight);
      posX = position.x;
      posY = position.y;
    }

    return tableRepository.create({
      accountId,
      tableCode: data.tableCode,
      tableName: data.tableName || null,
      mode: 'RESTAURANT',
      capacity: data.capacity || 4,
      posX,
      posY,
      status: 'AVAILABLE',
    });
  },

  async openOrderForTable(tableId, { guestCount, note }, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    if (table.mode !== 'RESTAURANT') throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(table, user, 'bàn');

    const accountId = getAccountId(user);

    const existingOrder = await prisma.order.findFirst({
      where: buildOpenOrderWhere(tableId, accountId),
      include: { items: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'desc' },
    });

    if (existingOrder) return mapOrderSummary(existingOrder);

    if (table.status === 'OCCUPIED') {
      throw new AppError('Bàn này đã có đơn hàng đang mở', 400);
    }

    const orderId = await prisma.$transaction(async (tx) => {
      const existingInTx = await tx.order.findFirst({
        where: buildOpenOrderWhere(tableId, accountId),
        include: { items: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'desc' },
      });

      if (existingInTx) return existingInTx.id;

      const orderNumber = `TBL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const order = await tx.order.create({
        data: {
          accountId,
          createdBy: user.id || accountId,
          orderNumber,
          tableId,
          source: 'RESTAURANT',
          tableName: table.tableName,
          tableCode: table.tableCode,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          orderType: 'DINE_IN',
          subtotal: 0,
          total: 0,
          cost: 0,
          profit: 0,
          guestCount: guestCount || 1,
          note: note || null,
        },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      });

      return order.id;
    });

    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { id: 'asc' } } },
    });

    return mapOrderSummary(fullOrder);
  },

  async getTableOrder(tableId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    if (table.mode !== 'RESTAURANT') throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(table, user, 'bàn');

    const accountId = getAccountId(user);
    const order = await prisma.order.findFirst({
      where: buildOpenOrderWhere(tableId, accountId),
      include: { items: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'desc' },
    });

    if (!order) return null;
    return mapOrderSummary(order);
  },

  async transferOrder(tableId, { targetTableId }, user) {
    const sourceTable = await tableRepository.findById(tableId);
    if (!sourceTable) throw new AppError('Không tìm thấy bàn nguồn', 404);
    if (sourceTable.mode !== 'RESTAURANT') throw new AppError('Bàn nguồn không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(sourceTable, user, 'bàn');

    const targetTable = await tableRepository.findById(targetTableId);
    if (!targetTable) throw new AppError('Không tìm thấy bàn đích', 404);
    if (targetTable.mode !== 'RESTAURANT') throw new AppError('Bàn đích không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(targetTable, user, 'bàn');

    if (targetTable.status === 'OCCUPIED') {
      throw new AppError('Bàn đích đang có khách', 400);
    }

    const activeOrder = await prisma.order.findFirst({
      where: {
        tableId,
        status: { in: OPEN_ORDER_STATUSES },
        deletedAt: null,
      },
      orderBy: { id: 'desc' },
    });

    if (!activeOrder) {
      throw new AppError('Bàn nguồn không có đơn hàng nào để chuyển', 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: activeOrder.id },
        data: { tableId: targetTableId },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'AVAILABLE' },
      });

      await tx.table.update({
        where: { id: targetTableId },
        data: { status: 'OCCUPIED' },
      });

      return { orderId: activeOrder.id, fromTableId: tableId, toTableId: targetTableId };
    });
  },

  async mergeTables(tableId, { targetTableId }, user) {
    const sourceTable = await tableRepository.findById(tableId);
    if (!sourceTable) throw new AppError('Không tìm thấy bàn nguồn', 404);
    if (sourceTable.mode !== 'RESTAURANT') throw new AppError('Bàn nguồn không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(sourceTable, user, 'bàn');

    const targetTable = await tableRepository.findById(targetTableId);
    if (!targetTable) throw new AppError('Không tìm thấy bàn đích', 404);
    if (targetTable.mode !== 'RESTAURANT') throw new AppError('Bàn đích không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(targetTable, user, 'bàn');

    const sourceOrder = await prisma.order.findFirst({
      where: { tableId, status: { in: OPEN_ORDER_STATUSES }, deletedAt: null },
      include: { items: true },
      orderBy: { id: 'desc' },
    });

    if (!sourceOrder) throw new AppError('Bàn nguồn không có đơn hàng', 400);

    const targetOrder = await prisma.order.findFirst({
      where: { tableId: targetTableId, status: { in: OPEN_ORDER_STATUSES }, deletedAt: null },
      include: { items: true },
      orderBy: { id: 'desc' },
    });

    if (!targetOrder) throw new AppError('Bàn đích không có đơn hàng', 400);
    if (sourceOrder.id === targetOrder.id) throw new AppError('Không thể gộp bàn với chính nó', 400);

    return prisma.$transaction(async (tx) => {
      let totalDiff = 0;
      let costDiff = 0;

      for (const item of sourceOrder.items) {
        const existingItem = targetOrder.items.find(i => i.menuItemId === item.menuItemId);
        if (existingItem) {
          const newQty = existingItem.quantity + item.quantity;
          const newTotal = Number(existingItem.price) * newQty;
          await tx.orderItem.update({ where: { id: existingItem.id }, data: { quantity: newQty, total: newTotal } });
          totalDiff += newTotal - Number(existingItem.total);
        } else {
          await tx.orderItem.update({ where: { id: item.id }, data: { orderId: targetOrder.id } });
          totalDiff += Number(item.total);
          costDiff += Number(item.cost) * item.quantity;
        }
      }

      if (totalDiff !== 0) {
        await tx.order.update({
          where: { id: targetOrder.id },
          data: { subtotal: { increment: totalDiff }, total: { increment: totalDiff }, cost: { increment: costDiff }, profit: { increment: totalDiff - costDiff } },
        });
      }

      const mergedIds = [...(Array.isArray(targetOrder.mergedTableIds) ? targetOrder.mergedTableIds : []), tableId];
      await tx.order.update({ where: { id: targetOrder.id }, data: { mergedTableIds: mergedIds } });

      await tx.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED', isMerged: true, mergedIntoTableId: targetTableId } });

      return { mergedIntoOrderId: targetOrder.id, fromTableId: tableId, toTableId: targetTableId };
    });
  },

  async splitOrder(tableId, { targetTableId, items }, user) {
    const sourceTable = await tableRepository.findById(tableId);
    if (!sourceTable) throw new AppError('Không tìm thấy bàn nguồn', 404);
    if (sourceTable.mode !== 'RESTAURANT') throw new AppError('Bàn nguồn không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(sourceTable, user, 'bàn');

    const targetTable = await tableRepository.findById(targetTableId);
    if (!targetTable) throw new AppError('Không tìm thấy bàn đích', 404);
    if (targetTable.mode !== 'RESTAURANT') throw new AppError('Bàn đích không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(targetTable, user, 'bàn');

    if (targetTable.status === 'OCCUPIED') throw new AppError('Bàn đích đang có khách', 400);

    const sourceOrder = await prisma.order.findFirst({
      where: { tableId, status: { in: OPEN_ORDER_STATUSES }, deletedAt: null },
      include: { items: true },
      orderBy: { id: 'desc' },
    });

    if (!sourceOrder) throw new AppError('Bàn nguồn không có đơn hàng', 400);

    const accountId = getAccountId(user);

    return prisma.$transaction(async (tx) => {
      const orderNumber = `TBL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const targetOrder = await tx.order.create({
        data: {
          accountId,
          createdBy: user.id || accountId,
          orderNumber,
          tableId: targetTableId,
          source: 'RESTAURANT',
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          orderType: 'DINE_IN',
          subtotal: 0, total: 0, cost: 0, profit: 0,
          guestCount: 1,
        },
      });

      let movedTotal = 0, movedCost = 0, movedProfit = 0;

      for (const splitItem of items) {
        const sourceItem = sourceOrder.items.find(i => i.id === splitItem.itemId);
        if (!sourceItem) throw new AppError(`Không tìm thấy món ${splitItem.itemId}`, 404);

        const splitQty = Math.min(splitItem.quantity, sourceItem.quantity);
        if (splitQty <= 0) continue;

        const itemTotal = Number(sourceItem.price) * splitQty;
        const itemCost = Number(sourceItem.cost) * splitQty;

        await tx.orderItem.create({
          data: {
            orderId: targetOrder.id, menuItemId: sourceItem.menuItemId,
            name: sourceItem.name, price: sourceItem.price, cost: sourceItem.cost,
            quantity: splitQty, total: itemTotal,
          },
        });

        movedTotal += itemTotal; movedCost += itemCost; movedProfit += itemTotal - itemCost;

        const remainingQty = sourceItem.quantity - splitQty;
        if (remainingQty <= 0) {
          await tx.orderItem.delete({ where: { id: sourceItem.id } });
        } else {
          const newSourceTotal = Number(sourceItem.price) * remainingQty;
          await tx.orderItem.update({ where: { id: sourceItem.id }, data: { quantity: remainingQty, total: newSourceTotal } });
        }
      }

      if (movedTotal > 0) {
        await tx.order.update({ where: { id: targetOrder.id }, data: { subtotal: { increment: movedTotal }, total: { increment: movedTotal }, cost: { increment: movedCost }, profit: { increment: movedProfit } } });
        await tx.order.update({ where: { id: sourceOrder.id }, data: { subtotal: { decrement: movedTotal }, total: { decrement: movedTotal }, cost: { decrement: movedCost }, profit: { decrement: movedProfit } } });
      }

      await tx.table.update({ where: { id: targetTableId }, data: { status: 'OCCUPIED' } });

      const remainingItems = await tx.orderItem.count({ where: { orderId: sourceOrder.id } });
      if (remainingItems === 0) {
        await tx.order.update({ where: { id: sourceOrder.id }, data: { status: 'CANCELLED' } });
        await tx.table.update({ where: { id: tableId }, data: { status: 'AVAILABLE' } });
      }

      return { sourceOrderId: sourceOrder.id, targetOrderId: targetOrder.id, movedTotal };
    });
  },

  async updateGuestCount(tableId, guestCount, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    if (table.mode !== 'RESTAURANT') throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(table, user, 'bàn');

    const activeOrder = await prisma.order.findFirst({
      where: { tableId, status: { in: OPEN_ORDER_STATUSES }, deletedAt: null },
      orderBy: { id: 'desc' },
    });

    if (!activeOrder) throw new AppError('Bàn này không có đơn hàng đang mở', 400);

    return prisma.order.update({ where: { id: activeOrder.id }, data: { guestCount } });
  },

  async updateOrderNote(orderId, note, user) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { table: true } });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = getAccountId(user);
      if (accountId && order.accountId !== accountId) throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
    }
    if (order.table) {
      if (order.table.mode !== 'RESTAURANT') throw new AppError('Đơn hàng này không thuộc hệ thống nhà hàng', 400);
      assertBranchAccess(order.table, user, 'bàn');
    }

    return prisma.order.update({ where: { id: orderId }, data: { note } });
  },

  async updateRestaurantTable(tableId, data, user) {
    const existing = await tableRepository.findById(tableId);
    if (!existing) throw new AppError('Không tìm thấy bàn', 404);
    if (existing.mode !== 'RESTAURANT') throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(existing, user, 'bàn');

    if (data.tableCode && data.tableCode !== existing.tableCode) {
      const duplicate = await tableRepository.findByAccountTableCode(existing.accountId, data.tableCode);
      if (duplicate) throw new AppError('Mã bàn đã tồn tại', 409);
    }

    const updateData = {};
    if (data.tableCode !== undefined) updateData.tableCode = data.tableCode;
    if (data.tableName !== undefined) updateData.tableName = data.tableName;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.posX !== undefined) updateData.posX = data.posX;
    if (data.posY !== undefined) updateData.posY = data.posY;

    if (data.posX !== undefined || data.posY !== undefined) {
      const allTables = await prisma.table.findMany({
        where: { accountId: existing.accountId, isActive: true, mode: 'RESTAURANT', id: { not: tableId } },
        select: { id: true, tableCode: true, posX: true, posY: true },
      });

      const newRect = { posX: data.posX ?? existing.posX, posY: data.posY ?? existing.posY, width: data.width, height: data.height };
      const overlap = allTables.find(t => rectsOverlap(newRect, t));
      if (overlap) throw new AppError(`Vị trí bàn "${existing.tableCode}" bị chồng lên với bàn "${overlap.tableCode}"`, 400);
    }

    return tableRepository.update(tableId, updateData);
  },

  async deleteRestaurantTable(tableId, user) {
    const existing = await tableRepository.findById(tableId);
    if (!existing) throw new AppError('Không tìm thấy bàn', 404);
    if (existing.mode !== 'RESTAURANT') throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(existing, user, 'bàn');

    const activeOrder = await prisma.order.findFirst({
      where: { tableId, status: { in: OPEN_ORDER_STATUSES }, deletedAt: null },
    });
    if (activeOrder) throw new AppError('Không thể xóa bàn đang có đơn hàng', 400);

    await tableRepository.softDelete(tableId);
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
      await consumeIngredientBatchesFEFO(tx, orderItem.inventoryId, orderItem.quantity);
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
      await consumeIngredientBatchesFEFO(tx, recipe.ingredientId, totalUsage);
    }
  }
}
