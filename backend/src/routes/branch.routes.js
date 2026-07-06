import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { lockService } from '../utils/lockService.js';
import { requestLogger } from '../utils/logger.js';
import { authenticate, requirePermission } from '../middlewares/auth.js';
import { permissionService } from '../modules/permissions/permission.service.js';
import { enforceBranchScope } from '../middlewares/branchScope.js';
import { sendInviteEmail, sendCredentialsEmail } from '../services/email.service.js';
import { assignPlanPermissions, syncPlanPermissions } from '../services/planPermission.service.js';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

const PLAN_LABEL_MAP = {
  basic: 'BASIC',
  pro: 'STANDARD',
  enterprise: 'PREMIUM',
};

function getPlanLabel(code) {
  return PLAN_LABEL_MAP[code] || 'BASIC';
}

function formatBranch(account, subscription) {
  const planCode = subscription?.plan?.code || 'basic';
  return {
    id: account.id,
    name: account.fullName,
    address: '',
    phone: account.phone || '',
    plan: getPlanLabel(planCode),
    subscriptionStatus: subscription?.status || 'ACTIVE',
    subscriptionStart: subscription?.startDate instanceof Date
      ? subscription.startDate.toISOString()
      : (subscription?.startDate || account.createdAt),
    subscriptionEnd: subscription?.endDate instanceof Date
      ? subscription.endDate.toISOString()
      : new Date('2099-12-31').toISOString(),
    active: account.active,
    createdAt: account.createdAt instanceof Date
      ? account.createdAt.toISOString()
      : account.createdAt,
    updatedAt: account.updatedAt instanceof Date
      ? account.updatedAt.toISOString()
      : account.updatedAt,
    account: {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      accountId: account.id,
    },
  };
}

async function getSubscription(accountId) {
  return prisma.subscription.findFirst({
    where: { branchId: accountId, deletedAt: null },
    include: { plan: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getPlanId(plan) {
  const code = plan?.toLowerCase() === 'standard' ? 'pro'
    : plan?.toLowerCase() === 'premium' ? 'enterprise'
    : 'basic';
  const found = await prisma.subscriptionPlan.findUnique({ where: { code }, select: { id: true } });
  return found?.id || null;
}

function isAdminAll(user) {
  return user.permissions?.includes('PERMISSION_MANAGE');
}

router.get('/', requirePermission('BRANCH_VIEW'), asyncHandler(async (req, res) => {
  try {
    const canManageAll = isAdminAll(req.user);

    if (canManageAll) {
      const accounts = await prisma.account.findMany({
        orderBy: { createdAt: 'desc' },
      });
      const subs = await prisma.subscription.findMany({
        where: { branchId: { in: accounts.map(a => a.id) }, deletedAt: null },
        include: { plan: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      const subMap = {};
      for (const s of subs) {
        if (!subMap[s.branchId]) subMap[s.branchId] = s;
      }
      return sendSuccess(res, {
        message: 'Lấy danh sách chi nhánh thành công',
        data: accounts.map(a => formatBranch(a, subMap[a.id])),
      });
    }

    const accountId = req.user.accountId || req.user.id;
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    const sub = account ? await getSubscription(account.id) : null;

    sendSuccess(res, {
      message: 'Lấy danh sách chi nhánh thành công',
      data: account ? [formatBranch(account, sub)] : [],
    });
  } catch (err) {
    console.error('[GET /api/branches] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi lấy danh sách chi nhánh',
      error: err.message,
    });
  }
}));

router.post('/', requirePermission('BRANCH_CREATE'), asyncHandler(async (req, res) => {
  const { name, phone, email, fullName, active, plan, permissions } = req.body;
  const { requestId } = req;

  if (!name || !email) {
    return sendError(res, {
      statusCode: 400,
      message: 'Vui lòng nhập tên chi nhánh và email quản lý',
    });
  }

  const lockKey = `create_account:${email}`;

  requestLogger.log(requestId, `[ACCOUNT_CREATE_HIT] email=${email}`);

  if (!lockService.acquire(lockKey)) {
    requestLogger.warn(requestId, `[DUPLICATE_BLOCKED] email=${email} — request đang được xử lý`);
    return sendError(res, {
      statusCode: 429,
      message: 'Yêu cầu tạo chi nhánh với email này đang được xử lý, vui lòng đợi',
    });
  }

  try {
    const tempPassword = crypto.randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const account = await prisma.$transaction(async (tx) => {
      const existing = await tx.account.findUnique({ where: { email } });
      if (existing) {
        requestLogger.warn(requestId, `[DUPLICATE_EMAIL] email=${email} — tài khoản đã tồn tại`);
        throw Object.assign(new Error('Email quản lý đã được sử dụng'), { statusCode: 409 });
      }

      const newAccount = await tx.account.create({
        data: {
          email,
          password: hashedPassword,
          fullName: fullName || name,
          phone: phone || '',
          active: active !== undefined ? Boolean(active) : true,
          mustChangePassword: true,
        },
      });

      const perms = await tx.permission.findMany({
        where: { code: { in: ['BRANCH_VIEW', 'BRANCH_UPDATE', 'DASHBOARD_VIEW'] } },
        select: { id: true },
      });

      await tx.accountPermission.createMany({
        data: perms.map(p => ({
          accountId: newAccount.id,
          permissionId: p.id,
          allowed: true,
        })),
        skipDuplicates: true,
      });

      const planId = await getPlanId(plan);
      if (planId) {
        const subStart = req.body.subscriptionStart
          ? new Date(req.body.subscriptionStart)
          : new Date();
        const subEnd = req.body.subscriptionEnd
          ? new Date(req.body.subscriptionEnd)
          : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

        await tx.subscription.create({
          data: {
            branchId: newAccount.id,
            planId,
            status: SubscriptionStatus.ACTIVE,
            startDate: subStart,
            endDate: subEnd,
            autoRenew: true,
          },
        });
      }

      return newAccount;
    });

    requestLogger.log(requestId, `[BRANCH_CREATE] accountId=${account.id} email=${email}`);

    await assignPlanPermissions(account.id, plan);

    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      try {
        const permRecords = await prisma.permission.findMany({
          where: { code: { in: permissions } },
          select: { id: true },
        });

        await prisma.accountPermission.createMany({
          data: permRecords.map(p => ({
            accountId: account.id,
            permissionId: p.id,
            allowed: true,
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        console.error('[POST /api/branches] Error saving custom permissions:', err.message);
      }
    }

    permissionService.invalidateCache(account.id);

    try {
      await sendCredentialsEmail({
        email: account.email,
        fullName: account.fullName,
        password: tempPassword,
      });
    } catch (_) {
      // email send failure is non-critical
    }

    sendSuccess(res, {
      statusCode: 201,
      message: `Tạo chi nhánh thành công. Mật khẩu đã được gửi đến email ${email}`,
      data: {
        email,
      },
    });
  } catch (err) {
    requestLogger.error(requestId, `[POST /api/branches] Error:`, err.message);

    if (err.statusCode === 409) {
      return sendError(res, {
        statusCode: 409,
        message: 'Email quản lý đã được sử dụng',
      });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      requestLogger.error(requestId, `[P2002_UNIQUE_VIOLATION] email=${email} — Prisma unique constraint`);
      return sendError(res, {
        statusCode: 409,
        message: 'Email quản lý đã được sử dụng',
      });
    }

    return sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi tạo chi nhánh',
      error: err.message,
    });
  } finally {
    lockService.release(lockKey);
  }
}));

router.put('/:id', requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;

    if (id !== currentAccountId && !isAdminAll(req.user)) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền cập nhật tài khoản khác',
      });
    }

    const { name, phone, email, fullName, active } = req.body;

    const data = {};
    if (name !== undefined) data.fullName = name;
    if (phone !== undefined) data.phone = phone;
    if (fullName !== undefined) data.fullName = fullName;
    if (active !== undefined) data.active = Boolean(active);
    if (email !== undefined) data.email = email;

    const account = await prisma.account.update({
      where: { id },
      data,
    });

    const sub = await getSubscription(id);

    sendSuccess(res, {
      message: 'Cập nhật chi nhánh thành công',
      data: formatBranch(account, sub),
    });
  } catch (err) {
    console.error('[PUT /api/branches/:id] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi cập nhật chi nhánh',
      error: err.message,
    });
  }
}));

router.put('/:id/reset-password', requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;

    if (id !== currentAccountId && !isAdminAll(req.user)) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền đặt lại mật khẩu cho tài khoản khác',
      });
    }

    const account = await prisma.account.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true },
    });

    if (!account) {
      return sendError(res, { statusCode: 404, message: 'Không tìm thấy tài khoản' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');

    await prisma.$transaction(async (tx) => {
      await tx.inviteToken.updateMany({
        where: { accountId: id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await tx.inviteToken.create({
        data: {
          email: account.email,
          token: rawToken,
          accountId: account.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    const inviteLink = `${req.protocol}://${req.get('host')}/set-password?token=${rawToken}`;

    requestLogger.log(requestId, `[RESET_PASSWORD_INVITE] invite generated for accountId=${account.id} email=${account.email}`);

    sendInviteEmail({
      email: account.email,
      fullName: account.fullName,
      inviteLink,
    }).catch(() => {});

    sendSuccess(res, {
      message: `Đã tạo link đặt lại mật khẩu cho "${account.fullName}".`,
      data: {
        accountId: account.id,
        branchName: account.fullName,
        accountEmail: account.email,
        accountFullName: account.fullName,
        inviteLink,
      },
    });
  } catch (err) {
    console.error('[PUT /api/branches/:id/reset-password] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi đặt lại mật khẩu',
      error: err.message,
    });
  }
}));

router.patch('/:id/lock', requirePermission('BRANCH_LOCK'), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;

    if (id !== currentAccountId && !isAdminAll(req.user)) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền khóa tài khoản khác',
      });
    }

    const account = await prisma.account.findUnique({
      where: { id },
      select: { id: true, fullName: true, active: true },
    });

    if (!account) {
      return sendError(res, { statusCode: 404, message: 'Không tìm thấy tài khoản' });
    }

    await prisma.account.update({ where: { id }, data: { active: false } });

    sendSuccess(res, {
      message: `Đã khóa tài khoản "${account.fullName}"`,
      data: { id, active: false },
    });
  } catch (err) {
    console.error('[PATCH /api/branches/:id/lock] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi khóa tài khoản',
      error: err.message,
    });
  }
}));

router.patch('/:id/unlock', requirePermission('BRANCH_UNLOCK'), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;

    if (id !== currentAccountId && !isAdminAll(req.user)) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền mở khóa tài khoản khác',
      });
    }

    const account = await prisma.account.findUnique({
      where: { id },
      select: { id: true, fullName: true, active: true },
    });

    if (!account) {
      return sendError(res, { statusCode: 404, message: 'Không tìm thấy tài khoản' });
    }

    await prisma.account.update({ where: { id }, data: { active: true } });

    sendSuccess(res, {
      message: `Đã mở khóa tài khoản "${account.fullName}"`,
      data: { id, active: true },
    });
  } catch (err) {
    console.error('[PATCH /api/branches/:id/unlock] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi mở khóa tài khoản',
      error: err.message,
    });
  }
}));

router.put('/:id/plan', requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;
    const currentAccountId = req.user.accountId || req.user.id;

    if (id !== currentAccountId && !isAdminAll(req.user)) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền thay đổi gói của tài khoản khác',
      });
    }

    if (!plan) {
      return sendError(res, {
        statusCode: 400,
        message: 'Vui lòng chọn gói (BASIC / STANDARD / PREMIUM)',
      });
    }

    const planId = await getPlanId(plan);
    if (!planId) {
      return sendError(res, {
        statusCode: 400,
        message: 'Gói không hợp lệ',
      });
    }

    const existingSub = await prisma.subscription.findFirst({
      where: { branchId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    await prisma.$transaction(async (tx) => {
      if (existingSub) {
        const subStart = new Date();
        const subEnd = new Date(subStart);
        subEnd.setFullYear(subEnd.getFullYear() + 1);

        await tx.subscription.update({
          where: { id: existingSub.id },
          data: {
            planId,
            startDate: subStart,
            endDate: subEnd,
            status: SubscriptionStatus.ACTIVE,
          },
        });
      } else {
        const subStart = new Date();
        const subEnd = new Date(subStart);
        subEnd.setFullYear(subEnd.getFullYear() + 1);

        await tx.subscription.create({
          data: {
            branchId: id,
            planId,
            status: SubscriptionStatus.ACTIVE,
            startDate: subStart,
            endDate: subEnd,
            autoRenew: true,
          },
        });
      }
    });

    await syncPlanPermissions(id, plan);
    permissionService.invalidateCache(id);

    sendSuccess(res, {
      message: 'Đã cập nhật gói dịch vụ thành công',
      data: { plan },
    });
  } catch (err) {
    console.error('[PUT /api/branches/:id/plan] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi cập nhật gói dịch vụ',
      error: err.message,
    });
  }
}));

router.delete('/:id', requirePermission('BRANCH_DELETE'), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;

    if (id !== currentAccountId && !isAdminAll(req.user)) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền xóa tài khoản khác',
      });
    }

    const account = await prisma.account.findUnique({
      where: { id },
      select: { id: true, fullName: true },
    });

    if (!account) {
      return sendError(res, { statusCode: 404, message: 'Không tìm thấy tài khoản' });
    }

    await prisma.account.update({ where: { id }, data: { active: false } });

    sendSuccess(res, { message: `Đã xóa tài khoản "${account.fullName}"`, data: null });
  } catch (err) {
    console.error('[DELETE /api/branches/:id] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi xóa tài khoản',
      error: err.message,
    });
  }
}));

router.delete('/:id/force', requirePermission('BRANCH_FORCE_DELETE'), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;

    if (id !== currentAccountId && !isAdminAll(req.user)) {
      return sendError(res, {
        statusCode: 403,
        message: 'Bạn không có quyền xóa tài khoản khác',
      });
    }

    const account = await prisma.account.findUnique({
      where: { id },
      select: { id: true, fullName: true },
    });

    if (!account) {
      return sendError(res, { statusCode: 404, message: 'Không tìm thấy tài khoản' });
    }

    await prisma.accountPermission.deleteMany({ where: { accountId: id } });
    await prisma.account.delete({ where: { id } });

    sendSuccess(res, {
      message: `Đã xóa vĩnh viễn tài khoản "${account.fullName}"`,
      data: { branchName: account.fullName, stats: {} },
    });
  } catch (err) {
    console.error('[DELETE /api/branches/:id/force] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi xóa vĩnh viễn tài khoản',
      error: err.message,
    });
  }
}));

export default router;
