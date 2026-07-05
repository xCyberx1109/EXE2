import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Prisma, SubscriptionStatus, InvitationStatus } from '@prisma/client';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { lockService } from '../utils/lockService.js';
import { requestLogger } from '../utils/logger.js';
import { authenticate, requirePermission } from '../middlewares/auth.js';
import { sendBranchInvitationEmail } from '../services/email.service.js';
import { assignPlanPermissions } from '../services/planPermission.service.js';
import { permissionService } from '../modules/permissions/permission.service.js';
import { logAction, getClientIp } from '../utils/auditLogger.js';
import config from '../config/index.js';

const router = Router();

const PLAN_LABEL_MAP = {
  BASIC: 'basic',
  STANDARD: 'pro',
  PREMIUM: 'enterprise',
};

function getPlanCode(label) {
  return PLAN_LABEL_MAP[label] || 'basic';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(64).toString('hex');
}

async function getPlanId(plan) {
  const code = getPlanCode(plan);
  const found = await prisma.subscriptionPlan.findUnique({ where: { code }, select: { id: true } });
  return found?.id || null;
}

function isAdminAll(user) {
  return user.permissions?.includes('PERMISSION_MANAGE');
}

router.post('/', authenticate, requirePermission('BRANCH_CREATE'), asyncHandler(async (req, res) => {
  const { email, plan } = req.body;
  const { requestId } = req;
  const accountId = req.user.accountId || req.user.id;

  if (!email || !plan) {
    return sendError(res, {
      statusCode: 400,
      message: 'Vui lòng nhập email quản lý và chọn gói dịch vụ',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendError(res, { statusCode: 400, message: 'Email không hợp lệ' });
  }

  const lockKey = `branch_invitation:${email}`;

  if (!lockService.acquire(lockKey)) {
    requestLogger.warn(requestId, `[INVITATION_DUPLICATE] email=${email} — request đang được xử lý`);
    return sendError(res, {
      statusCode: 429,
      message: 'Yêu cầu tạo lời mời với email này đang được xử lý, vui lòng đợi',
    });
  }

  try {
    const existingAccount = await prisma.account.findUnique({ where: { email } });
    if (existingAccount) {
      return sendError(res, {
        statusCode: 409,
        message: 'Email quản lý đã được sử dụng',
      });
    }

    const pendingInvitation = await prisma.branchInvitation.findFirst({
      where: { email, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
    });
    if (pendingInvitation) {
      return sendError(res, {
        statusCode: 409,
        message: 'Email này đã có lời mời đang chờ xử lý',
      });
    }

    const planId = await getPlanId(plan);
    if (!planId) {
      return sendError(res, { statusCode: 400, message: 'Gói dịch vụ không hợp lệ' });
    }

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);

    const invitation = await prisma.branchInvitation.create({
      data: {
        email,
        packageId: planId,
        tokenHash,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: accountId,
      },
    });

    const inviteLink = `${config.frontendUrl}/setup-branch?token=${rawToken}`;

    sendBranchInvitationEmail({ email, inviteLink }).catch(() => {});

    logAction({
      accountId,
      action: 'INVITATION_CREATED',
      module: 'BRANCH',
      details: { invitationId: invitation.id, email, plan },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    requestLogger.log(requestId, `[INVITATION_CREATED] id=${invitation.id} email=${email} plan=${plan}`);

    sendSuccess(res, {
      statusCode: 201,
      message: 'Đã gửi email mời tạo chi nhánh.',
      data: { id: invitation.id, email },
    });
  } catch (err) {
    requestLogger.error(requestId, `[POST /api/branch-invitations] Error:`, err.message);

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return sendError(res, {
        statusCode: 409,
        message: 'Email này đã có lời mời đang chờ xử lý',
      });
    }

    return sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi tạo lời mời',
      error: err.message,
    });
  } finally {
    lockService.release(lockKey);
  }
}));

router.get('/', authenticate, requirePermission('BRANCH_VIEW'), asyncHandler(async (req, res) => {
  try {
    const canManageAll = isAdminAll(req.user);

    const where = {};
    if (!canManageAll) {
      where.createdBy = req.user.accountId || req.user.id;
    }

    const invitations = await prisma.branchInvitation.findMany({
      where,
      include: { package: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const data = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      packageId: inv.packageId,
      packageName: inv.package.name,
      status:
        inv.status === InvitationStatus.PENDING && inv.expiresAt < now
          ? 'EXPIRED'
          : inv.status,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      createdAt: inv.createdAt,
    }));

    sendSuccess(res, {
      message: 'Lấy danh sách lời mời thành công',
      data,
    });
  } catch (err) {
    console.error('[GET /api/branch-invitations] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi lấy danh sách lời mời',
      error: err.message,
    });
  }
}));

router.get('/verify', asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return sendError(res, { statusCode: 400, message: 'Thiếu token' });
  }

  const tokenHash = hashToken(String(token));
  const invitation = await prisma.branchInvitation.findUnique({
    where: { tokenHash },
    include: { package: { select: { name: true, code: true } } },
  });

  if (!invitation) {
    return sendError(res, { statusCode: 400, message: 'Link không hợp lệ' });
  }

  if (invitation.status === InvitationStatus.ACCEPTED) {
    return sendError(res, { statusCode: 400, message: 'Link đã được sử dụng' });
  }

  if (invitation.status === InvitationStatus.CANCELLED) {
    return sendError(res, { statusCode: 400, message: 'Lời mời đã bị hủy' });
  }

  if (new Date() > invitation.expiresAt) {
    return sendError(res, { statusCode: 400, message: 'Link đã hết hạn (24h)' });
  }

  sendSuccess(res, {
    data: {
      valid: true,
      email: invitation.email,
      packageId: invitation.packageId,
      packageName: invitation.package.name,
      planCode: invitation.package.code,
    },
  });
}));

router.post('/accept', asyncHandler(async (req, res) => {
  const { token, branchName, address, phone, password, bankName, bankCode, accountHolder, accountNumber } = req.body;

  if (!token || !branchName || !address || !phone || !password || !bankName || !bankCode || !accountHolder || !accountNumber) {
    return sendError(res, {
      statusCode: 400,
      message: 'Vui lòng điền đầy đủ thông tin',
    });
  }

  if (password.length < 8) {
    return sendError(res, {
      statusCode: 400,
      message: 'Mật khẩu phải có ít nhất 8 ký tự',
    });
  }

  const phoneRegex = /^[0-9]{10,11}$/;
  if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
    return sendError(res, {
      statusCode: 400,
      message: 'Số điện thoại không hợp lệ',
    });
  }

  const tokenHash = hashToken(String(token));
  const invitation = await prisma.branchInvitation.findUnique({
    where: { tokenHash },
    include: { package: { select: { code: true, name: true, durationDays: true } } },
  });

  if (!invitation) {
    return sendError(res, { statusCode: 400, message: 'Link không hợp lệ' });
  }

  if (invitation.status === InvitationStatus.ACCEPTED) {
    return sendError(res, { statusCode: 400, message: 'Link đã được sử dụng' });
  }

  if (invitation.status === InvitationStatus.CANCELLED) {
    return sendError(res, { statusCode: 400, message: 'Lời mời đã bị hủy' });
  }

  if (new Date() > invitation.expiresAt) {
    return sendError(res, { statusCode: 400, message: 'Link đã hết hạn (24h)' });
  }

  const existingAccount = await prisma.account.findUnique({ where: { email: invitation.email } });
  if (existingAccount) {
    return sendError(res, {
      statusCode: 409,
      message: 'Email này đã có tài khoản',
    });
  }

  const lockKey = `accept_invitation:${invitation.id}`;
  if (!lockService.acquire(lockKey)) {
    return sendError(res, {
      statusCode: 429,
      message: 'Yêu cầu đang được xử lý, vui lòng đợi',
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          email: invitation.email,
          password: hashedPassword,
          fullName: branchName,
          phone,
          active: true,
          mustChangePassword: false,
        },
      });

      const perms = await tx.permission.findMany({
        where: { code: { in: ['BRANCH_VIEW', 'BRANCH_UPDATE', 'DASHBOARD_VIEW'] } },
        select: { id: true },
      });

      await tx.accountPermission.createMany({
        data: perms.map((p) => ({
          accountId: account.id,
          permissionId: p.id,
          allowed: true,
        })),
        skipDuplicates: true,
      });

      const now = new Date();
      const subEnd = new Date(now);
      subEnd.setDate(subEnd.getDate() + invitation.package.durationDays);

      await tx.subscription.create({
        data: {
          branchId: account.id,
          planId: invitation.packageId,
          status: SubscriptionStatus.ACTIVE,
          startDate: now,
          endDate: subEnd,
          autoRenew: true,
        },
      });

      await tx.branchBankAccount.create({
        data: {
          branchId: account.id,
          bankCode,
          bankName,
          accountNumber,
          accountHolder,
          isDefault: true,
        },
      });

      await tx.branchInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });

      return account;
    });

    await assignPlanPermissions(result.id, invitation.package.code);
    permissionService.invalidateCache(result.id);

    logAction({
      accountId: result.id,
      action: 'INVITATION_ACCEPTED',
      module: 'BRANCH',
      details: { invitationId: invitation.id, email: invitation.email, branchName },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, {
      statusCode: 201,
      message: 'Tạo chi nhánh thành công. Bạn có thể đăng nhập ngay bây giờ.',
      data: { email: invitation.email },
    });
  } catch (err) {
    console.error('[POST /api/branch-invitations/accept] Error:', err);

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return sendError(res, {
        statusCode: 409,
        message: 'Email này đã có tài khoản',
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

router.post('/:id/resend', authenticate, requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { requestId } = req;
  const accountId = req.user.accountId || req.user.id;

  try {
    const invitation = await prisma.branchInvitation.findUnique({ where: { id } });

    if (!invitation) {
      return sendError(res, { statusCode: 404, message: 'Không tìm thấy lời mời' });
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return sendError(res, { statusCode: 400, message: 'Chỉ có thể gửi lại lời mời đang chờ xử lý' });
    }

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);

    await prisma.branchInvitation.update({
      where: { id },
      data: {
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const inviteLink = `${config.frontendUrl}/setup-branch?token=${rawToken}`;
    sendBranchInvitationEmail({ email: invitation.email, inviteLink }).catch(() => {});

    logAction({
      accountId,
      action: 'INVITATION_RESENT',
      module: 'BRANCH',
      details: { invitationId: invitation.id, email: invitation.email },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    requestLogger.log(requestId, `[INVITATION_RESENT] id=${invitation.id} email=${invitation.email}`);

    sendSuccess(res, {
      message: 'Đã gửi lại email mời.',
      data: { id: invitation.id },
    });
  } catch (err) {
    console.error('[POST /api/branch-invitations/:id/resend] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi gửi lại lời mời',
      error: err.message,
    });
  }
}));

router.post('/:id/cancel', authenticate, requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { requestId } = req;
  const accountId = req.user.accountId || req.user.id;

  try {
    const invitation = await prisma.branchInvitation.findUnique({ where: { id } });

    if (!invitation) {
      return sendError(res, { statusCode: 404, message: 'Không tìm thấy lời mời' });
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return sendError(res, { statusCode: 400, message: 'Chỉ có thể hủy lời mời đang chờ xử lý' });
    }

    await prisma.branchInvitation.update({
      where: { id },
      data: { status: InvitationStatus.CANCELLED },
    });

    logAction({
      accountId,
      action: 'INVITATION_CANCELLED',
      module: 'BRANCH',
      details: { invitationId: invitation.id, email: invitation.email },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    requestLogger.log(requestId, `[INVITATION_CANCELLED] id=${invitation.id} email=${invitation.email}`);

    sendSuccess(res, {
      message: 'Đã hủy lời mời.',
      data: { id: invitation.id },
    });
  } catch (err) {
    console.error('[POST /api/branch-invitations/:id/cancel] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi hủy lời mời',
      error: err.message,
    });
  }
}));

router.get('/:id/link', authenticate, requirePermission('BRANCH_VIEW'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const invitation = await prisma.branchInvitation.findUnique({ where: { id } });

    if (!invitation) {
      return sendError(res, { statusCode: 404, message: 'Không tìm thấy lời mời' });
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return sendError(res, { statusCode: 400, message: 'Lời mời không còn hiệu lực' });
    }

    if (new Date() > invitation.expiresAt) {
      return sendError(res, { statusCode: 400, message: 'Lời mời đã hết hạn' });
    }

    // We don't store the raw token, so we can't retrieve it.
    return sendError(res, {
      statusCode: 400,
      message: 'Không thể lấy lại link mời cũ. Vui lòng gửi lại lời mời để tạo link mới.',
    });
  } catch (err) {
    console.error('[GET /api/branch-invitations/:id/link] Error:', err);
    sendError(res, {
      statusCode: 500,
      message: 'Lỗi khi lấy link mời',
      error: err.message,
    });
  }
}));

export default router;
