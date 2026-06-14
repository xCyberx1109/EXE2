import { AppError } from '../../utils/AppError.js';
import { slugify } from '../../utils/mappers.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';

function mapCategory(c) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    sortOrder: c.sortOrder,
    active: c.active,
    itemCount: c._count?.menuItems ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    deletedAt: c.deletedAt,
  };
}

export const categoryService = {
  async list(query) {
    const { page = 1, limit = 20, search, sort, sortOrder, active, includeDeleted, deleted } = query;

    const [items, total] = await Promise.all([
      categoryRepository.findAll({
        page: Number(page),
        limit: Number(limit),
        search,
        sort,
        sortOrder,
        active: active !== undefined ? active === 'true' || active === true : undefined,
        includeDeleted,
        deleted,
      }),
      categoryRepository.count({
        search,
        active: active !== undefined ? active === 'true' || active === true : undefined,
        includeDeleted,
        deleted,
      }),
    ]);

    return {
      items: items.map(mapCategory),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  },

  async getById(id) {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);
    return mapCategory(category);
  },

  async create(data) {
    const slug = data.slug && data.slug.trim() ? slugify(data.slug) : slugify(data.name);

    const existing = await categoryRepository.findBySlug(slug);
    if (existing) throw new AppError(`Slug "${slug}" đã tồn tại`, 409);

    const category = await categoryRepository.create({
      name: data.name.trim(),
      slug,
      description: data.description?.trim() || null,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
    });

    return mapCategory(category);
  },

  async update(id, data) {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    const updateData = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
      const newSlug = data.slug && data.slug.trim() ? slugify(data.slug) : slugify(data.name);
      if (newSlug !== category.slug) {
        const existing = await categoryRepository.findBySlug(newSlug);
        if (existing && existing.id !== id) throw new AppError(`Slug "${newSlug}" đã tồn tại`, 409);
      }
      updateData.slug = newSlug;
    } else if (data.slug !== undefined) {
      const newSlug = slugify(data.slug);
      if (newSlug !== category.slug) {
        const existing = await categoryRepository.findBySlug(newSlug);
        if (existing && existing.id !== id) throw new AppError(`Slug "${newSlug}" đã tồn tại`, 409);
      }
      updateData.slug = newSlug;
    }

    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.active !== undefined) updateData.active = data.active;

    const updated = await categoryRepository.update(id, updateData);
    return mapCategory(updated);
  },

  async delete(id) {
    const category = await categoryRepository.findById(id);
    if (!category || category.deletedAt) throw new AppError('Không tìm thấy danh mục', 404);

    const count = await menuItemRepository.count({ categoryId: id, deletedAt: null });
    if (count > 0) {
      throw new AppError('Không thể xóa danh mục đang có món ăn. Vui lòng di chuyển hoặc xóa món trước.', 400);
    }

    await categoryRepository.softDelete(id);
  },

  async restore(id) {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);
    if (!category.deletedAt) throw new AppError('Danh mục chưa bị xóa', 400);

    await categoryRepository.restore(id);
    const restored = await categoryRepository.findById(id);
    return mapCategory(restored);
  },
};
