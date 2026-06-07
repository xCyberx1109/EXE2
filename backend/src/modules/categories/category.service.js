import { AppError } from '../../utils/AppError.js';
import { slugify } from '../../utils/mappers.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { assertBranchAccess, buildBranchWhere } from '../../middlewares/branchScope.js';

export const categoryService = {
  async list(user, queryAccountId) {
    const accountWhere = buildBranchWhere(user, {}, 'accountId');
    const where = accountWhere.accountId ? accountWhere : (queryAccountId ? { accountId: queryAccountId } : { deletedAt: null });
    if (!where.deletedAt) where.deletedAt = null;
    where.active = true;
    const categories = await categoryRepository.findAll(where);
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sortOrder,
      active: c.active,
      itemCount: c._count?.menuItems ?? 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },

  async getById(id, user) {
    const category = await categoryRepository.findById(id);
    if (!category || category.deletedAt) throw new AppError('Không tìm thấy danh mục', 404);
    assertBranchAccess(category, user, 'danh mục');
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
      active: category.active,
      itemCount: category._count?.menuItems ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  },

  async create(data, user) {
    const slug = slugify(data.name);
    const accountId = user.accountId || user.id;
    if (accountId) {
      const existing = await categoryRepository.findByName(data.name, accountId);
      if (existing) throw new AppError('Danh mục đã tồn tại trong tài khoản này', 409);
    }
    const category = await categoryRepository.create({
      name: data.name,
      slug,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
      accountId: accountId,
    });
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
      active: category.active,
      itemCount: 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  },

  async update(id, data, user) {
    const existing = await categoryRepository.findById(id);
    if (!existing || existing.deletedAt) throw new AppError('Không tìm thấy danh mục', 404);
    assertBranchAccess(existing, user, 'danh mục');

    if (data.name && data.name !== existing.name) {
      const duplicate = await categoryRepository.findByName(data.name, existing.accountId);
      if (duplicate && duplicate.id !== id) throw new AppError('Tên danh mục đã tồn tại trong tài khoản này', 409);
    }

    const updateData = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
      updateData.slug = slugify(data.name);
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.active !== undefined) updateData.active = data.active;

    const updated = await categoryRepository.update(id, updateData);
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      sortOrder: updated.sortOrder,
      active: updated.active,
      itemCount: updated._count?.menuItems ?? 0,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  async delete(id, user) {
    const existing = await categoryRepository.findById(id);
    if (!existing || existing.deletedAt) throw new AppError('Không tìm thấy danh mục', 404);
    assertBranchAccess(existing, user, 'danh mục');

    const count = await menuItemRepository.count({ categoryId: id });
    if (count > 0) {
      throw new AppError('Không thể xóa danh mục đang có món ăn. Vui lòng di chuyển hoặc xóa món trước.', 400);
    }

    await categoryRepository.softDelete(id);
  },
};
