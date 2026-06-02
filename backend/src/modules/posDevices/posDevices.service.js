import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { posDeviceRepository } from '../../repositories/posDevice.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';
import { assertBranchAccess, buildBranchWhere } from '../../middlewares/branchScope.js';

const SETUP_PIN_EXPIRY_HOURS = 48;
const SETUP_PIN_LENGTH = 6;

function generateDeviceCode() {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `POS-${hex}`;
}

function generateSetupPin() {
  const digits = [];
  for (let i = 0; i < SETUP_PIN_LENGTH; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  return digits.join('');
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

async function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const posDevicesService = {
  async createDevice(user, { name, type, mode, metadata }, req) {
    const branchId = user.branchId;

    let deviceCode = generateDeviceCode();
    let existingCode = await posDeviceRepository.findDeviceCode(deviceCode);
    while (existingCode) {
      deviceCode = generateDeviceCode();
      existingCode = await posDeviceRepository.findDeviceCode(deviceCode);
    }

    const setupPin = generateSetupPin();
    const setupPinHash = await bcrypt.hash(setupPin, 10);
    const setupPinExpiresAt = new Date(Date.now() + SETUP_PIN_EXPIRY_HOURS * 60 * 60 * 1000);

    const device = await posDeviceRepository.create({
      name,
      type,
      mode: mode || 'CASHIER',
      deviceCode,
      setupPinHash,
      setupPinExpiresAt,
      branchId,
      status: 'PENDING_ACTIVATION',
      active: true,
      metadata: metadata || null,
    });

    await activityLogRepository.create({
      branchId,
      accountId: user.id,
      posDeviceId: device.id,
      action: 'CREATE_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { name, mode: device.mode, type },
      ipAddress: getClientIp(req),
    });

    return {
      id: device.id,
      name: device.name,
      type: device.type,
      mode: device.mode,
      setupPin,
      setupPinExpiresAt,
      branchId: device.branchId,
      status: device.status,
      active: device.active,
      createdAt: device.createdAt,
    };
  },

  async listDevices(user) {
    const canAccessAll = user.permissions?.includes('BRANCH_ALL_ACCESS');
    const branchId = canAccessAll ? undefined : user.branchId;
    const devices = await posDeviceRepository.findByBranchId(branchId);
    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      mode: d.mode,
      status: d.status,
      active: d.active,
      lastActive: d.lastActive,
      lastLoginAt: d.lastLoginAt,
      currentVersion: d.currentVersion,
      activatedAt: d.activatedAt,
      ordersToday: d._count?.orders || 0,
      currentShift: d.shifts?.[0]
        ? {
            id: d.shifts[0].id,
            startTime: d.shifts[0].startTime,
            cashier: d.shifts[0].account?.fullName || null,
          }
        : null,
      createdAt: d.createdAt,
    }));
  },

  async getDevice(id, user) {
    const device = await posDeviceRepository.findByIdWithBranch(id);
    if (!device) throw new AppError('Device not found', 404);
    assertBranchAccess(device, user, 'thiết bị');
    return device;
  },

  async regenerateSetupPin(deviceId, user, req) {
    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    assertBranchAccess(device, user, 'thiết bị');

    const setupPin = generateSetupPin();
    const setupPinHash = await bcrypt.hash(setupPin, 10);
    const setupPinExpiresAt = new Date(Date.now() + SETUP_PIN_EXPIRY_HOURS * 60 * 60 * 1000);

    await posDeviceRepository.update(deviceId, {
      setupPinHash,
      setupPinExpiresAt,
      activationAttempts: 0,
      status: 'PENDING_ACTIVATION',
    });

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId: user.id,
      posDeviceId: device.id,
      action: 'REGENERATE_SETUP_PIN',
      module: 'POS_DEVICES',
      details: { deviceId: device.id },
      ipAddress: getClientIp(req),
    });

    return { deviceId: device.id, setupPin, setupPinExpiresAt };
  },

  async revokeDevice(deviceId, reason, user, req) {
    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    assertBranchAccess(device, user, 'thiết bị');

    await prisma.shift.updateMany({
      where: { posDeviceId: deviceId, status: 'OPEN' },
      data: { status: 'CLOSED', endTime: new Date(), isOnline: false },
    });

    await prisma.deviceSession.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await posDeviceRepository.update(deviceId, {
      status: 'OFFLINE',
      deviceToken: null,
      deviceTokenHash: null,
      setupPinHash: null,
      setupPinExpiresAt: null,
      active: false,
    });

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId: user.id,
      posDeviceId: device.id,
      action: 'REVOKE_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { deviceId: device.id, reason: reason || null },
      ipAddress: getClientIp(req),
    });

    return { deviceId: device.id, status: 'REVOKED' };
  },

  async resetDevice(deviceId, user, req) {
    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    assertBranchAccess(device, user, 'thiết bị');

    const setupPin = generateSetupPin();
    const setupPinHash = await bcrypt.hash(setupPin, 10);
    const setupPinExpiresAt = new Date(Date.now() + SETUP_PIN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.shift.updateMany({
      where: { posDeviceId: deviceId, status: 'OPEN' },
      data: { status: 'CLOSED', endTime: new Date(), isOnline: false },
    });

    await prisma.deviceSession.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.staffSession.updateMany({
      where: { deviceId, logoutAt: null },
      data: { logoutAt: new Date() },
    });

    await posDeviceRepository.update(deviceId, {
      status: 'PENDING_ACTIVATION',
      active: true,
      setupPinHash,
      setupPinExpiresAt,
      deviceToken: null,
      deviceTokenHash: null,
      tokenVersion: { increment: 1 },
      activatedAt: null,
      activationAttempts: 0,
      lastActive: null,
      lastLoginAt: null,
    });

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId: user.id,
      posDeviceId: device.id,
      action: 'RESET_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { deviceId: device.id },
      ipAddress: getClientIp(req),
    });

    return { deviceId: device.id, setupPin, setupPinExpiresAt };
  },

  async toggleDevice(id, active, user, req) {
    const device = await posDeviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);
    assertBranchAccess(device, user, 'thiết bị');

    const updateData = { active };
    if (!active) {
      updateData.deviceToken = null;
      updateData.deviceTokenHash = null;

      await prisma.shift.updateMany({
        where: { posDeviceId: id, status: 'OPEN' },
        data: { status: 'CLOSED', endTime: new Date(), isOnline: false },
      });

      await prisma.deviceSession.updateMany({
        where: { deviceId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await posDeviceRepository.update(id, updateData);

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId: user.id,
      posDeviceId: device.id,
      action: active ? 'ENABLE_POS_DEVICE' : 'DISABLE_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { deviceId: device.id, active },
      ipAddress: getClientIp(req),
    });

    return posDeviceRepository.findById(id);
  },

  async updateMode(deviceId, mode, user, req) {
    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    assertBranchAccess(device, user, 'thiết bị');

    const updated = await posDeviceRepository.update(deviceId, { mode });

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId: user.id,
      posDeviceId: device.id,
      action: 'POS_MODE_CHANGED',
      module: 'POS_DEVICES',
      details: { deviceId: device.id, oldMode: device.mode, newMode: mode },
      ipAddress: getClientIp(req),
    });

    return updated;
  },

  async deleteDevice(id, user, req) {
    const device = await posDeviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);
    if (device.deletedAt) throw new AppError('Device already deleted', 404);
    assertBranchAccess(device, user, 'thiết bị');

    await prisma.shift.updateMany({
      where: { posDeviceId: id, status: 'OPEN' },
      data: { status: 'CLOSED', endTime: new Date(), isOnline: false },
    });

    await prisma.deviceSession.updateMany({
      where: { deviceId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await posDeviceRepository.softDelete(id);

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId: user.id,
      posDeviceId: device.id,
      action: 'DELETE_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { deviceId: device.id },
      ipAddress: getClientIp(req),
    });
  },

  async getActivityLogs(deviceId, user) {
    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    assertBranchAccess(device, user, 'thiết bị');
    return activityLogRepository.findByDevice(deviceId, 100);
  },
};
