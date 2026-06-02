import { AppError } from '../../utils/AppError.js';
import { mapMenuItem, slugify } from '../../utils/mappers.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { orderRepository } from '../../repositories/order.repository.js';
import { assertBranchAccess, buildBranchWhere, branchDataForCreate } from '../../middlewares/branchScope.js';
import prisma from '../../prisma/client.js';

export const menuService = {
  // --- Categories ---
  async listCategories(user) {
    const where = buildBranchWhere(user);
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
    const data = { name, slug, description, ...branchDataForCreate(user) };
    const category = await categoryRepository.create(data);
    return category;
  },

  async updateCategory(id, data, user) {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy danh mục', 404);
    assertBranchAccess(existing, user, 'danh mục');

    const updateData = { ...data };
    if (data.name) updateData.slug = slugify(data.name);

    return categoryRepository.update(id, updateData);
  },

  async deleteCategory(id, user) {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy danh mục', 404);
    assertBranchAccess(existing, user, 'danh mục');

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

    Object.assign(where, buildBranchWhere(user));
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
    const item = await menuItemRepository.findById(id);
    if (!item) throw new AppError('Không tìm thấy món ăn', 404);
    assertBranchAccess(item, user, 'món ăn');
    return mapMenuItem(item);
  },

   async createMenuItem(body, user) {
      console.log('=== MenuService.createMenuItem ===');
      console.log('Input body:', JSON.stringify(body, null, 2));
      console.log('User:', { id: user?.id, email: user?.email, role: user?.role, branchId: user?.branchId, permissions: user?.permissions });

      const branchInfo = branchDataForCreate(user);
      console.log('branchDataForCreate result:', branchInfo);

      // Kiểm tra branchId: nếu null/undefined và user không có BRANCH_ALL_ACCESS → lỗi rõ ràng
      const hasBranchAccess = user?.permissions?.includes('BRANCH_ALL_ACCESS') || user?.permissions?.includes('CROSS_BRANCH_ACCESS');
      if (!branchInfo.branchId && !hasBranchAccess) {
        console.error('Branch assignment required - user has no branchId and no cross-branch permissions');
        throw new AppError('Branch assignment required: user must be assigned to a branch to create menu items', 400);
      }

       const categoryId = await resolveCategoryId(body, branchInfo.branchId || user?.branchId);
       console.log('Resolved categoryId:', categoryId);

       if (!categoryId) {
         console.error('CATEGORY ID IS EMPTY. body.category:', body.category, 'body.categoryId:', body.categoryId);
         throw new AppError('categoryId is required after resolveCategoryId', 400);
       }
       const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
       console.log('Category lookup result:', categoryExists ? JSON.stringify(categoryExists, null, 2) : 'NULL');
       if (!categoryExists) {
         console.error('CATEGORY NOT FOUND IN DB:', categoryId);
         throw new AppError(`Category not found in database: ${categoryId}`, 400);
       }

      // Kiểm tra ingredients trước transaction để trả lỗi rõ ràng
       if (body.ingredients && Array.isArray(body.ingredients)) {
         console.log(`Validating ${body.ingredients.length} ingredients...`);
         for (let i = 0; i < body.ingredients.length; i++) {
           const ing = body.ingredients[i];
           console.log(`Ingredient [${i}]:`, JSON.stringify(ing, null, 2));

           // amount phải là số dương
           const amount = Number(ing.amount);
           if (ing.amount === undefined || ing.amount === null || ing.amount === '' || isNaN(amount) || amount <= 0) {
             console.error(`Ingredient [${i}]: INVALID amount:`, ing.amount, 'parsed:', amount);
             throw new AppError(`Ingredient at index ${i}: amount must be a positive number, got ${JSON.stringify(ing.amount)} (parsed: ${amount})`, 400);
           }
           ing.amount = amount; // chuẩn hóa về number

           // Kiểm tra ingredientId không rỗng
           if (!ing.ingredientId || ing.ingredientId === '') {
             console.error(`Ingredient [${i}]: MISSING ingredientId`);
             throw new AppError(`Ingredient at index ${i}: ingredientId is required`, 400);
           }

           // Kiểm tra ingredient tồn tại trong DB
           console.log(`Ingredient [${i}]: querying DB for id="${ing.ingredientId}"...`);
           const ingredient = await prisma.ingredient.findUnique({
             where: { id: ing.ingredientId },
             select: { id: true, name: true, branchId: true, unit: true },
           });
           console.log(`Ingredient [${i}]: DB result:`, ingredient ? JSON.stringify(ingredient, null, 2) : 'NULL');
           if (!ingredient) {
             console.error(`Ingredient [${i}]: NOT FOUND in DB: "${ing.ingredientId}"`);
             throw new AppError(`Ingredient not found in database: "${ing.ingredientId}" at index ${i}`, 400);
           }

           // Kiểm tra ingredient cùng branch với menu item
           const targetBranchId = branchInfo.branchId;
           console.log(`Ingredient [${i}]: branch check - ingredient.branchId="${ingredient.branchId}", targetBranchId="${targetBranchId}"`);
           if (targetBranchId && ingredient.branchId !== targetBranchId) {
             console.error(`Ingredient [${i}]: BRANCH MISMATCH`, {
               ingredientId: ing.ingredientId,
               ingredientBranchId: ingredient.branchId,
               menuItemBranchId: targetBranchId,
             });
             throw new AppError(`Ingredient "${ing.ingredientId}" belongs to branch "${ingredient.branchId}" but menu item belongs to branch "${targetBranchId}"`, 400);
           }
         }
         console.log(`All ${body.ingredients.length} ingredients validated successfully`);
       } else {
         console.log('No ingredients provided (body.ingredients is', body.ingredients, ')');
       }

     // Use transaction to create MenuItem and MenuItemIngredients together
     const item = await prisma.$transaction(async (tx) => {
      const createData = {
        name: body.name,
        categoryId,
        price: body.price,
        cost: body.cost,
        description: body.description === '' ? '' : (body.description || ''),
        imageUrl: body.imageUrl || null,
        available: body.available ?? true,
        ...branchInfo,
      };
      console.log('Prisma create data:', JSON.stringify(createData, null, 2));

      // Kiểm tra createData không thiếu field required
      if (!createData.branchId) {
        console.error('CRITICAL: branchId missing from createData despite checks. branchInfo:', branchInfo, 'user:', user);
        throw new AppError('Internal error: branchId is required', 500);
      }

      const menuItem = await tx.menuItem.create({
          data: createData,
         include: { category: true, ingredients: { include: { ingredient: true } } },
       });

       // Create ingredient associations if provided
       if (body.ingredients && Array.isArray(body.ingredients)) {
         for (const ing of body.ingredients) {
           if (ing.ingredientId && ing.amount) {
             await tx.menuItemIngredient.upsert({
               where: { menuItemId_ingredientId: { menuItemId: menuItem.id, ingredientId: ing.ingredientId } },
               create: { menuItemId: menuItem.id, ingredientId: ing.ingredientId, amount: Number(ing.amount) },
               update: { amount: Number(ing.amount) },
             });
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
      assertBranchAccess(existing, user, 'món ăn');

      // Validate ingredients before transaction
      if (body.ingredients && Array.isArray(body.ingredients)) {
        for (let i = 0; i < body.ingredients.length; i++) {
          const ing = body.ingredients[i];
          if (ing.amount === undefined || ing.amount === null || ing.amount === '' || Number(ing.amount) <= 0) {
            throw new AppError(`Ingredient at index ${i}: amount must be a positive number, got ${JSON.stringify(ing.amount)}`, 400);
          }
          if (!ing.ingredientId || ing.ingredientId === '') {
            throw new AppError(`Ingredient at index ${i}: ingredientId is required`, 400);
          }
          const ingredient = await prisma.ingredient.findUnique({
            where: { id: ing.ingredientId },
            select: { id: true, branchId: true },
          });
          if (!ingredient) {
            throw new AppError(`Ingredient not found: ${ing.ingredientId}`, 400);
          }
          if (existing.branchId && ingredient.branchId !== existing.branchId) {
            throw new AppError(`Ingredient "${ing.ingredientId}" belongs to a different branch`, 400);
          }
        }
      }

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
          updateData.categoryId = await resolveCategoryId(body, existing.branchId || user?.branchId);
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
               data: { menuItemId: id, ingredientId: ing.ingredientId, amount: Number(ing.amount) },
             });
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
    assertBranchAccess(existing, user, 'món ăn');

    const item = await menuItemRepository.update(id, { available: !existing.available });
    return mapMenuItem(item);
  },

  async deleteMenuItem(id, user) {
    const existing = await menuItemRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy món ăn', 404);
    assertBranchAccess(existing, user, 'món ăn');

    const orderCount = await prisma.orderItem.count({ where: { menuItemId: id } });
    if (orderCount > 0) {
      await menuItemRepository.softDelete(id);
      return;
    }

    await menuItemRepository.delete(id);
  },

  /** Top món bán chạy - khớp foodOrderStats frontend */
  async getTopSelling(limit = 10, user) {
    const canAccessAll = user?.permissions?.includes('BRANCH_ALL_ACCESS') || user?.permissions?.includes('CROSS_BRANCH_ACCESS');
    const branchId = !canAccessAll ? user?.branchId : undefined;
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

async function resolveCategoryId(body, branchId) {
  if (body.categoryId) {
    console.log('resolveCategoryId: using direct categoryId:', body.categoryId);
    return body.categoryId;
  }
  if (body.category) {
    console.log('resolveCategoryId: searching by name:', JSON.stringify(body.category), 'branchId:', branchId);
    let cat = await categoryRepository.findByName(body.category, branchId);
    console.log('resolveCategoryId: findByName result:', cat ? JSON.stringify(cat, null, 2) : 'NULL');
    if (!cat) {
      if (!branchId) {
        console.error('resolveCategoryId: category not found and cannot create - no branchId. User likely has no branch assigned.');
        throw new AppError('Category "' + body.category + '" not found and cannot be auto-created: user has no branch assigned', 400);
      }
      console.log('resolveCategoryId: category not found, creating new one with branchId:', branchId);
      const newCat = await categoryRepository.create({
        name: body.category,
        slug: slugify(body.category),
        branchId,
      });
      console.log('resolveCategoryId: created category:', JSON.stringify(newCat, null, 2));
      return newCat.id;
    }
    console.log('resolveCategoryId: found existing category id:', cat.id);
    return cat.id;
  }
  console.error('resolveCategoryId: no categoryId or category provided in body. Body keys:', Object.keys(body));
  throw new AppError('Danh mục là bắt buộc (category or categoryId required)', 400);
}
