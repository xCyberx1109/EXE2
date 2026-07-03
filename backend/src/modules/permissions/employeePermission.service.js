import prisma from '../../prisma/client.js';

export const employeePermissionService = {
  async getEffectivePermissions(employeeId) {
    const permissions = await prisma.employeePermission.findMany({
      where: { employeeId, allowed: true },
      include: { permission: true },
    });
    return permissions.map(ep => ep.permission.code);
  },

  async hasPermission(employeeId, permissionCode) {
    const permissions = await this.getEffectivePermissions(employeeId);
    return permissions.includes(permissionCode);
  },

  async setPermissions(employeeId, permissionIds, allowed = true) {
    await prisma.employeePermission.deleteMany({
      where: { employeeId },
    });
    if (permissionIds.length > 0) {
      await prisma.employeePermission.createMany({
        data: permissionIds.map(permissionId => ({
          employeeId,
          permissionId,
          allowed,
        })),
      });
    }
  },

  async setPermissionCodes(employeeId, permissionCodes) {
    const permissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });
    const permissionIds = permissions.map(p => p.id);
    await this.setPermissions(employeeId, permissionIds);
  },

  async grantAllPermissions(employeeId) {
    const allPerms = await prisma.permission.findMany({ select: { id: true } });
    await this.setPermissions(employeeId, allPerms.map(p => p.id));
  },
};
