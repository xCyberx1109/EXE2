import prisma from '../../prisma/client.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/AppError.js';

export const rbacController = {
  // --- Permissions ---
  getPermissions: asyncHandler(async (req, res) => {
    const permissions = await prisma.permission.findMany({
      orderBy: { module: 'asc' },
    });

    // Hard guard: ensure no duplicates in API response (by permission code/id)
    const deduped = Array.from(
      new Map(
        permissions.map((p) => [
          p.code ?? p.id, // prefer stable code if present
          p,
        ]),
      ).values(),
    );

    sendSuccess(res, { data: deduped });
  }),

  // --- Account-level Direct Permissions (for PermissionManagement frontend) ---
  // User có PERMISSION_VIEW được xem tất cả accounts
  // User có PERMISSION_MANAGE được cập nhật permissions cho tất cả accounts
  getAccounts: asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        active: true,
        createdAt: true,
        accountPermissions: {
          where: { allowed: true },
          select: {
            permissionId: true,
            allowed: true,
            permission: {
              select: {
                id: true,
                code: true,
                name: true,
                module: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const data = accounts.map((account) => {
      const assignedPerms = account.accountPermissions.filter(ap => ap.allowed);
      const modules = [...new Set(assignedPerms.map(ap => ap.permission.module))];
      return {
        id: account.id,
        email: account.email,
        fullName: account.fullName,
        status: account.status,
        active: account.active,
        createdAt: account.createdAt,
        accountId: account.id,
        username: account.email,
        assignedRoles: modules,
        assignedPermissions: assignedPerms.map(ap => ({
          permissionId: ap.permissionId,
          permissionCode: ap.permission.code,
          permissionName: ap.permission.name,
          module: ap.permission.module,
          allowed: ap.allowed,
        })),
        permissionCount: assignedPerms.length,
      };
    });

    sendSuccess(res, { data });
  }),

  getAccountPermissions: asyncHandler(async (req, res) => {
    const { accountId } = req.params;

    const perms = await prisma.accountPermission.findMany({
      where: { accountId },
      select: { permissionId: true, allowed: true },
    });

    // Hard guard: no duplicate permissionId entries in API response
    const deduped = Array.from(
      new Map(
        perms.map((p) => [
          p.permissionId,
          p,
        ]),
      ).values(),
    );

    sendSuccess(res, { data: deduped });
  }),

  updateAccountPermissions: asyncHandler(async (req, res) => {
    const { accountId } = req.params;

    const { permissions } = req.body; // Array of { permissionId, allowed }

    // Defensive: dedupe payload by permissionId before writing
    const normalized = Array.isArray(permissions) ? permissions : [];
    const uniqueByPermissionId = Array.from(
      new Map(
        normalized.map((p) => [
          p.permissionId,
          { permissionId: p.permissionId, allowed: p.allowed },
        ]),
      ).values(),
    );

    await prisma.$transaction(async (tx) => {
      await tx.accountPermission.deleteMany({
        where: { accountId },
      });

      if (uniqueByPermissionId.length > 0) {
        await tx.accountPermission.createMany({
          data: uniqueByPermissionId.map((p) => ({
            accountId,
            permissionId: p.permissionId,
            allowed: p.allowed,
          })),
        });
      }
    });

    sendSuccess(res, { message: 'Cập nhật quyền tài khoản thành công' });
  }),
};
