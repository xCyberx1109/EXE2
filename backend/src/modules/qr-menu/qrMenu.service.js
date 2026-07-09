import jwt from 'jsonwebtoken';

import config from '../../config/index.js';
import prisma from '../../prisma/client.js';
import { restaurantService } from '../restaurant/restaurant.service.js';
import { AppError } from '../../utils/AppError.js';

const QR_SECRET = process.env.QR_MENU_SECRET || config.jwt.secret;
const QR_EXPIRES_IN = process.env.QR_MENU_EXPIRES_IN || '365d';

function createToken(table) {
  return jwt.sign(
    {
      type: 'QR_MENU',
      tableId: table.id,
      accountId: table.accountId,
    },
    QR_SECRET,
    { expiresIn: QR_EXPIRES_IN },
  );
}

function decodeToken(token) {
  if (!token) throw new AppError('Thiếu mã QR', 400);

  try {
    const payload = jwt.verify(token, QR_SECRET);
    if (
      payload?.type !== 'QR_MENU' ||
      !payload?.tableId ||
      !payload?.accountId
    ) {
      throw new Error('Invalid QR payload');
    }
    return payload;
  } catch {
    throw new AppError('Mã QR không hợp lệ hoặc đã hết hạn', 400);
  }
}

async function getTableByToken(token) {
  const payload = decodeToken(token);

  const table = await prisma.table.findFirst({
    where: {
      id: payload.tableId,
      accountId: payload.accountId,
      mode: 'RESTAURANT',
      isActive: true,
    },
  });

  if (!table) {
    throw new AppError('Không tìm thấy bàn hoặc mã QR không còn hiệu lực', 404);
  }

  return table;
}

function publicContext(table) {
  return {
    id: table.accountId,
    accountId: table.accountId,
  };
}

export const qrMenuService = {
  async listTableLinks(user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);

    const accountId = user.accountId || user.id;
    const tables = await prisma.table.findMany({
      where: {
        accountId,
        mode: 'RESTAURANT',
        isActive: true,
      },
      select: {
        id: true,
        accountId: true,
        tableCode: true,
        tableName: true,
      },
      orderBy: { tableCode: 'asc' },
    });

    return tables.map((table) => ({
      tableId: table.id,
      tableCode: table.tableCode,
      tableName: table.tableName,
      token: createToken(table),
    }));
  },

  async resolvePublicMenu(token) {
  const table = await getTableByToken(token);
  const context = publicContext(table);

  const [menuItems, currentOrder] = await Promise.all([
    prisma.menuItem.findMany({
      where: {
        accountId: table.accountId,
        available: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        price: true,
        cost: true,
        description: true,
        available: true,
        imageUrl: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),

    restaurantService.getTableOrder(table.id, context),
  ]);

  return {
    table: {
      id: table.id,
      tableCode: table.tableCode,
      tableName: table.tableName,
      capacity: table.capacity,
    },

    menuItems: menuItems.map((item) => ({
      ...item,
      price: Number(item.price),
      cost: Number(item.cost),
      description: item.description || '',
    })),


    currentOrder,
  };
},

  async submitPublicOrder(token, body) {
    const table = await getTableByToken(token);
    const rawItems = Array.isArray(body?.items) ? body.items : [];

    if (rawItems.length === 0) {
      throw new AppError('Vui lòng chọn ít nhất một món', 400);
    }

    const normalizedItems = rawItems.map((item) => ({
      menuItemId: String(item.menuItemId || '').trim(),
      quantity: Number(item.quantity),
    }));

    if (
      normalizedItems.some(
        (item) => !item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1,
      )
    ) {
      throw new AppError('Danh sách món không hợp lệ', 400);
    }

    const uniqueIds = [...new Set(normalizedItems.map((item) => item.menuItemId))];
    const validMenuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: uniqueIds },
        accountId: table.accountId,
        available: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (validMenuItems.length !== uniqueIds.length) {
      throw new AppError('Có món không tồn tại hoặc không còn khả dụng', 400);
    }

    const context = publicContext(table);
    const order = await restaurantService.openOrderForTable(
      table.id,
      { guestCount: Number(body?.guestCount) || 1 },
      context,
    );

    await restaurantService.batchAddOrderItems(
      order.id,
      { items: normalizedItems },
      context,
    );

    const latestOrder = await restaurantService.getTableOrder(table.id, context);

    return {
      table: {
        id: table.id,
        tableCode: table.tableCode,
        tableName: table.tableName,
      },
      order: latestOrder,
    };
  },
};
