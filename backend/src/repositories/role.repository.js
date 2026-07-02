import prisma from '../prisma/client.js';

export const roleRepository = {
  findAll: (accountId) =>
    prisma.role.findMany({
      where: { accountId, deletedAt: null },
      include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
      orderBy: { name: 'asc' },
    }),

  findById: (id) =>
    prisma.role.findUnique({ where: { id } }),

  findByIdWithCount: (id) =>
    prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
    }),

  findByIdWithPermissions: (id) =>
    prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { employees: { where: { deletedAt: null } } } },
      },
    }),

  findByName: (accountId, name) =>
    prisma.role.findFirst({ where: { accountId, name, deletedAt: null } }),

  countActiveEmployees: (roleId) =>
    prisma.employee.count({ where: { roleId, deletedAt: null } }),

  create: (data) => prisma.role.create({ data }),

  update: (id, data) => prisma.role.update({ where: { id }, data }),

  softDelete: (id) =>
    prisma.role.update({ where: { id }, data: { deletedAt: new Date() } }),

  /** Thay toàn bộ danh sách permission gán cho role (trong 1 transaction). */
  setPermissions: (roleId, permissionIds) =>
    prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    }),
};
