import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import { userRepository } from '../../repositories/user.repository.js';
import { posDeviceRepository } from '../../repositories/posDevice.repository.js';
import { deviceSessionRepository } from '../../repositories/deviceSession.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';
import prisma from '../../prisma/client.js';
import { permissionService } from '../permissions/permission.service.js';
import { devicePermissionService } from '../permissions/devicePermission.service.js';
import { getFeaturesForDeviceType, getEnabledFeaturesForDeviceType } from '../permissions/devicePermissions.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../../services/email.service.js';

const SALT_ROUNDS = 10;
const DEVICE_TOKEN_EXPIRY_DAYS = 30;
const REFRESH_TOKEN_EXPIRY_DAYS = 60;
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

function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
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

function generateDeviceJwt(device) {
  return jwt.sign(
    {
      sub: device.id,
      type: 'device',
      accountId: device.accountId,
      tokenVersion: device.tokenVersion,
    },
    config.jwt.secret,
    { expiresIn: `${DEVICE_TOKEN_EXPIRY_DAYS}d` },
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

  async loginWithDevicePin({ setupPin, fingerprint, deviceName }, req) {
    console.log('[POS_LOGIN_DEBUG] Request body:', { setupPin: setupPin ? `***${setupPin.slice(-2)}` : '(empty)', fingerprint: fingerprint ? 'present' : 'missing', deviceName });
    console.log('[POS_LOGIN_DEBUG] setupPin type:', typeof setupPin, 'length:', setupPin?.length);

    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
      },
    });

    console.log('[POS_LOGIN_DEBUG] Employees found in DB:', employees.length);

    let matchedEmployee = null;
    for (const emp of employees) {
      if (!emp.pinCode) continue;
      const matched = await bcrypt.compare(setupPin, emp.pinCode);
      if (matched) {
        matchedEmployee = emp;
        break;
      }
    }

    if (!matchedEmployee) {
      console.log('[POS_LOGIN_DEBUG] FAILURE - no matching employee found. Total checked:', employees.length);
      throw new AppError('Mã PIN không hợp lệ', 401);
    }

    const device = await prisma.pos_machines.findFirst({
      where: { accountId: matchedEmployee.accountId, deletedAt: null, status: 'ACTIVE' },
    });

    if (!device) {
      throw new AppError('Không tìm thấy máy POS cho chi nhánh này', 404);
    }

    console.log('[POS_LOGIN_DEBUG] SUCCESS - matched employee:', matchedEmployee.id, matchedEmployee.fullName, 'device:', device.id, device.name);

    const deviceToken = generateDeviceToken();
    const deviceTokenHash = await hashToken(deviceToken);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashToken(refreshToken);

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    await deviceSessionRepository.revokeAllByDevice(device.id);

    await deviceSessionRepository.create({
      deviceId: device.id,
      employeeId: matchedEmployee.id,
      tokenHash: deviceTokenHash,
      refreshTokenHash,
      fingerprint: fingerprint || null,
      deviceName: deviceName || null,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + DEVICE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
    });

    if (fingerprint) {
      await prisma.trustedDevice.upsert({
        where: {
          deviceId_fingerprint: { deviceId: device.id, fingerprint },
        },
        update: {
          lastUsedAt: new Date(),
          deviceName: deviceName || undefined,
        },
        create: {
          deviceId: device.id,
          fingerprint,
          deviceName: deviceName || null,
          isTrusted: true,
          lastUsedAt: new Date(),
        },
      });
    }

    await Promise.all([
      prisma.pos_machines.update({
        where: { id: device.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.employee.update({
        where: { id: matchedEmployee.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    await activityLogRepository.create({
      accountId: device.accountId,
      employeeId: matchedEmployee.id,
      posDeviceId: device.id,
      action: 'DEVICE_LOGIN',
      module: 'UNIFIED_AUTH',
      details: {
        name: device.name,
        employeeName: matchedEmployee.fullName,
        fingerprint: fingerprint || null,
      },
      ipAddress,
    });

    const branch = null;

    // Quyen hieu luc = giao giua Role cua nhan vien va quyen theo loai thiet bi -
    // khop voi cach requireDeviceAuth (auth.js) se tinh lai o moi request sau nay.
    const permissions = await devicePermissionService.getEffectivePermissions(device, matchedEmployee.id);
    const features = getFeaturesForDeviceType(device.template);
    const enabledFeatures = getEnabledFeaturesForDeviceType(device.template);

    return {
      deviceToken,
      refreshToken,
      expiresAt: new Date(Date.now() + DEVICE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      device: {
        id: device.id,
        name: device.name,
        type: device.template,
        mode: device.template,
        status: 'ACTIVE',
      },
      permissions,
      features,
      enabledFeatures,
      branch,
    };
  },

  async refreshDeviceToken(deviceId, refreshToken, req) {
    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Thiết bị không tồn tại', 404);
    if (!device.active) throw new AppError('Thiết bị đã bị vô hiệu hóa', 403);
    if (!device.activatedAt) throw new AppError('Thiết bị chưa được kích hoạt', 401);

    const refreshTokenHash = await hashToken(refreshToken);
    const session = await prisma.deviceSession.findFirst({
      where: {
        deviceId: device.id,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401);
    }

    const newDeviceToken = generateDeviceToken();
    const newDeviceTokenHash = await hashToken(newDeviceToken);
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = await hashToken(newRefreshToken);

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    await prisma.deviceSession.update({
      where: { id: session.id },
      data: {
        tokenHash: newDeviceTokenHash,
        refreshTokenHash: newRefreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + DEVICE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
      },
    });

    await posDeviceRepository.update(device.id, {
      deviceToken: newDeviceToken,
      deviceTokenHash: newDeviceTokenHash,
      tokenVersion: { increment: 1 },
      lastActive: new Date(),
    });

    await activityLogRepository.create({
      accountId: device.accountId,
      posDeviceId: device.id,
      action: 'DEVICE_TOKEN_REFRESHED',
      module: 'UNIFIED_AUTH',
      details: { tokenVersion: device.tokenVersion + 1 },
      ipAddress,
    });

    return {
      deviceToken: newDeviceToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + DEVICE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    };
  },

  async logoutDevice(deviceId, req) {
    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Thiết bị không tồn tại', 404);

    await deviceSessionRepository.revokeAllByDevice(device.id);

    await prisma.staffSession.updateMany({
      where: { deviceId: device.id, logoutAt: null },
      data: { logoutAt: new Date() },
    });

    await posDeviceRepository.update(device.id, {
      deviceToken: null,
      deviceTokenHash: null,
      status: 'OFFLINE',
      lastActive: new Date(),
    });

    await activityLogRepository.create({
      accountId: device.accountId,
      posDeviceId: device.id,
      action: 'DEVICE_LOGOUT',
      module: 'UNIFIED_AUTH',
      details: { deviceId: device.id },
      ipAddress: getClientIp(req),
    });
  },

  async revokeDeviceSession(sessionId, req) {
    const session = await deviceSessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session không tồn tại', 404);

    await prisma.deviceSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    const device = await posDeviceRepository.findById(session.deviceId);
    if (device) {
      await activityLogRepository.create({
        accountId: device.accountId,
        posDeviceId: device.id,
        action: 'DEVICE_SESSION_REVOKED',
        module: 'UNIFIED_AUTH',
        details: { sessionId },
        ipAddress: getClientIp(req),
      });
    }
  },

  async getDeviceSessions(deviceId) {
    const sessions = await deviceSessionRepository.findActiveByDevice(deviceId);
    return sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      fingerprint: s.fingerprint,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      expiresAt: s.expiresAt,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
    }));
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
