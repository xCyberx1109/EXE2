import prisma from '../../prisma/client.js';

// In-memory cache for permissions
// In production with multiple instances, use Redis instead.
const permissionCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map();

// Track khi permissions của từng account thay đổi (dùng cho frontend polling detect)
const lastModifiedTimestamps = new Map();

export const permissionService = {
  async getEffectivePermissions(accountId) {
    if (!accountId) return [];

    const cached = permissionCache.get(accountId);
    const timestamp = cacheTimestamps.get(accountId);
    if (cached && timestamp && Date.now() - timestamp < CACHE_TTL_MS) {
      return cached;
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        accountPermissions: {
          where: { allowed: true },
          include: { permission: true },
        },
      },
    });

    if (!account) return [];

    // Cleanup duplicates (nếu có) giữ lại 1 record
    const seen = new Set();
    const unique = [];
    for (const ap of account.accountPermissions) {
      if (!ap.permission) continue;
      const key = ap.permission.code;
      if (seen.has(key)) {
        await prisma.accountPermission.delete({ where: { id: ap.id } }).catch(() => {});
      } else {
        seen.add(key);
        unique.push(ap);
      }
    }
    const permissions = unique.map(ap => ap.permission.code);

    permissionCache.set(accountId, permissions);
    cacheTimestamps.set(accountId, Date.now());

    return permissions;
  },

  async getPermissionsWithVersion(accountId) {
    const permissions = await this.getEffectivePermissions(accountId);
    const version = lastModifiedTimestamps.get(accountId) || 0;
    return { permissions, version };
  },

  getPermissionsVersion(accountId) {
    return lastModifiedTimestamps.get(accountId) || 0;
  },

  async hasPermission(accountId, permissionCode) {
    const permissions = await this.getEffectivePermissions(accountId);
    return permissions.includes(permissionCode);
  },

  invalidateCache(accountId) {
    const now = Date.now();
    if (accountId) {
      permissionCache.delete(accountId);
      cacheTimestamps.delete(accountId);
      lastModifiedTimestamps.set(accountId, now);
    } else {
      permissionCache.clear();
      cacheTimestamps.clear();
      lastModifiedTimestamps.clear();
    }
  },

  async logPermissionChange(grantorId, targetAccountId, oldPermissions, newPermissions, req) {
    try {
      await prisma.activityLog.create({
        data: {
          branchId: req?.user?.branchId || null,
          accountId: grantorId,
          action: 'UPDATE_ACCOUNT_PERMISSIONS',
          module: 'PERMISSION_MANAGEMENT',
          details: {
            targetAccountId,
            oldPermissions,
            newPermissions,
          },
          ipAddress: req?.ip || null,
          userAgent: req?.headers?.['user-agent'] || null,
        },
      });
    } catch (err) {
      console.error('Failed to log permission change:', err);
    }
  },
};
