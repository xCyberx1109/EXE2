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
import { getPermissionsForDeviceType, getFeaturesForDeviceType, getEnabledFeaturesForDeviceType } from '../permissions/devicePermissions.js';
import { sendWelcomeEmail } from '../../services/email.service.js';

const SALT_ROUNDS = 10;
const DEVICE_TOKEN_EXPIRY_DAYS = 30;
const REFRESH_TOKEN_EXPIRY_DAYS = 60;
const RATE_LIMIT_ATTEMPTS = 5;

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

async function generateUserToken(user) {
  const permissions = await permissionService.getEffectivePermissions(user.id);
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
      branchId: device.branchId,
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
    console.log('[LOGIN] Service start — email:', email);

    console.log('[LOGIN] Before DB query — findByEmail');
    const user = await userRepository.findByEmail(email);
    console.log('[LOGIN] After DB query — user found:', !!user);
    if (!user) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    console.log('[LOGIN] Before bcrypt.compare');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('[LOGIN] After bcrypt.compare — match:', isMatch);
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    console.log('[LOGIN] Before generateUserToken');
    const token = await generateUserToken(user);
    console.log('[LOGIN] After generateUserToken');

    console.log('[LOGIN] Before getEffectivePermissions');
    user.permissions = await permissionService.getEffectivePermissions(user.id);
    console.log('[LOGIN] After getEffectivePermissions');

    console.log('[LOGIN] Before getPermissionsVersion');
    user.permissionsVersion = await permissionService.getPermissionsVersion(user.id);
    console.log('[LOGIN] After getPermissionsVersion');

    console.log('[LOGIN] Service returning success');
    return { user: sanitizeUser(user), token };
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

    sendWelcomeEmail({ email: user.email, fullName: user.fullName }).catch(() => {});

    return { user: sanitizeUser(user), token };
  },

  async loginWithDevicePin({ setupPin, fingerprint, deviceName }, req) {
    const candidates = await prisma.posDevice.findMany({
      where: {
        setupPinHash: { not: null },
        deletedAt: null,
        active: true,
        status: { in: ['PENDING_ACTIVATION', 'ACTIVATED'] },
      },
    });

    let device = null;
    for (const candidate of candidates) {
      const pinValid = await bcrypt.compare(setupPin, candidate.setupPinHash);
      if (pinValid) {
        device = candidate;
        break;
      }
    }

    if (!device) throw new AppError('Mã PIN không hợp lệ', 401);

    if (device.activationAttempts >= RATE_LIMIT_ATTEMPTS) {
      throw new AppError('Quá nhiều lần thử. Thiết bị đã bị khóa.', 429);
    }

    const deviceToken = generateDeviceToken();
    const deviceTokenHash = await hashToken(deviceToken);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashToken(refreshToken);

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    await deviceSessionRepository.revokeAllByDevice(device.id);

    await deviceSessionRepository.create({
      deviceId: device.id,
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

    await posDeviceRepository.update(device.id, {
      status: 'ACTIVATED',
      activatedAt: device.activatedAt || new Date(),
      deviceToken,
      deviceTokenHash,
      refreshTokenHash,
      tokenVersion: { increment: 1 },
      activationAttempts: 0,
      lastFingerprint: fingerprint || null,
      lastActive: new Date(),
      lastLoginAt: new Date(),
    });

    await activityLogRepository.create({
      branchId: device.branchId,
      posDeviceId: device.id,
      action: device.activatedAt ? 'DEVICE_RELOGIN' : 'DEVICE_ACTIVATED',
      module: 'UNIFIED_AUTH',
      details: {
        name: device.name,
        fingerprint: fingerprint || null,
        isNewActivation: !device.activatedAt,
      },
      ipAddress,
    });

    const branch = null;

    const permissions = getPermissionsForDeviceType(device.type);
    const features = getFeaturesForDeviceType(device.type);
    const enabledFeatures = getEnabledFeaturesForDeviceType(device.type);

    return {
      deviceToken,
      refreshToken,
      expiresAt: new Date(Date.now() + DEVICE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        mode: device.mode,
        status: 'ACTIVATED',
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
      branchId: device.branchId,
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
      branchId: device.branchId,
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
        branchId: device.branchId,
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
