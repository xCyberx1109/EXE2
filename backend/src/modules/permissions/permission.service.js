import crypto from 'crypto';
import prisma from '../../prisma/client.js';

const CACHE_TTL = 60_000;
const permissionCache = new Map();

function getCached(accountId) {
  const entry = permissionCache.get(accountId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    permissionCache.delete(accountId);
    return null;
  }
  return entry.permissions;
}

function setCached(accountId, permissions) {
  permissionCache.set(accountId, { permissions, timestamp: Date.now() });
}

export const permissionService = {
  async getEffectivePermissions(accountId) {
    const cached = getCached(accountId);
    if (cached) return cached;

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        accountPermissions: {
          include: { permission: true },
        },
      },
    });

    if (!account) return [];

    const permissions = account.accountPermissions
      .filter(ap => ap.allowed)
      .map(ap => ap.permission.code);

    setCached(accountId, permissions);
    return permissions;
  },

  async hasPermission(accountId, permissionCode) {
    const permissions = await this.getEffectivePermissions(accountId);
    return permissions.includes(permissionCode);
  },

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

  invalidateCache(accountId) {
    if (accountId) {
      permissionCache.delete(accountId);
    } else {
      permissionCache.clear();
    }
  }
};
