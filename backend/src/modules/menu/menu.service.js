import { AppError } from '../../utils/AppError.js';
import { parsePagination, paginatedResponse } from '../../utils/pagination.js';
import { mapMenuItem } from '../../utils/mappers.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { orderRepository } from '../../repositories/order.repository.js';
import prisma from '../../prisma/client.js';

export const menuService = {
  // --- Menu Items ---
  async listMenuItems({ search, available, accountId: queryAccountId, page, limit }, user) {
    if (!user && !queryAccountId) {
      return [];
    }

    const where = {};

    if (available !== undefined) {
      where.available = available === 'true' || available === true;
    }

    if (user) {
      where.accountId = user.accountId || user.id;
    } else if (queryAccountId) {
      where.accountId = queryAccountId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (page && limit) {
      const { page: p, limit: l } = parsePagination({ page, limit });
      const [items, total] = await menuItemRepository.findMany(where, { page: p, limit: l });
      return paginatedResponse(items.map(mapMenuItem), total, { page: p, limit: l });
    }

    const items = await menuItemRepository.findMany(where);
    return items.map(mapMenuItem);
  },

  async getMenuItem(id, user) {
    if (!user) {
      throw new AppError('Vui lòng đăng nhập để xem món ăn', 401);
    }

    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: { ingredient: true },
        },
      },
    });

    if (!item) throw new AppError('Không tìm thấy món ăn', 404);

    const accountId = user.accountId || user.id;
    if (accountId && item.accountId !== accountId) {
      throw new AppError('Bạn không có quyền xem món này', 403);
    }

    return mapMenuItem(item);
  },

  async createMenuItem(body, user) {
    const item = await prisma.$transaction(async (tx) => {
      const menuItem = await tx.menuItem.create({
        data: {
          name: body.name,
          price: Number(body.price),
          cost: Number(body.cost),
          description: body.description || '',
          imageUrl: body.imageUrl || null,
          available: body.available ?? true,
          ...(user ? { accountId: user.accountId || user.id } : {}),
        },
        include: { ingredients: { include: { ingredient: true } } },
      });

      if (body.ingredients && Array.isArray(body.ingredients)) {
        for (const ing of body.ingredients) {
          if (ing.ingredientId && ing.amount !== undefined && ing.amount !== null) {
            const ingredientExists = await tx.ingredient.findUnique({ where: { id: ing.ingredientId } });
            if (ingredientExists) {
              const amount = Number(ing.amount);
              if (amount > 0) {
                await tx.menuItemIngredient.create({
                  data: { menuItemId: menuItem.id, ingredientId: ing.ingredientId, amount },
                });
              }
            }
          }
        }
      }

      return menuItem;
    });

    return mapMenuItem(item);
  },

  async updateMenuItem(id, body, user) {
    const existing = await menuItemRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy món ăn', 404);

    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với món này', 403);
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (body.name) updateData.name = body.name;
      if (body.price !== undefined) updateData.price = Number(body.price);
      if (body.cost !== undefined) updateData.cost = Number(body.cost);
      if (body.description !== undefined) updateData.description = body.description || '';
      if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
      if (body.available !== undefined) updateData.available = !!body.available;

      const updated = await tx.menuItem.update({
        where: { id },
        data: updateData,
        include: { ingredients: { include: { ingredient: true } } },
      });

      if (body.ingredients && Array.isArray(body.ingredients)) {
        await tx.menuItemIngredient.deleteMany({
          where: { menuItemId: id },
        });

        for (const ing of body.ingredients) {
          if (ing.ingredientId && ing.amount !== undefined && ing.amount !== null) {
            const ingredientExists = await tx.ingredient.findUnique({ where: { id: ing.ingredientId } });
            if (ingredientExists) {
              const amount = Number(ing.amount);
              if (amount > 0) {
                await tx.menuItemIngredient.create({
                  data: { menuItemId: id, ingredientId: ing.ingredientId, amount },
                });
              }
            }
          }
        }
      }

      return updated;
    });

    return mapMenuItem(item);
  },

  async toggleAvailability(id, user) {
    const existing = await menuItemRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy món ăn', 404);

    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với món này', 403);
      }
    }

    const item = await menuItemRepository.update(id, { available: !existing.available });
    return mapMenuItem(item);
  },

  async deleteMenuItem(id, user) {
    const existing = await menuItemRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy món ăn', 404);

    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với món này', 403);
      }
    }

    await menuItemRepository.delete(id);
  },

  /** Top món bán chạy */
  async getTopSelling(limit = 10, user) {
    if (!user) return [];
    const accountId = user.accountId || user.id;
    const grouped = await orderRepository.aggregateTopItems(limit, accountId);

    if (grouped.length === 0) return [];

    const ids = grouped.map(g => g.menuItemId);
    const [menuItems, orderItems] = await Promise.all([
      menuItemRepository.findMany({ id: { in: ids } }),
      prisma.orderItem.findMany({
        where: { menuItemId: { in: ids }, order: { status: 'COMPLETED' } },
        select: { menuItemId: true, price: true, quantity: true },
      }),
    ]);

    const menuMap = Object.fromEntries(menuItems.map(m => [m.id, m]));

    const revenueMap = {};
    for (const item of orderItems) {
      if (!item.menuItemId) continue;
      revenueMap[item.menuItemId] = (revenueMap[item.menuItemId] || 0) + Number(item.price) * item.quantity;
    }

    const result = grouped.map(g => ({
      menuItemId: g.menuItemId,
      soldQuantity: g._sum.quantity,
      name: menuMap[g.menuItemId]?.name || 'Unknown',
      price: Number(menuMap[g.menuItemId]?.price || 0),
      revenue: revenueMap[g.menuItemId] || 0,
    }));

    return result;
  },
};
