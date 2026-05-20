import { AppError } from '../../utils/AppError.js';
import { mapMenuItem, slugify } from '../../utils/mappers.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { orderRepository } from '../../repositories/order.repository.js';
import prisma from '../../prisma/client.js';

export const menuService = {
  // --- Categories ---
  async listCategories() {
    const categories = await categoryRepository.findAll();
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
    const category = await categoryRepository.create({ name, slug, description });
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
    const count = await menuItemRepository.count({ categoryId: id });
    if (count > 0) {
      throw new AppError('Không thể xóa danh mục đang có món ăn', 400);
    }
    await categoryRepository.delete(id);
  },

  // --- Menu Items ---
  async listMenuItems({ search, category, categoryId, available }) {
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

  async getMenuItem(id) {
    const item = await menuItemRepository.findById(id);
    if (!item) throw new AppError('Không tìm thấy món ăn', 404);
    return mapMenuItem(item);
  },

   async createMenuItem(body) {
     const categoryId = await resolveCategoryId(body);
     
     // Use transaction to create MenuItem and MenuItemIngredients together
     const item = await prisma.$transaction(async (tx) => {
       const menuItem = await tx.menuItem.create({
         data: {
           name: body.name,
           categoryId,
           price: body.price,
           cost: body.cost,
           description: body.description || '',
           imageUrl: body.imageUrl || null,
           available: body.available ?? true,
         },
         include: { category: true, ingredients: { include: { ingredient: true } } },
       });

       // Create ingredient associations if provided
       if (body.ingredients && Array.isArray(body.ingredients)) {
         for (const ing of body.ingredients) {
           if (ing.ingredientId && ing.amount) {
             await tx.menuItemIngredient.upsert({
               where: { menuItemId_ingredientId: { menuItemId: menuItem.id, ingredientId: ing.ingredientId } },
               create: { menuItemId: menuItem.id, ingredientId: ing.ingredientId, amount: ing.amount },
               update: { amount: ing.amount },
             });
           }
         }
       }

       return menuItem;
     });

     return mapMenuItem(item);
   },

   async updateMenuItem(id, body) {
     const existing = await menuItemRepository.findById(id);
     if (!existing) throw new AppError('Không tìm thấy món ăn', 404);

     // Use transaction for update with ingredients
     const item = await prisma.$transaction(async (tx) => {
       const updateData = {};
       if (body.name) updateData.name = body.name;
       if (body.price !== undefined) updateData.price = body.price;
       if (body.cost !== undefined) updateData.cost = body.cost;
       if (body.description !== undefined) updateData.description = body.description;
       if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
       if (body.available !== undefined) updateData.available = body.available;
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
         // Delete existing associations not in the new list
         await tx.menuItemIngredient.deleteMany({
           where: { menuItemId: id },
         });

         // Create new associations
         for (const ing of body.ingredients) {
           if (ing.ingredientId && ing.amount) {
             await tx.menuItemIngredient.create({
               data: { menuItemId: id, ingredientId: ing.ingredientId, amount: ing.amount },
             });
           }
         }
       }

       return updated;
     });

     return mapMenuItem(item);
   },

  async toggleAvailability(id) {
    const existing = await menuItemRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy món ăn', 404);
    const item = await menuItemRepository.update(id, { available: !existing.available });
    return mapMenuItem(item);
  },

  async deleteMenuItem(id) {
    await menuItemRepository.delete(id);
  },

  /** Top món bán chạy - khớp foodOrderStats frontend */
  async getTopSelling(limit = 10) {
    const grouped = await orderRepository.aggregateTopItems(limit);
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
  if (body.categoryId) return body.categoryId;
  if (body.category) {
    let cat = await categoryRepository.findByName(body.category);
    if (!cat) {
      cat = await categoryRepository.create({
        name: body.category,
        slug: slugify(body.category),
      });
    }
    return cat.id;
  }
  throw new AppError('Danh mục là bắt buộc', 400);
}
