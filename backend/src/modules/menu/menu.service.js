import { AppError } from '../../utils/AppError.js';
import { mapMenuItem, slugify } from '../../utils/mappers.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { orderRepository } from '../../repositories/order.repository.js';
import prisma from '../../prisma/client.js';

export const menuService = {
  // --- Categories (shared, global — no account scoping) ---
  async listCategories() {
    const categories = await categoryRepository.findMany();
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      itemCount: c._count.menuItems,
    }));
  },

  async createCategory({ name, description }) {
    const slug = slugify(name);
    const data = { name, slug, description };
    const category = await categoryRepository.create(data);
    return category;
  },

  async updateCategory(id, data) {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy danh mục', 404);

    const updateData = { ...data };
    if (data.name) updateData.slug = slugify(data.name);

    return categoryRepository.update(id, updateData);
  },

  async deleteCategory(id) {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy danh mục', 404);

    const count = await menuItemRepository.count({ categoryId: id });
    if (count > 0) {
      throw new AppError('Không thể xóa danh mục đang có món ăn', 400);
    }
    await categoryRepository.softDelete(id);
  },

  // --- Menu Items ---
  async listMenuItems({ search, category, categoryId, available, accountId: queryAccountId }, user) {
    // Account isolation: if no authenticated user, return empty list to prevent cross-account leak
    if (!user && !queryAccountId) {
      return [];
    }

    const where = {};

    if (categoryId) {
      where.categoryId = categoryId;
    } else if (category && category !== 'all') {
      const cat = await categoryRepository.findByName(category);
      if (cat) where.categoryId = cat.id;
    }

    if (available !== undefined) {
      where.available = available === 'true' || available === true;
    }

    if (user) {
      where.accountId = user.accountId || user.id;
    } else if (queryAccountId) {
      where.accountId = queryAccountId;
    }

    let items = await menuItemRepository.findMany(where);

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q)
      );
    }

    return items.map(mapMenuItem);
  },

  async getMenuItem(id, user) {
    // Account isolation: require auth context to prevent cross-account data access
    if (!user) {
      throw new AppError('Vui lòng đăng nhập để xem món ăn', 401);
    }

    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: true,
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
    const categoryId = await resolveCategoryId(body);

    if (categoryId) {
      const category = await categoryRepository.findById(categoryId);
      if (!category) {
        throw new AppError('Danh mục không tồn tại', 400);
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      const menuItem = await tx.menuItem.create({
        data: {
          name: body.name,
          categoryId,
          price: Number(body.price),
          cost: Number(body.cost),
          description: body.description || '',
          imageUrl: body.imageUrl || null,
          available: body.available ?? true,
          ...(user ? { accountId: user.accountId || user.id } : {}),
        },
        include: { category: true, ingredients: { include: { ingredient: true } } },
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

    if (body.categoryId) {
      const category = await categoryRepository.findById(body.categoryId);
      if (!category) {
        throw new AppError('Danh mục không tồn tại', 400);
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

      if (body.categoryId || body.category) {
        updateData.categoryId = await resolveCategoryId(body);
      }

      const updated = await tx.menuItem.update({
        where: { id },
        data: updateData,
        include: { category: true, ingredients: { include: { ingredient: true } } },
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

    console.log("[TOP SELLING ITEMS grouped]", JSON.stringify(grouped, null, 2));

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
      category: menuMap[g.menuItemId]?.category?.name || '',
      price: Number(menuMap[g.menuItemId]?.price || 0),
      revenue: revenueMap[g.menuItemId] || 0,
    }));

    console.log("[TOP SELLING RESULT]", JSON.stringify(result, null, 2));
    return result;
  },
};

async function resolveCategoryId(body) {
  if (body.categoryId && body.categoryId.trim() !== '') {
    return body.categoryId;
  }

  if (body.category && body.category.trim() !== '') {
    let cat = await categoryRepository.findByName(body.category);
    if (!cat) {
      cat = await categoryRepository.create({
        name: body.category,
        slug: body.category.toLowerCase().replace(/ /g, '-'),
      });
    }
    return cat.id;
  }

  return null;
}
