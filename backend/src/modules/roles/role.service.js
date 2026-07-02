import { AppError } from '../../utils/AppError.js';
import { roleRepository } from '../../repositories/role.repository.js';
import prisma from '../../prisma/client.js';

function mapRole(role) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    employeeCount: role._count?.employees ?? 0,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

async function assertOwnedByAccount(id, accountId) {
  const role = await roleRepository.findById(id);
  if (!role || role.deletedAt || role.accountId !== accountId) {
    throw new AppError('Không tìm thấy vai trò', 404);
  }
  return role;
}

export const roleService = {
  async list(accountId) {
    const roles = await roleRepository.findAll(accountId);
    return roles.map(mapRole);
  },

  async getById(id, accountId) {
    await assertOwnedByAccount(id, accountId);
    const role = await roleRepository.findByIdWithPermissions(id);
    return {
      ...mapRole(role),
      permissionIds: role.rolePermissions.map((rp) => rp.permissionId),
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name,
        module: rp.permission.module,
      })),
    };
  },

  async create(accountId, data) {
    const name = data.name.trim();
    const existing = await roleRepository.findByName(accountId, name);
    if (existing) throw new AppError(`Vai trò "${name}" đã tồn tại`, 409);

    const role = await roleRepository.create({
      accountId,
      name,
      description: data.description?.trim() || null,
    });

    return mapRole({ ...role, _count: { employees: 0 } });
  },

  async update(id, accountId, data) {
    await assertOwnedByAccount(id, accountId);

    const updateData = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      const existing = await roleRepository.findByName(accountId, name);
      if (existing && existing.id !== id) throw new AppError(`Vai trò "${name}" đã tồn tại`, 409);
      updateData.name = name;
    }
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;

    await roleRepository.update(id, updateData);
    const withCount = await roleRepository.findByIdWithCount(id);
    return mapRole(withCount);
  },

  async delete(id, accountId) {
    await assertOwnedByAccount(id, accountId);

    const employeeCount = await roleRepository.countActiveEmployees(id);
    if (employeeCount > 0) {
      throw new AppError('Không thể xóa vai trò đang được gán cho nhân viên. Vui lòng đổi vai trò cho nhân viên trước.', 400);
    }

    await roleRepository.softDelete(id);
  },

  /** Thay toàn bộ danh sách permission gán cho role. */
  async setPermissions(id, accountId, permissionIds) {
    await assertOwnedByAccount(id, accountId);

    const ids = Array.isArray(permissionIds) ? [...new Set(permissionIds)] : [];
    if (ids.length > 0) {
      const validCount = await prisma.permission.count({ where: { id: { in: ids } } });
      if (validCount !== ids.length) {
        throw new AppError('Danh sách quyền không hợp lệ', 400);
      }
    }

    await roleRepository.setPermissions(id, ids);
    return this.getById(id, accountId);
  },
};
