import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = Router();

router.post('/set-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return sendError(res, { statusCode: 400, message: 'Vui lòng cung cấp token và mật khẩu mới' });
  }

  if (password.length < 6) {
    return sendError(res, { statusCode: 400, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }

  const invite = await prisma.inviteToken.findUnique({ where: { token } });

  if (!invite) {
    return sendError(res, { statusCode: 400, message: 'Link không hợp lệ hoặc đã được sử dụng' });
  }

  if (invite.usedAt) {
    return sendError(res, { statusCode: 400, message: 'Link đã được sử dụng, vui lòng yêu cầu gửi lại link mới' });
  }

  if (new Date() > invite.expiresAt) {
    return sendError(res, { statusCode: 400, message: 'Link đã hết hạn (24h), vui lòng yêu cầu gửi lại link mới' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: invite.accountId },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
  });

  sendSuccess(res, {
    message: 'Đặt mật khẩu thành công. Bạn có thể đăng nhập ngay bây giờ.',
    data: null,
  });
}));

router.get('/verify', asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return sendError(res, { statusCode: 400, message: 'Thiếu token' });
  }

  const invite = await prisma.inviteToken.findUnique({ where: { token: String(token) } });

  if (!invite) {
    return sendError(res, { statusCode: 400, message: 'Link không hợp lệ' });
  }

  if (invite.usedAt) {
    return sendError(res, { statusCode: 400, message: 'Link đã được sử dụng' });
  }

  if (new Date() > invite.expiresAt) {
    return sendError(res, { statusCode: 400, message: 'Link đã hết hạn' });
  }

  const account = await prisma.account.findUnique({
    where: { id: invite.accountId },
    select: { email: true, fullName: true },
  });

  sendSuccess(res, {
    data: {
      valid: true,
      email: account?.email,
      fullName: account?.fullName,
    },
  });
}));

export default router;
