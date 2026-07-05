import prisma from '../../prisma/client.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/AppError.js';
import { syncPlanPermissions } from '../../services/planPermission.service.js';
import { permissionService } from '../permissions/permission.service.js';

const PLAN_CODE_MAP = {
  BASIC: 'basic',
  STANDARD: 'pro',
  PREMIUM: 'enterprise',
};

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
  // PERMISSION_MANAGE: xem toàn bộ account trong hệ thống
  // Người dùng thường: chỉ xem account của chính mình
  getAccounts: asyncHandler(async (req, res) => {
    const currentAccountId = req.user.accountId || req.user.id;
    const canManageAll = req.user.permissions?.includes('PERMISSION_MANAGE');

    const whereClause = canManageAll ? {} : { id: currentAccountId };

    const accounts = await prisma.account.findMany({
      where: whereClause,
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
      orderBy: { createdAt: 'desc' },
    });

    const data = accounts.map(account => {
      const assignedPerms = account.accountPermissions.filter(ap => ap.allowed);
      const modules = [...new Set(assignedPerms.map(ap => ap.permission.module))];
      return {
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
      };
    });

    sendSuccess(res, { data });
  }),

  getAccountPermissions: asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;
    const canManageAll = req.user.permissions?.includes('PERMISSION_MANAGE');

    // PERMISSION_MANAGE: xem permissions của bất kỳ account nào
    // Người dùng thường: chỉ xem permissions của chính mình
    if (accountId !== currentAccountId && !canManageAll) {
      return sendSuccess(res, { data: [] });
    }

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
    const currentAccountId = req.user.accountId || req.user.id;
    const canManageAll = req.user.permissions?.includes('PERMISSION_MANAGE');

    // PERMISSION_MANAGE: cập nhật permissions cho bất kỳ account nào
    // Người dùng thường: chỉ cập nhật permissions của chính mình
    if (accountId !== currentAccountId && !canManageAll) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền cập nhật quyền cho tài khoản khác',
      });
    }

    const targetAccountId = canManageAll ? accountId : currentAccountId;
    const { permissions, plan } = req.body; // Array of { permissionId, allowed }, optional plan

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
      // Only replace permissions when permissions payload is provided.
      // When plan-only (no permissions), preserve existing manually-assigned permissions.
      if (uniqueByPermissionId.length > 0) {
        await tx.accountPermission.deleteMany({
          where: { accountId: targetAccountId },
        });

        const createData = uniqueByPermissionId.map((p) => ({
          accountId: targetAccountId,
          permissionId: p.permissionId,
          allowed: p.allowed,
        }));
        await tx.accountPermission.createMany({ data: createData });
      }

      // Cập nhật subscription plan nếu có
      if (plan) {
        const planCode = PLAN_CODE_MAP[plan.toUpperCase()];
        if (planCode) {
          const subscriptionPlan = await tx.subscriptionPlan.findUnique({
            where: { code: planCode },
            select: { id: true },
          });
          if (subscriptionPlan) {
            const existingSub = await tx.subscription.findFirst({
              where: { branchId: targetAccountId, deletedAt: null },
              orderBy: { createdAt: 'desc' },
            });
            if (existingSub) {
              await tx.subscription.update({
                where: { id: existingSub.id },
                data: { planId: subscriptionPlan.id },
              });
            } else {
              await tx.subscription.create({
                data: {
                  branchId: targetAccountId,
                  planId: subscriptionPlan.id,
                  status: 'ACTIVE',
                  startDate: new Date(),
                  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                  autoRenew: true,
                },
              });
            }
          }
        }
      }
    });

    // Grant plan permissions when plan changed without explicit permissions payload.
    // This only adds plan permissions — never removes manually-assigned ones.
    if (plan && uniqueByPermissionId.length === 0) {
      await syncPlanPermissions(targetAccountId, plan).catch((err) => {
        console.error('[RBAC] Error syncing plan permissions:', err.message);
      });
    }

    permissionService.invalidateCache(targetAccountId);
    sendSuccess(res, { message: 'Cập nhật quyền tài khoản thành công' });
  }),
};
