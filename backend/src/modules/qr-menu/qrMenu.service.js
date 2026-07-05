import jwt from 'jsonwebtoken';
import prisma from '../../prisma/client.js';
import config from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import { menuService } from '../menu/menu.service.js';
import { restaurantService } from '../restaurant/restaurant.service.js';

const QR_SECRET = process.env.QR_MENU_SECRET || config.jwt.secret;
const QR_EXPIRES_IN = process.env.QR_MENU_EXPIRES_IN || '365d';

function signQrToken(table) {
  return jwt.sign(
    {
      type: 'QR_MENU',
      tableId: table.id,
      accountId: table.accountId,
    },
    QR_SECRET,
    { expiresIn: QR_EXPIRES_IN }
  );
}

function verifyQrToken(token) {
  try {
    const payload = jwt.verify(token, QR_SECRET);
    if (!payload?.tableId || !payload?.accountId) {
      throw new AppError('QR không hợp lệ', 400);
    }
    return payload;
  } catch {
    throw new AppError('QR không hợp lệ hoặc đã hết hạn', 400);
  }
}

async function getRestaurantTableFromToken(token) {
  const payload = verifyQrToken(token);

  const table = await prisma.table.findFirst({
    where: {
      id: payload.tableId,
      accountId: payload.accountId,
      mode: 'RESTAURANT',
      isActive: true,
    },
  });

  if (!table) {
    throw new AppError('Không tìm thấy bàn hoặc QR không còn hiệu lực', 404);
  }

  return table;
}

export const qrMenuService = {
  async listTableQrLinks(user) {
    if (!user) throw new AppError('Vui lòng đăng nhập', 401);

    const accountId = user.accountId || user.id;

    const tables = await prisma.table.findMany({
      where: {
        accountId,
        mode: 'RESTAURANT',
        isActive: true,
      },
      orderBy: { tableCode: 'asc' },
    });

    return tables.map((table) => {
      const token = signQrToken(table);
      return {
        tableId: table.id,
        tableCode: table.tableCode,
        tableName: table.tableName,
        token,
        qrUrl: `${config.frontendUrl}/qrmenu?t=${encodeURIComponent(token)}`,
      };
    });
  },

  async resolvePublicMenu(token) {
    const table = await getRestaurantTableFromToken(token);

    const menuItems = await menuService.listMenuItems(
      { available: 'true', accountId: table.accountId },
      null
    );

    return {
      table: {
        id: table.id,
        tableCode: table.tableCode,
        tableName: table.tableName,
        capacity: table.capacity,
      },
      menuItems: Array.isArray(menuItems) ? menuItems : menuItems.data,
    };
  },

  async submitPublicOrder(token, body) {
    const table = await getRestaurantTableFromToken(token);

    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      throw new AppError('Vui lòng chọn ít nhất 1 món', 400);
    }

    const ctx = {
      id: table.accountId,
      accountId: table.accountId,
    };

    const openOrder = await restaurantService.openOrderForTable(
      table.id,
      { guestCount: body?.guestCount || 1 },
      ctx
    );

    await restaurantService.batchAddOrderItems(
      openOrder.id,
      {
        items: items.map((x) => ({
          menuItemId: x.menuItemId,
          quantity: Number(x.quantity || 1),
        })),
      },
      ctx
    );

    const latestOrder = await restaurantService.getTableOrder(table.id, ctx);

    return {
      success: true,
      table: {
        id: table.id,
        tableCode: table.tableCode,
        tableName: table.tableName,
      },
      order: latestOrder,
    };
  },
};