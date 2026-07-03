import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import { userRepository } from '../../repositories/user.repository.js';
import prisma from '../../prisma/client.js';
import { permissionService } from '../permissions/permission.service.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../../services/email.service.js';

const SALT_ROUNDS = 10;
const RATE_LIMIT_ATTEMPTS = 5;
const MAX_FAILED_LOGIN_ATTEMPTS = 3;
const LOCK_DURATION_MINUTES = 5;
const RESET_TOKEN_EXPIRY_MINUTES = 15;

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

async function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function generateUserToken(user, existingPermissions) {
  const permissions = existingPermissions || await permissionService.getEffectivePermissions(user.id);
  return jwt.sign(
    {
      sub: user.id,
      type: 'user',
      permissions,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
  permissions: user.permissions || [],
  permissionsVersion: user.permissionsVersion ?? 0,
});

export const unifiedAuthService = {
  async loginWithEmail({ email, password }, req) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      const remainingMs = new Date(user.lockUntil).getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new AppError(
        `Tài khoản đang bị khóa. Vui lòng thử lại sau ${remainingMinutes} phút.`,
        423,
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData = { failedLoginAttempts: newAttempts };

      if (newAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        updateData.lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
      }

      await userRepository.updateById(user.id, updateData);

      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    await userRepository.updateById(user.id, {
      failedLoginAttempts: 0,
      lockUntil: null,
    });

    const permissions = await permissionService.getEffectivePermissions(user.id);
    const permissionsVersion = await permissionService.getPermissionsVersion(user.id);
    const token = await generateUserToken(user, permissions);

    return {
      user: sanitizeUser({ ...user, permissions, permissionsVersion }),
      token,
    };
  },

  async forgotPassword({ email }) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await userRepository.updateById(user.id, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expiresAt,
    });

    const resetLink = `${config.frontendUrl}/reset-password?token=${rawToken}`;

    sendPasswordResetEmail({
      email: user.email,
      fullName: user.fullName,
      resetLink,
    }).catch(() => { });

    return { message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.' };
  },

  async resetPassword({ token, password }) {
    if (!token || !password) {
      throw new AppError('Vui lòng cung cấp token và mật khẩu mới', 400);
    }

    if (password.length < 8) {
      throw new AppError('Mật khẩu phải có ít nhất 8 ký tự', 400);
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new AppError('Mật khẩu phải có chữ hoa, chữ thường và số', 400);
    }

    const hashedToken = await hashToken(token);

    const user = await prisma.account.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Token không hợp lệ hoặc đã hết hạn', 400);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await userRepository.updateById(user.id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      failedLoginAttempts: 0,
      lockUntil: null,
    });

    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
  },

  async register({ email, password, fullName }) {
    console.log("[ACCOUNT_CREATE_HIT]", email, Date.now());

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError('Email đã được sử dụng', 409);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await userRepository.create({
      email,
      password: hashedPassword,
      fullName,
    });

    const token = await generateUserToken(user);

    sendWelcomeEmail({ email: user.email, fullName: user.fullName }).catch(() => { });

    return { user: sanitizeUser(user), token };
  },

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);
    user.permissions = await permissionService.getEffectivePermissions(userId);
    user.permissionsVersion = await permissionService.getPermissionsVersion(userId);
    return user;
  },

  async updateProfile(userId, { fullName, email }) {
    const currentUser = await userRepository.findRawById(userId);
    if (!currentUser) throw new AppError('Không tìm thấy người dùng', 404);

    const nextFullName = typeof fullName === 'string' ? fullName.trim() : undefined;
    const nextEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;

    if (!nextFullName && !nextEmail) {
      throw new AppError('Vui lòng cung cấp thông tin cần cập nhật', 400);
    }

    const dataToUpdate = {};

    if (nextFullName) {
      dataToUpdate.fullName = nextFullName;
    }

    if (nextEmail && nextEmail !== currentUser.email) {
      const existedEmail = await userRepository.findByEmail(nextEmail);
      if (existedEmail && existedEmail.id !== userId) {
        throw new AppError('Email đã được sử dụng', 409);
      }
      dataToUpdate.email = nextEmail;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return this.getProfile(userId);
    }

    await userRepository.updateById(userId, dataToUpdate);
    return this.getProfile(userId);
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const currentUser = await userRepository.findRawById(userId);
    if (!currentUser) throw new AppError('Không tìm thấy người dùng', 404);

    const isMatch = await bcrypt.compare(currentPassword, currentUser.password);
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không chính xác', 400);
    }

    const sameAsCurrent = await bcrypt.compare(newPassword, currentUser.password);
    if (sameAsCurrent) {
      throw new AppError('Mật khẩu mới phải khác mật khẩu hiện tại', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userRepository.updateById(userId, { password: hashedPassword, mustChangePassword: false });

    return { success: true };
  },
};
