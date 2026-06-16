import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { lockService } from '../utils/lockService.js';
import { requestLogger } from '../utils/logger.js';
import { authenticate, requirePermission } from '../middlewares/auth.js';
import { enforceBranchScope } from '../middlewares/branchScope.js';
import { sendInviteEmail, sendCredentialsEmail } from '../services/email.service.js';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

function formatBranch(account) {
  return {
    id: account.id,
    name: account.fullName,
    address: '',
    phone: account.phone || '',
    plan: 'BASIC',
    subscriptionStatus: 'ACTIVE',
    subscriptionStart: account.createdAt instanceof Date
      ? account.createdAt.toISOString()
      : account.createdAt,
    subscriptionEnd: new Date('2099-12-31').toISOString(),
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

router.get('/', requirePermission('BRANCH_VIEW'), asyncHandler(async (req, res) => {
  try {
    const accountId = req.user.accountId || req.user.id;
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    sendSuccess(res, {
      message: 'Lấy danh sách chi nhánh thành công',
      data: account ? [formatBranch(account)] : [],
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
  const { name, phone, email, fullName, active } = req.body;
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
        select: { id: true, code: true },
      });

      for (const p of perms) {
        await tx.accountPermission.upsert({
          where: { accountId_permissionId: { accountId: newAccount.id, permissionId: p.id } },
          update: { allowed: true },
          create: { accountId: newAccount.id, permissionId: p.id, allowed: true },
        });
      }

      return newAccount;
    });

    requestLogger.log(requestId, `[BRANCH_CREATE] accountId=${account.id} email=${email}`);

    sendCredentialsEmail({
      email: account.email,
      fullName: account.fullName,
      password: tempPassword,
    }).catch(() => {});

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

    if (id !== currentAccountId) {
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

    sendSuccess(res, {
      message: 'Cập nhật chi nhánh thành công',
      data: formatBranch(account),
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

    if (id !== currentAccountId) {
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

    console.log(`[PUT /api/branches/reset-password] invite token generated for ${account.id}`);

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

    if (id !== currentAccountId) {
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

    if (id !== currentAccountId) {
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

router.delete('/:id', requirePermission('BRANCH_DELETE'), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const currentAccountId = req.user.accountId || req.user.id;

    if (id !== currentAccountId) {
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

    if (id !== currentAccountId) {
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
