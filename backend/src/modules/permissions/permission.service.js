import crypto from 'crypto';
import prisma from '../../prisma/client.js';

export const permissionService = {
  /**
   * Lấy danh sách permission codes hiệu dụng của account.
   * Nguồn: AccountPermission (direct grants).
   */
  async getEffectivePermissions(accountId) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        accountPermissions: {
          include: { permission: true },
        },
      },
    });

    if (!account) return [];

    return account.accountPermissions
      .filter(ap => ap.allowed)
      .map(ap => ap.permission.code);
  },

  /**
   * Kiểm tra user có permission cụ thể không
   */
  async hasPermission(accountId, permissionCode) {
    const permissions = await this.getEffectivePermissions(accountId);
    return permissions.includes(permissionCode);
  },

  /**
   * Lấy danh sách permission codes của 1 Role (dùng cho Employee đăng nhập PIN).
   */
  async getRolePermissions(roleId) {
    if (!roleId) return [];

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!role || role.deletedAt) return [];

    return role.rolePermissions.map((rp) => rp.permission.code);
  },

  /**
   * Trả về version hash dựa trên danh sách permissions hiệu dụng
   * Dùng để client cache-busting: nếu permissions thay đổi → version khác
   */
  async getPermissionsVersion(accountId) {
    const permissions = await this.getEffectivePermissions(accountId);
    if (!permissions || permissions.length === 0) return 0;
    const hash = crypto.createHash('md5').update(permissions.sort().join(',')).digest('hex');
    let version = 0;
    for (let i = 0; i < hash.length; i++) {
      version = (version + hash.charCodeAt(i)) % 2147483647;
    }
    return version;
  },

  /**
   * Xóa cache permissions (Placeholder cho hệ thống cache sau này)
   */
  invalidateCache() {
    // console.log('→ Permission cache invalidated');
  }
};
