import prisma from '../../prisma/client.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/AppError.js';
import { permissionService } from '../permissions/permission.service.js';
import { assertBranchAccess, buildBranchWhere } from '../../middlewares/branchScope.js';

export const rbacController = {
  // --- Accounts ---
  getAccounts: asyncHandler(async (req, res) => {
    const where = {};
    if (!req.user.permissions?.includes('PERMISSION_ASSIGN') && !req.user.permissions?.includes('BRANCH_ALL_ACCESS')) {
      where.branchId = req.user.branchId;
    }
    
    const accounts = await prisma.account.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
      },
      orderBy: { fullName: 'asc' },
    });
    sendSuccess(res, { data: accounts });
  }),

  // --- Permissions ---
  getPermissions: asyncHandler(async (req, res) => {
    const permissions = await prisma.permission.findMany({
      orderBy: { module: 'asc' },
    });
    sendSuccess(res, { data: permissions });
  }),

  // --- Account Permissions ---
  getAccountPermissions: asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    
    const targetAccount = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, branchId: true },
    });
    if (!targetAccount) throw new AppError('Tài khoản không tồn tại', 404);
    assertBranchAccess(targetAccount, req.user, 'tài khoản');

    const permissions = await prisma.accountPermission.findMany({
      where: { accountId },
      include: { permission: true },
    });

    sendSuccess(res, { data: permissions });
  }),

  updateAccountPermissions: asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const { permissions } = req.body;
    const grantorId = req.user.id;

    const targetAccount = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, branchId: true },
    });
    if (!targetAccount) throw new AppError('Tài khoản không tồn tại', 404);
    assertBranchAccess(targetAccount, req.user, 'tài khoản');

    await prisma.$transaction(async (tx) => {
      // Get current permissions for logging
      const oldPermissions = await tx.accountPermission.findMany({
        where: { accountId },
        include: { permission: true },
      });

      // Clear old permissions
      await tx.accountPermission.deleteMany({
        where: { accountId },
      });

      // Add new permissions
      if (permissions && permissions.length > 0) {
        await tx.accountPermission.createMany({
          data: permissions.map(p => ({
            accountId,
            permissionId: p.permissionId,
            allowed: p.allowed ?? true,
            grantedBy: grantorId,
          })),
        });
      }

      // Audit Log
      await tx.activityLog.create({
        data: {
          branchId: req.user.branchId,
          accountId: grantorId,
          action: 'UPDATE_ACCOUNT_PERMISSIONS',
          module: 'PERMISSION_MANAGEMENT',
          details: {
            targetAccountId: accountId,
            oldPermissions: oldPermissions.map(p => ({ code: p.permission.code, allowed: p.allowed })),
            newPermissions: permissions,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    });

    // Invalidate cache
    permissionService.invalidateCache(accountId);

    sendSuccess(res, { message: 'Cập nhật quyền tài khoản thành công' });
  }),

  // --- Legacy Role methods removed as per requirement ---
};
