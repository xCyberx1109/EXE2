import { AppError } from '../../utils/AppError.js';
import { mapMenuItem, slugify } from '../../utils/mappers.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { orderRepository } from '../../repositories/order.repository.js';
import { requestLogger } from '../../utils/logger.js';
import prisma from '../../prisma/client.js';

export const menuService = {
  // --- Categories ---
  async listCategories(user, queryAccountId) {
    const where = {};
    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      where.accountId = user.accountId || user.id;
    } else if (queryAccountId) {
      where.accountId = queryAccountId;
    }
    const categories = await categoryRepository.findAll(where);
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      itemCount: c._count.menuItems,
    }));
  },

  async createCategory({ name, description }, user) {
    const slug = slugify(name);
    const data = { name, slug, description };
    if (user) data.accountId = user.accountId || user.id;
    const category = await categoryRepository.create(data);
    return category;
  },

  async updateCategory(id, data, user) {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy danh mục', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với danh mục này', 403);
      }
    }

    const updateData = { ...data };
    if (data.name) updateData.slug = slugify(data.name);

    return categoryRepository.update(id, updateData);
  },

  async deleteCategory(id, user) {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy danh mục', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với danh mục này', 403);
      }
    }

    const count = await menuItemRepository.count({ categoryId: id });
    if (count > 0) {
      throw new AppError('Không thể xóa danh mục đang có món ăn', 400);
    }
    await categoryRepository.delete(id);
  },

  // --- Menu Items ---
  async listMenuItems({ search, category, categoryId, available, accountId: queryAccountId }, user) {
    const where = {};

    if (categoryId) {
      where.categoryId = categoryId;
    } else if (category && category !== 'all') {
      const scopedAccountId = user?.accountId || user?.id || queryAccountId;
      const cat = await categoryRepository.findByName(category, scopedAccountId);
      if (cat) where.categoryId = cat.id;
    }

    if (available !== undefined) {
      where.available = available === 'true' || available === true;
    }

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
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

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && item.accountId !== accountId) {
        throw new AppError('Bạn không có quyền xem món này', 403);
      }
    }

    return mapMenuItem(item);
  },

  async createMenuItem(body, user) {
    const accountId = user?.accountId || user?.id;
    if (!accountId) {
      requestLogger.error('SYSTEM', 'createMenuItem: missing accountId');
      throw new AppError('Thiếu thông tin tài khoản', 400);
    }

    const categoryId = await resolveCategoryId(body, accountId);

    if (!categoryId || categoryId.trim() === '') {
      requestLogger.error('SYSTEM', 'createMenuItem: invalid categoryId after resolve', { categoryId });
      throw new AppError('Danh mục không hợp lệ hoặc không được để trống', 400);
    }

    const category = await categoryRepository.findById(categoryId);
    if (!category) {
      requestLogger.error('SYSTEM', 'createMenuItem: category not found', { categoryId });
      throw new AppError('Danh mục không tồn tại', 400);
    }

    const price = Number(body.price);
    const cost = Number(body.cost);
    if (isNaN(price) || !isFinite(price) || price <= 0) {
      requestLogger.error('SYSTEM', 'createMenuItem: invalid price', { price: body.price });
      throw new AppError('Giá bán phải là số hợp lệ và lớn hơn 0', 400);
    }
    if (isNaN(cost) || !isFinite(cost) || cost < 0) {
      requestLogger.error('SYSTEM', 'createMenuItem: invalid cost', { cost: body.cost });
      throw new AppError('Giá vốn phải là số hợp lệ và không âm', 400);
    }

    const ingredients = body.ingredients && Array.isArray(body.ingredients) ? body.ingredients : [];
    const invalidIngredientIds = [];

    for (const ing of ingredients) {
      if (!ing.ingredientId || (typeof ing.ingredientId === 'string' && ing.ingredientId.trim() === '')) {
        invalidIngredientIds.push({ ingredientId: ing.ingredientId, reason: 'ingredientId is empty' });
        continue;
      }
      if (ing.amount === undefined || ing.amount === null || isNaN(Number(ing.amount)) || Number(ing.amount) <= 0) {
        requestLogger.error('SYSTEM', 'createMenuItem: invalid ingredient amount', { ingredientId: ing.ingredientId, amount: ing.amount });
        throw new AppError(`Số lượng nguyên liệu ${ing.ingredientId} phải lớn hơn 0`, 400);
      }
    }

    if (invalidIngredientIds.length > 0) {
      requestLogger.error('SYSTEM', 'createMenuItem: invalid ingredient IDs', invalidIngredientIds);
      throw new AppError(`Có ${invalidIngredientIds.length} nguyên liệu không hợp lệ`, 400, invalidIngredientIds);
    }

    if (ingredients.length > 0) {
      const ingredientIds = ingredients.map(ing => ing.ingredientId);
      const existingIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true },
      });
      const existingIds = new Set(existingIngredients.map(i => i.id));
      const notFoundIds = ingredientIds.filter(id => !existingIds.has(id));

      if (notFoundIds.length > 0) {
        requestLogger.error('SYSTEM', 'createMenuItem: ingredients not found', { notFoundIds });
        throw new AppError(`Nguyên liệu không tồn tại: ${notFoundIds.join(', ')}`, 400, notFoundIds);
      }
    }

    requestLogger.log('SYSTEM', 'createMenuItem: starting transaction');
    const item = await prisma.$transaction(async (tx) => {
      const menuItem = await tx.menuItem.create({
        data: {
          name: body.name,
          categoryId,
          price,
          cost,
          description: body.description || '',
          imageUrl: body.imageUrl || null,
          available: body.available ?? true,
          accountId,
        },
        include: { category: true, ingredients: { include: { ingredient: true } } },
      });

      if (ingredients.length > 0) {
        await tx.menuItemIngredient.createMany({
          data: ingredients.map(ing => ({
            menuItemId: menuItem.id,
            ingredientId: ing.ingredientId,
            amount: Number(ing.amount),
          })),
        });
      }

      return tx.menuItem.findUnique({
        where: { id: menuItem.id },
        include: { category: true, ingredients: { include: { ingredient: true } } },
      });
    });

    requestLogger.log('SYSTEM', 'createMenuItem: transaction completed', { menuItemId: item.id });
    return mapMenuItem(item);
  },

  async updateMenuItem(id, body, user) {
    const existing = await menuItemRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy món ăn', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
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

    const ingredients = body.ingredients && Array.isArray(body.ingredients) ? body.ingredients : [];

    if (ingredients.length > 0) {
      for (const ing of ingredients) {
        if (!ing.ingredientId || (typeof ing.ingredientId === 'string' && ing.ingredientId.trim() === '')) {
          throw new AppError('ingredientId không hợp lệ', 400);
        }
        if (ing.amount === undefined || ing.amount === null || isNaN(Number(ing.amount)) || Number(ing.amount) <= 0) {
          throw new AppError(`Số lượng nguyên liệu ${ing.ingredientId} phải lớn hơn 0`, 400);
        }
      }

      const ingredientIds = ingredients.map(ing => ing.ingredientId);
      const existingIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true },
      });
      const existingIds = new Set(existingIngredients.map(i => i.id));
      const notFoundIds = ingredientIds.filter(id => !existingIds.has(id));
      if (notFoundIds.length > 0) {
        throw new AppError(`Nguyên liệu không tồn tại: ${notFoundIds.join(', ')}`, 400, notFoundIds);
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (body.name) updateData.name = body.name;
      if (body.price !== undefined) {
        const p = Number(body.price);
        if (isNaN(p) || !isFinite(p) || p <= 0) throw new AppError('Giá bán phải lớn hơn 0', 400);
        updateData.price = p;
      }
      if (body.cost !== undefined) {
        const c = Number(body.cost);
        if (isNaN(c) || !isFinite(c) || c < 0) throw new AppError('Giá vốn không được âm', 400);
        updateData.cost = c;
      }
      if (body.description !== undefined) updateData.description = body.description || '';
      if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
      if (body.available !== undefined) updateData.available = !!body.available;

      if (body.categoryId || body.category) {
        const catId = await resolveCategoryId(body, user?.accountId || user?.id);
        if (!catId) throw new AppError('Danh mục không hợp lệ', 400);
        updateData.categoryId = catId;
      }

      const updated = await tx.menuItem.update({
        where: { id },
        data: updateData,
        include: { category: true, ingredients: { include: { ingredient: true } } },
      });

      if (ingredients.length > 0) {
        await tx.menuItemIngredient.deleteMany({
          where: { menuItemId: id },
        });

        await tx.menuItemIngredient.createMany({
          data: ingredients.map(ing => ({
            menuItemId: id,
            ingredientId: ing.ingredientId,
            amount: Number(ing.amount),
          })),
        });
      }

      return tx.menuItem.findUnique({
        where: { id },
        include: { category: true, ingredients: { include: { ingredient: true } } },
      });
    });

    return mapMenuItem(item);
  },

  async toggleAvailability(id, user) {
    const existing = await menuItemRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy món ăn', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
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

    if (user && !user.permissions?.includes('ADMIN_ALL')) {
      const accountId = user.accountId || user.id;
      if (accountId && existing.accountId !== accountId) {
        throw new AppError('Bạn không có quyền thao tác với món này', 403);
      }
    }

    await menuItemRepository.delete(id);
  },

  /** Top món bán chạy */
  async getTopSelling(limit = 10, user) {
    const accountId = user && !user.permissions?.includes('ADMIN_ALL') ? (user.accountId || user.id) : undefined;
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

async function resolveCategoryId(body, accountId) {
  if (body.categoryId && body.categoryId.trim() !== '') {
    return body.categoryId;
  }

  if (body.category && body.category.trim() !== '') {
    let cat = await categoryRepository.findByName(body.category, accountId);
    if (!cat) {
      cat = await categoryRepository.create({
        name: body.category,
        slug: body.category.toLowerCase().replace(/ /g, '-'),
        accountId,
      });
    }
    return cat.id;
  }

  return null;
}
