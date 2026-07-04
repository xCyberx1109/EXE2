import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { assertBranchAccess, buildBranchWhere } from '../../middlewares/branchScope.js';
import { tableRepository } from '../../repositories/table.repository.js';
import { rectsOverlap, findAvailablePosition, DEFAULT_TABLE_WIDTH_PERCENT, DEFAULT_TABLE_HEIGHT_PERCENT } from '../../utils/tableOverlap.js';

function computeElapsedMinutes(startTime) {
  if (!startTime) return 0;
  return Math.floor((Date.now() - new Date(startTime).getTime()) / 60000);
}

const OPEN_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'];

function getAccountId(user) {
  return user?.accountId || user?.id || null;
}

function assertRestaurantTable(table, user) {
  assertBranchAccess(table, user, 'bàn');
  if (table.mode !== 'RESTAURANT') {
    throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
  }
}

function buildOpenRestaurantOrderWhere(tableId, accountId) {
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
    startTime: order.id,
    elapsedMinutes: computeElapsedMinutes(order.id),
    mergedTableIds: order.mergedTableIds,
  };
}

async function getOrderSummaryById(orderId, client = prisma) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { id: 'asc' } },
    },
  });
  return mapOrderSummary(order);
}

export const restaurantService = {
  async listTables(user) {
    const accountId = getAccountId(user);
    const where = buildBranchWhere(user, { isActive: true, mode: 'RESTAURANT' }, 'accountId');
    const tables = await tableRepository.findMany(where);
    if (!Array.isArray(tables)) return [];

    const enriched = await Promise.all(tables.map(async (t) => {
      const activeOrder = await prisma.order.findFirst({
        where: {
          ...buildOpenRestaurantOrderWhere(t.id, accountId),
        },
        include: {
          items: {
            orderBy: { id: 'asc' },
            select: { id: true, menuItemId: true, name: true, price: true, quantity: true, total: true },
          },
        },
        orderBy: { id: 'desc' },
      });

      const items = activeOrder?.items?.map(item => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        lineTotal: Number(item.total || item.price * item.quantity),
      })) || [];

      const foodTotal = items.reduce((s, i) => s + i.lineTotal, 0);
      let status = t.status;
      if (activeOrder && t.status !== 'RESERVED') {
        status = 'OCCUPIED';
      } else if (!activeOrder && t.status === 'OCCUPIED') {
        status = 'AVAILABLE';
      }

      const startTime = activeOrder?.id || null;
      const elapsedMinutes = computeElapsedMinutes(startTime);

      return {
        id: t.id,
        accountId: t.accountId,
        tableCode: t.tableCode,
        tableName: t.tableName,
        capacity: t.capacity,
        posX: t.posX,
        posY: t.posY,
        status,
        isMerged: t.isMerged,
        mergedIntoTableId: t.mergedIntoTableId,
        currentOrder: activeOrder ? {
          id: activeOrder.id,
          orderNumber: activeOrder.orderNumber,
          status: activeOrder.status,
          total: Number(activeOrder.total || 0),
          itemCount: activeOrder.items.reduce((s, i) => s + (i.quantity || 0), 0),
          items,
          foodTotal,
          guestCount: activeOrder.guestCount || 1,
          startTime,
          elapsedMinutes,
          note: activeOrder.note,
          mergedTableIds: activeOrder.mergedTableIds,
        } : null,
        isActive: t.isActive,
        id: t.id,
        updatedAt: t.updatedAt,
      };
    }));

    return enriched;
  },

  async createTable(data, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);
    const accountId = user.accountId || user.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);



    const existing = await tableRepository.findByAccountTableCode(accountId, data.tableCode);
    if (existing) throw new AppError(`Mã bàn "${data.tableCode}" đã tồn tại`, 409);

    const mode = 'RESTAURANT';

    const allTables = await prisma.table.findMany({
      where: { accountId, isActive: true, mode },
      select: { id: true, tableCode: true, posX: true, posY: true },
    });



    const reqWidth = data.width ? Number(data.width) : DEFAULT_TABLE_WIDTH_PERCENT;
    const reqHeight = data.height ? Number(data.height) : DEFAULT_TABLE_HEIGHT_PERCENT;
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
      capacity: data.capacity || 4,
      posX,
      posY,
      status: 'AVAILABLE',
      mode: 'RESTAURANT',
    });
  },

  async updateLayout(tablePositions, user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);
    const accountId = user.accountId || user.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);

    const allTables = await prisma.table.findMany({
      where: { accountId, isActive: true, mode: 'RESTAURANT' },
      select: { id: true, tableCode: true, posX: true, posY: true },
    });

    const positionsMap = {};
    for (const t of allTables) {
      positionsMap[t.id] = t;
    }

    const results = [];
    for (const pos of tablePositions) {
      const table = await tableRepository.findById(pos.id);
      if (!table) throw new AppError(`Không tìm thấy bàn ${pos.id}`, 404);
      if (table.mode !== 'RESTAURANT') throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
      assertBranchAccess(table, user, 'bàn');

      // Remove current table from positionsMap so it never overlaps with itself
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

  async createOrderForTable(tableId, { guestCount, note }, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertRestaurantTable(table, user);

    const accountId = getAccountId(user);

    const result = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: buildOpenRestaurantOrderWhere(tableId, accountId),
        include: { items: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'desc' },
      });
      if (existingOrder) return existingOrder;

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
          mode: 'RESTAURANT',
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          orderType: 'DINE_IN',
          subtotal: 0,
          total: 0,
          cost: 0,
          profit: 0,
          guestCount: guestCount || 1,
          note,
        },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: { items: { orderBy: { id: 'asc' } } },
      });
    });

    return mapOrderSummary(result);
  },

  async openOrderForTable(tableId, { guestCount }, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);

    assertRestaurantTable(table, user);

    const accountId = getAccountId(user);

    const existingOrder = await prisma.order.findFirst({
      where: buildOpenRestaurantOrderWhere(tableId, accountId),
      include: { items: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'desc' },
    });

    if (existingOrder) return mapOrderSummary(existingOrder);

    if (table.status === 'OCCUPIED') {
      throw new AppError('Bàn này đã có đơn hàng đang mở', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingInTx = await tx.order.findFirst({
        where: buildOpenRestaurantOrderWhere(tableId, accountId),
        include: { items: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'desc' },
      });

      if (existingInTx) return existingInTx;

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
          mode: 'RESTAURANT',
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          orderType: 'DINE_IN',
          subtotal: 0,
          total: 0,
          cost: 0,
          profit: 0,
          guestCount: guestCount || 1,
        },
      });

      if (!order) {
        throw new Error('Failed to create order');
      }

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: { items: { orderBy: { id: 'asc' } } },
      });
    });

    return mapOrderSummary(result);
  },

  async getOrderDetail(orderId, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: { id: 'asc' } },
        table: true,
      },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    const accountId = getAccountId(user);
    if (accountId && order.accountId !== accountId) {
      throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
    }

    return mapOrderSummary(order);
  },

  async getTableOrder(tableId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertRestaurantTable(table, user);
    const accountId = getAccountId(user);

    const order = await prisma.order.findFirst({
      where: buildOpenRestaurantOrderWhere(tableId, accountId),
      include: {
        items: { orderBy: { id: 'asc' } },
      },
      orderBy: { id: 'desc' },
    });

    if (!order) return null;

    return mapOrderSummary(order);
  },

  async addOrderItem(orderId, { menuItemId, quantity, note }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = getAccountId(user);
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
    if (!order.table || order.source !== 'RESTAURANT') {
      throw new AppError('Đơn hàng này không thuộc hệ thống nhà hàng', 400);
    }
    assertRestaurantTable(order.table, user);

    if (order.paymentStatus === 'PAID') {
      throw new AppError('Đơn hàng đã thanh toán, không thể thêm món', 400);
    }

    const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) throw new AppError('Không tìm thấy món ăn', 404);
    if (!menuItem.available) throw new AppError('Món ăn không khả dụng', 400);

    return prisma.$transaction(async (tx) => {
      const existingItem = await tx.orderItem.findFirst({
        where: { orderId, menuItemId },
      });

      let item;
      let totalDiff;
      let costDiff;

      if (existingItem) {
        const newQty = existingItem.quantity + quantity;
        const newTotal = Number(menuItem.price) * newQty;
        totalDiff = newTotal - Number(existingItem.total);
        costDiff = Number(menuItem.cost) * quantity;

        item = await tx.orderItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQty, total: newTotal },
        });
      } else {
        const total = Number(menuItem.price) * quantity;
        const cost = Number(menuItem.cost) * quantity;
        totalDiff = total;
        costDiff = cost;

        item = await tx.orderItem.create({
          data: {
            orderId,
            menuItemId,
            name: menuItem.name,
            price: menuItem.price,
            cost: menuItem.cost,
            quantity,
            note,
            total,
          },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: { increment: totalDiff },
          total: { increment: totalDiff },
          cost: { increment: costDiff },
          profit: { increment: totalDiff - costDiff },
        },
      });

      const orderSummary = await getOrderSummaryById(orderId, tx);
      return { item, order: orderSummary };
    });
  },

  async batchAddOrderItems(orderId, { items }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = getAccountId(user);
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
    if (!order.table || order.source !== 'RESTAURANT') {
      throw new AppError('Đơn hàng này không thuộc hệ thống nhà hàng', 400);
    }
    assertRestaurantTable(order.table, user);

    if (order.paymentStatus === 'PAID') {
      throw new AppError('Đơn hàng đã thanh toán, không thể thêm món', 400);
    }

    return prisma.$transaction(async (tx) => {
      let subtotalDiff = 0;
      let totalDiff = 0;
      let costDiff = 0;

      for (const { menuItemId, quantity } of items) {
        const menuItem = await tx.menuItem.findUnique({ where: { id: menuItemId } });
        if (!menuItem) throw new AppError(`Không tìm thấy món ${menuItemId}`, 404);

        const existingItem = await tx.orderItem.findFirst({
          where: { orderId, menuItemId },
        });

        if (existingItem) {
          const newQty = existingItem.quantity + quantity;
          const newTotal = Number(menuItem.price) * newQty;
          const itemDiff = newTotal - Number(existingItem.total);
          const itemCostDiff = Number(menuItem.cost) * quantity;

          await tx.orderItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQty, total: newTotal },
          });

          subtotalDiff += itemDiff;
          totalDiff += itemDiff;
          costDiff += itemCostDiff;
        } else {
          const total = Number(menuItem.price) * quantity;
          const cost = Number(menuItem.cost) * quantity;

          await tx.orderItem.create({
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

          subtotalDiff += total;
          totalDiff += total;
          costDiff += cost;
        }
      }

      if (subtotalDiff !== 0) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: { increment: subtotalDiff },
            total: { increment: totalDiff },
            cost: { increment: costDiff },
            profit: { increment: totalDiff - costDiff },
          },
        });
      }

      return getOrderSummaryById(orderId, tx);
    });
  },

  async updateOrderItem(orderId, itemId, { quantity, note }, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = getAccountId(user);
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
    if (!order.table || order.source !== 'RESTAURANT') {
      throw new AppError('Đơn hàng này không thuộc hệ thống nhà hàng', 400);
    }
    assertRestaurantTable(order.table, user);

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
        data: { quantity, total: newTotal, note },
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

      const orderSummary = await getOrderSummaryById(orderId, tx);
      return { item: updated, order: orderSummary };
    });
  },

  async removeOrderItem(orderId, itemId, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
    if (user) {
      const accountId = getAccountId(user);
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Đơn hàng này thuộc tài khoản khác', 403);
      }
    }
    if (!order.table || order.source !== 'RESTAURANT') {
      throw new AppError('Đơn hàng này không thuộc hệ thống nhà hàng', 400);
    }
    assertRestaurantTable(order.table, user);

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

      const orderSummary = await getOrderSummaryById(orderId, tx);
      return { id: itemId, deleted: true, order: orderSummary };
    });
  },

  async transferOrder(tableId, { targetTableId }, user) {
    const sourceTable = await tableRepository.findById(tableId);
    if (!sourceTable) throw new AppError('Không tìm thấy bàn nguồn', 404);
    assertRestaurantTable(sourceTable, user);

    const targetTable = await tableRepository.findById(targetTableId);
    if (!targetTable) throw new AppError('Không tìm thấy bàn đích', 404);
    assertRestaurantTable(targetTable, user);

    if (targetTable.status === 'OCCUPIED') {
      throw new AppError('Bàn đích đang có khách', 400);
    }

    const activeOrder = await prisma.order.findFirst({
      where: {
        tableId,
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
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
    assertRestaurantTable(sourceTable, user);

    const targetTable = await tableRepository.findById(targetTableId);
    if (!targetTable) throw new AppError('Không tìm thấy bàn đích', 404);
    assertRestaurantTable(targetTable, user);

    const sourceOrder = await prisma.order.findFirst({
      where: {
        tableId,
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
        deletedAt: null,
      },
      include: { items: true },
      orderBy: { id: 'desc' },
    });

    if (!sourceOrder) {
      throw new AppError('Bàn nguồn không có đơn hàng nào để gộp', 400);
    }

    const targetOrder = await prisma.order.findFirst({
      where: {
        tableId: targetTableId,
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
        deletedAt: null,
      },
      include: { items: true },
      orderBy: { id: 'desc' },
    });

    if (!targetOrder) {
      throw new AppError('Bàn đích không có đơn hàng nào để gộp', 400);
    }

    if (sourceOrder.id === targetOrder.id) {
      throw new AppError('Không thể gộp bàn với chính nó', 400);
    }

    return prisma.$transaction(async (tx) => {
      let totalDiff = 0;
      let costDiff = 0;

      for (const item of sourceOrder.items) {
        const existingItem = targetOrder.items.find(i => i.menuItemId === item.menuItemId);

        if (existingItem) {
          const newQty = existingItem.quantity + item.quantity;
          const newTotal = Number(existingItem.price) * newQty;

          await tx.orderItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQty, total: newTotal },
          });

          totalDiff += newTotal - Number(existingItem.total);
        } else {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { orderId: targetOrder.id },
          });

          totalDiff += Number(item.total);
          costDiff += Number(item.cost) * item.quantity;
        }
      }

      if (totalDiff !== 0) {
        await tx.order.update({
          where: { id: targetOrder.id },
          data: {
            subtotal: { increment: totalDiff },
            total: { increment: totalDiff },
            cost: { increment: costDiff },
            profit: { increment: totalDiff - costDiff },
          },
        });
      }

      const mergedIds = [
        ...(Array.isArray(targetOrder.mergedTableIds) ? targetOrder.mergedTableIds : []),
        tableId,
      ];

      await tx.order.update({
        where: { id: targetOrder.id },
        data: { mergedTableIds: mergedIds },
      });

      await tx.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED', isMerged: true, mergedIntoTableId: targetTableId },
      });

      return { mergedIntoOrderId: targetOrder.id, fromTableId: tableId, toTableId: targetTableId };
    });
  },

  async splitOrder(tableId, { targetTableId, items }, user) {
    const sourceTable = await tableRepository.findById(tableId);
    if (!sourceTable) throw new AppError('Không tìm thấy bàn nguồn', 404);
    assertRestaurantTable(sourceTable, user);

    const targetTable = await tableRepository.findById(targetTableId);
    if (!targetTable) throw new AppError('Không tìm thấy bàn đích', 404);
    assertRestaurantTable(targetTable, user);

    if (targetTable.status === 'OCCUPIED') {
      throw new AppError('Bàn đích đang có khách', 400);
    }

    const sourceOrder = await prisma.order.findFirst({
      where: {
        tableId,
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
        deletedAt: null,
      },
      include: { items: true },
      orderBy: { id: 'desc' },
    });

    if (!sourceOrder) {
      throw new AppError('Bàn nguồn không có đơn hàng', 400);
    }

    const accountId = user.accountId || user.id;

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
          subtotal: 0,
          total: 0,
          cost: 0,
          profit: 0,
          guestCount: 1,
        },
      });

      let movedTotal = 0;
      let movedCost = 0;
      let movedProfit = 0;

      for (const splitItem of items) {
        const sourceItem = sourceOrder.items.find(i => i.id === splitItem.itemId);
        if (!sourceItem) throw new AppError(`Không tìm thấy món ${splitItem.itemId}`, 404);

        const splitQty = Math.min(splitItem.quantity, sourceItem.quantity);
        if (splitQty <= 0) continue;

        const itemTotal = Number(sourceItem.price) * splitQty;
        const itemCost = Number(sourceItem.cost) * splitQty;

        const newItem = await tx.orderItem.create({
          data: {
            orderId: targetOrder.id,
            menuItemId: sourceItem.menuItemId,
            name: sourceItem.name,
            price: sourceItem.price,
            cost: sourceItem.cost,
            quantity: splitQty,
            total: itemTotal,
          },
        });

        movedTotal += itemTotal;
        movedCost += itemCost;
        movedProfit += itemTotal - itemCost;

        const remainingQty = sourceItem.quantity - splitQty;
        if (remainingQty <= 0) {
          await tx.orderItem.delete({ where: { id: sourceItem.id } });
        } else {
          const newSourceTotal = Number(sourceItem.price) * remainingQty;
          await tx.orderItem.update({
            where: { id: sourceItem.id },
            data: { quantity: remainingQty, total: newSourceTotal },
          });
        }
      }

      if (movedTotal > 0) {
        await tx.order.update({
          where: { id: targetOrder.id },
          data: {
            subtotal: { increment: movedTotal },
            total: { increment: movedTotal },
            cost: { increment: movedCost },
            profit: { increment: movedProfit },
          },
        });

        await tx.order.update({
          where: { id: sourceOrder.id },
          data: {
            subtotal: { decrement: movedTotal },
            total: { decrement: movedTotal },
            cost: { decrement: movedCost },
            profit: { decrement: movedProfit },
          },
        });
      }

      await tx.table.update({
        where: { id: targetTableId },
        data: { status: 'OCCUPIED' },
      });

      const remainingItems = await tx.orderItem.count({ where: { orderId: sourceOrder.id } });
      if (remainingItems === 0) {
        await tx.order.update({
          where: { id: sourceOrder.id },
          data: { status: 'CANCELLED' },
        });
        await tx.table.update({
          where: { id: tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      return { sourceOrderId: sourceOrder.id, targetOrderId: targetOrder.id, movedTotal };
    });
  },

  async payOrder(orderId, paymentMethod, user) {
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
    if (order.source !== 'RESTAURANT') {
      throw new AppError('Đơn hàng này không thuộc hệ thống nhà hàng', 400);
    }
    if (order.table) assertRestaurantTable(order.table, user);

    if (order.paymentStatus === 'PAID') {
      throw new AppError('Đơn hàng đã được thanh toán', 400);
    }

    const now = new Date();
    const userId = user?.id || user?.accountId || order.createdBy;
    const method = paymentMethod || 'CASH';

    return prisma.$transaction(async (tx) => {
      const total = Number(order.total);

      await tx.payment.create({
        data: {
          orderId,
          amount: total,
          method,
          status: 'PAID',
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          completedAt: now,
        },
      });

      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: {
            status: 'AVAILABLE',
            isMerged: false,
            mergedIntoTableId: null,
          },
        });
      }

      if (order.mergedTableIds && Array.isArray(order.mergedTableIds)) {
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

      return { id: orderId, paymentStatus: 'PAID', method };
    });
  },

  async updateTable(tableId, data, user) {
    const existing = await tableRepository.findById(tableId);
    if (!existing) throw new AppError('Không tìm thấy bàn', 404);
    if (existing.mode !== 'RESTAURANT') throw new AppError('Bàn này không thuộc hệ thống nhà hàng', 400);
    assertBranchAccess(existing, user, 'bàn');

    if (data.tableCode && data.tableCode !== existing.tableCode) {
      const duplicate = await tableRepository.findByAccountTableCode(existing.accountId, data.tableCode);
      if (duplicate) throw new AppError('Mã bàn đã tồn tại trong tài khoản này', 409);
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

      const newRect = {
        posX: data.posX ?? existing.posX,
        posY: data.posY ?? existing.posY,
        width: data.width,
        height: data.height,
      };
      const overlap = allTables.find(t => rectsOverlap(newRect, t));
      if (overlap) {
        throw new AppError(`Vị trí bàn "${existing.tableCode}" bị chồng lên với bàn "${overlap.tableCode}"`, 400);
      }
    }

    return tableRepository.update(tableId, updateData);
  },

  async deleteTable(tableId, user) {
    const existing = await tableRepository.findById(tableId);
    if (!existing) throw new AppError('Không tìm thấy bàn', 404);
    assertRestaurantTable(existing, user);

    const activeOrder = existing.orders?.[0];
    if (activeOrder) {
      throw new AppError('Không thể xóa bàn đang có đơn hàng', 400);
    }

    await tableRepository.softDelete(tableId);
  },

  async updateGuestCount(tableId, guestCount, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertRestaurantTable(table, user);

    const activeOrder = await prisma.order.findFirst({
      where: {
        tableId,
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
        deletedAt: null,
      },
      orderBy: { id: 'desc' },
    });

    if (!activeOrder) throw new AppError('Bàn này không có đơn hàng đang mở', 400);

    return prisma.order.update({
      where: { id: activeOrder.id },
      data: { guestCount },
    });
  },

  async updateOrderNote(orderId, note, user) {
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
    if (order.source !== 'RESTAURANT') {
      throw new AppError('Đơn hàng này không thuộc hệ thống nhà hàng', 400);
    }
    if (order.table) assertRestaurantTable(order.table, user);

    return prisma.order.update({
      where: { id: orderId },
      data: { note },
    });
  },
};
