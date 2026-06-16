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
  // Chỉ cho phép user xem/quản lý permissions của chính account mình
  getAccounts: asyncHandler(async (req, res) => {
    const currentAccountId = req.user.accountId || req.user.id;

    const account = await prisma.account.findUnique({
      where: { id: currentAccountId },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        active: true,
        createdAt: true,
        accountPermissions: {
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
    });

    if (!account) {
      return sendSuccess(res, { data: [] });
    }

    const assignedPerms = account.accountPermissions.filter(ap => ap.allowed);
    const modules = [...new Set(assignedPerms.map(ap => ap.permission.module))];
    const data = [{
      ...account,
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
    }];

    sendSuccess(res, { data });
  }),

  getAccountPermissions: asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;

    // Chỉ cho phép xem permissions của chính mình
    if (accountId !== currentAccountId) {
      return sendSuccess(res, { data: [] });
    }

    const perms = await prisma.accountPermission.findMany({
      where: { accountId: currentAccountId },
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
    const currentAccountId = req.user.accountId || req.user.id;

    // Chỉ cho phép cập nhật permissions của chính mình
    if (accountId !== currentAccountId) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền cập nhật quyền cho tài khoản khác',
      });
    }

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
        where: { accountId: currentAccountId },
      });

      if (uniqueByPermissionId.length > 0) {
        await tx.accountPermission.createMany({
          data: uniqueByPermissionId.map((p) => ({
            accountId: currentAccountId,
            permissionId: p.permissionId,
            allowed: p.allowed,
          })),
        });
      }
    });

    sendSuccess(res, { message: 'Cập nhật quyền tài khoản thành công' });
  }),
};
