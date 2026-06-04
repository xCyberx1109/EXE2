import prisma from '../../prisma/client.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
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
  getAccounts: asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({
      select: { id: true, fullName: true, email: true, status: true },
      orderBy: { fullName: 'asc' },
    });
    sendSuccess(res, { data: accounts });
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
