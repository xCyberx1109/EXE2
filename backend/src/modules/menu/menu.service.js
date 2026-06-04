import { AppError } from '../../utils/AppError.js';
import { mapMenuItem, slugify } from '../../utils/mappers.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { orderRepository } from '../../repositories/order.repository.js';
import prisma from '../../prisma/client.js';

export const menuService = {
  // --- Categories ---
  async listCategories(user) {
    const where = {};
    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId) {
      where.branchId = user.branchId;
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
    if (user && user.branchId) data.branchId = user.branchId;
    const category = await categoryRepository.create(data);
    return category;
  },

  async updateCategory(id, data, user) {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy danh mục', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && existing.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền thao tác với danh mục này', 403);
    }

    const updateData = { ...data };
    if (data.name) updateData.slug = slugify(data.name);

    return categoryRepository.update(id, updateData);
  },

  async deleteCategory(id, user) {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy danh mục', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && existing.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền thao tác với danh mục này', 403);
    }

    const count = await menuItemRepository.count({ categoryId: id });
    if (count > 0) {
      throw new AppError('Không thể xóa danh mục đang có món ăn', 400);
    }
    await categoryRepository.delete(id);
  },

  // --- Menu Items ---
  async listMenuItems({ search, category, categoryId, available }, user) {
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

    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId) {
      where.branchId = user.branchId;
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

    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && item.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền xem món này', 403);
    }

    return mapMenuItem(item);
  },

  async createMenuItem(body, user) {
    const categoryId = await resolveCategoryId(body);

    // Verify category exists
    if (categoryId) {
      const category = await categoryRepository.findById(categoryId);
      if (!category) {
        throw new AppError('Danh mục không tồn tại', 400);
      }
    }

    // Use transaction to create MenuItem and MenuItemIngredients together
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
          ...(user && user.branchId ? { branchId: user.branchId } : {}),
        },
        include: { category: true, ingredients: { include: { ingredient: true } } },
      });

      // Create ingredient associations if provided
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

    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && existing.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền thao tác với món này', 403);
    }

    // Validate category existence if provided
    if (body.categoryId) {
      const category = await categoryRepository.findById(body.categoryId);
      if (!category) {
        throw new AppError('Danh mục không tồn tại', 400);
      }
    }

    // Use transaction for update with ingredients
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

      // Update ingredient associations if provided
      if (body.ingredients && Array.isArray(body.ingredients)) {
        // Delete existing associations
        await tx.menuItemIngredient.deleteMany({
          where: { menuItemId: id },
        });

        // Create new associations - only if valid
        for (const ing of body.ingredients) {
          if (ing.ingredientId && ing.amount !== undefined && ing.amount !== null) {
            // Verify ingredient exists to prevent foreign key error
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

    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && existing.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền thao tác với món này', 403);
    }

    const item = await menuItemRepository.update(id, { available: !existing.available });
    return mapMenuItem(item);
  },

  async deleteMenuItem(id, user) {
    const existing = await menuItemRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy món ăn', 404);

    if (user && !user.permissions?.includes('ADMIN_ALL') && user.branchId && existing.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền thao tác với món này', 403);
    }

    await menuItemRepository.delete(id);
  },

  /** Top món bán chạy - khớp foodOrderStats frontend */
  async getTopSelling(limit = 10, user) {
    const branchId = user && !user.permissions?.includes('ADMIN_ALL') ? user.branchId : undefined;
    const grouped = await orderRepository.aggregateTopItems(limit, branchId);
    const result = [];

    for (const g of grouped) {
      if (!g.menuItemId) continue;
      const item = await menuItemRepository.findById(g.menuItemId);
      if (!item) continue;
      result.push({
        menuItemId: g.menuItemId,
        quantity: g._sum.quantity,
        name: item.name,
        category: item.category.name,
        price: Number(item.price),
      });
    }

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
