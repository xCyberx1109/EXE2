import crypto from 'crypto';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { posDeviceRepository } from '../../repositories/posDevice.repository.js';
import { deviceSessionRepository } from '../../repositories/deviceSession.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';

const TOKEN_EXPIRY_DAYS = 30;

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

async function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

export const deviceAuthService = {
  async refreshToken(posDevice, req) {
    const device = await posDeviceRepository.findById(posDevice.id);
    if (!device) throw new AppError('Device not found', 404);
    if (!device.active) throw new AppError('Device is disabled', 403);
    if (!device.activatedAt) throw new AppError('Device not activated', 401);

    const newToken = generateDeviceToken();
    const tokenHash = await hashToken(newToken);

    await deviceSessionRepository.revokeAllByDevice(device.id);

    await deviceSessionRepository.create({
      deviceId: device.id,
      tokenHash,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
    });

    await posDeviceRepository.update(device.id, {
      deviceTokenHash: tokenHash,
      deviceToken: newToken,
      tokenVersion: { increment: 1 },
      lastActive: new Date(),
    });

    await activityLogRepository.create({
      posDeviceId: device.id,
      action: 'DEVICE_TOKEN_REFRESHED',
      module: 'DEVICE_AUTH',
      details: { deviceCode: device.deviceCode, tokenVersion: device.tokenVersion + 1 },
      ipAddress: getClientIp(req),
    });

    return {
      deviceToken: newToken,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    };
  },

  async logout(posDevice, req) {
    const device = await posDeviceRepository.findById(posDevice.id);
    if (!device) throw new AppError('Device not found', 404);

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
      posDeviceId: device.id,
      action: 'DEVICE_LOGOUT',
      module: 'DEVICE_AUTH',
      details: { deviceCode: device.deviceCode },
      ipAddress: getClientIp(req),
    });
  },
};
