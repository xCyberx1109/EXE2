import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { sendMail } from '../utils/sendMail.js';
import { authenticate, requirePermission } from '../middlewares/auth.js';
import { enforceBranchScope } from '../middlewares/branchScope.js';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

// ================================================================
// TEMPORARY COMPATIBILITY MAPPING
// The `branches` table has been permanently removed from the
// database.  To keep the existing frontend working without changes,
// these endpoints transparently use the `accounts` table as the data
// source.  The Account -> Branch DTO mapping is defined below.
// TODO: Evolve the frontend to use Account terminology directly.
// ================================================================

/** Map an Account record to the Branch DTO the frontend expects. */
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
      branchId: account.id,
    },
  };
}

/*
 * Compatibility endpoints — each reads/writes the accounts table
 * instead of the removed branches table.
 */

// GET /branches — list all accounts as virtual branches
router.get('/', requirePermission('BRANCH_VIEW'), asyncHandler(async (req, res) => {
  const accounts = await prisma.account.findMany({
    orderBy: { fullName: 'asc' },
  });

  sendSuccess(res, {
    message: 'Lấy danh sách chi nhánh thành công',
    data: accounts.map(formatBranch),
  });
}));

// POST /branches — create account as virtual branch
router.post('/', requirePermission('BRANCH_CREATE'), asyncHandler(async (req, res) => {
  const { name, phone, email, fullName, active } = req.body;

  if (!name || !email) {
    return sendError(res, {
      statusCode: 400,
      message: 'Vui lòng nhập tên chi nhánh và email quản lý',
    });
  }

  const password = crypto.randomBytes(4).toString('hex');
  const hashedPassword = await bcrypt.hash(password, 10);

  const account = await prisma.account.create({
    data: {
      email,
      password: hashedPassword,
      fullName: fullName || name,
      phone: phone || '',
      active: active !== undefined ? Boolean(active) : true,
    },
  });

  // Grant BRANCH_VIEW + BRANCH_UPDATE to match original behaviour
  const perms = await prisma.permission.findMany({
    where: { code: { in: ['BRANCH_VIEW', 'BRANCH_UPDATE'] } },
    select: { id: true, code: true },
  });
  for (const p of perms) {
    await prisma.accountPermission.upsert({
      where: { accountId_permissionId: { accountId: account.id, permissionId: p.id } },
      update: { allowed: true },
      create: { accountId: account.id, permissionId: p.id, allowed: true },
    });
  }

  try {
    await sendMail({
      to: email,
      subject: 'Tài khoản quản lý chi nhánh mới',
      html: `<p>Xin chào,</p>
        <p>Tài khoản <b>${name}</b> đã được tạo thành công.</p>
        <p>Thông tin đăng nhập:</p>
        <ul>
          <li>Email: <b>${email}</b></li>
          <li>Mật khẩu: <b>${password}</b></li>
        </ul>
        <p>Vui lòng đăng nhập và đổi mật khẩu sau khi sử dụng lần đầu.</p>`,
    });
  } catch (err) {
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Tạo chi nhánh thành công nhưng gửi email thất bại',
      data: formatBranch(account),
    });
  }

  sendSuccess(res, {
    statusCode: 201,
    message: 'Tạo chi nhánh thành công, đã gửi email tài khoản quản lý',
    data: formatBranch(account),
  });
}));

// PUT /branches/:id — update account as virtual branch
router.put('/:id', requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  const { id } = req.params;
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
}));

// PUT /branches/:id/reset-password — reset account password
router.put('/:id/reset-password', requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, fullName: true, email: true },
  });
  if (!account) {
    return sendError(res, { statusCode: 404, message: 'Không tìm thấy tài khoản' });
  }

  const newPassword = crypto.randomBytes(4).toString('hex');
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.account.update({
    where: { id },
    data: { password: hashedPassword, mustChangePassword: true },
  });

  try {
    await sendMail({
      to: account.email,
      subject: `Đặt lại mật khẩu cho ${account.fullName}`,
      html: `<p>Xin chào <b>${account.fullName}</b>,</p>
        <p>Mật khẩu của bạn đã được đặt lại.</p>
        <p>Mật khẩu mới: <b>${newPassword}</b></p>
        <p>Vui lòng đăng nhập và đổi mật khẩu ngay sau khi đăng nhập.</p>`,
    });
  } catch (err) {
    console.error('Lỗi gửi email reset password:', err);
    return sendError(res, {
      statusCode: 500,
      message: 'Đặt lại mật khẩu thành công nhưng gửi email thất bại',
    });
  }

  sendSuccess(res, {
    message: `Đặt lại mật khẩu thành công cho "${account.fullName}". Mật khẩu mới đã được gửi tới email ${account.email}.`,
    data: {
      branchId: account.id,
      branchName: account.fullName,
      accountEmail: account.email,
      accountFullName: account.fullName,
    },
  });
}));

// PATCH /branches/:id/lock — deactivate account
router.patch('/:id/lock', requirePermission('BRANCH_LOCK'), asyncHandler(async (req, res) => {
  const { id } = req.params;

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
}));

// PATCH /branches/:id/unlock — reactivate account
router.patch('/:id/unlock', requirePermission('BRANCH_UNLOCK'), asyncHandler(async (req, res) => {
  const { id } = req.params;

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
}));

// DELETE /branches/:id — soft-delete (deactivate) account
router.delete('/:id', requirePermission('BRANCH_DELETE'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, fullName: true },
  });
  if (!account) {
    return sendError(res, { statusCode: 404, message: 'Không tìm thấy tài khoản' });
  }

  await prisma.account.update({ where: { id }, data: { active: false } });

  sendSuccess(res, { message: `Đã xóa tài khoản "${account.fullName}"`, data: null });
}));

// DELETE /branches/:id/force — permanently delete the account
router.delete('/:id/force', requirePermission('BRANCH_FORCE_DELETE'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, fullName: true },
  });
  if (!account) {
    return sendError(res, { statusCode: 404, message: 'Không tìm thấy tài khoản' });
  }

  // Remove permission assignments then the account itself
  await prisma.accountPermission.deleteMany({ where: { accountId: id } });
  await prisma.account.delete({ where: { id } });

  sendSuccess(res, {
    message: `Đã xóa vĩnh viễn tài khoản "${account.fullName}"`,
    data: { branchName: account.fullName, stats: {} },
  });
}));

export default router;
