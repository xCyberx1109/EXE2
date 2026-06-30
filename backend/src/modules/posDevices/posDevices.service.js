import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { posDeviceRepository } from '../../repositories/posDevice.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';

const SETUP_PIN_LENGTH = 6;

const VALID_TEMPLATES = ['CASHIER', 'KITCHEN', 'CASHIER_KITCHEN', 'BILLIARD', 'RESTAURANT', 'CUSTOM'];

function resolveTemplate(template) {
  if (template && VALID_TEMPLATES.includes(template)) return template;
  return 'CASHIER';
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

export const posDevicesService = {
  async createDevice(accountId, { name, template, metadata }, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Account not found', 404);

    const resolvedTemplate = resolveTemplate(template);
    const setupPin = generateSetupPin();

    const payload = {
      name,
      accountId,
      template: resolvedTemplate,
      status: 'LOCKED',
    };
    console.log('[POS DEVICE CREATE]', payload);
    const device = await posDeviceRepository.create(payload);
    console.log('[POS DEVICE CREATED]', device);

    await activityLogRepository.create({

      posDeviceId: device.id,
      action: 'CREATE_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { name, template: resolvedTemplate },
      ipAddress: getClientIp(req),
    });

    return {
      id: device.id,
      name: device.name,
      template: device.template,
      setupPin,
      accountId: device.accountId,
      status: device.status,
      active: device.status !== 'LOCKED',
      createdAt: device.createdAt,
    };
  },

  async listDevices(user) {
    console.log("[POS] listDevices v2 - user:", JSON.stringify({ id: user?.id, accountId: user?.accountId, source: user?.source, permissions: user?.permissions?.length }));

    if (!user.permissions?.includes('POS_DEVICE_VIEW')) {
      console.log("[POS] listDevices v2 - MISSING PERMISSION: POS_DEVICE_VIEW");
      return [];
    }

    const accountId = user.accountId || user.id;
    console.log("[POS] listDevices v2 - accountId:", accountId);

    const devices = await posDeviceRepository.findByAccountId(accountId);
    console.log("[POS] listDevices v2 - FOUND:", devices.length, "devices for accountId:", accountId);

    if (devices.length === 0) {
      console.log("[POS] listDevices v2 - RAW DUMP:", await prisma.pos_machines.findMany({}));
    }

    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      template: d.template,
      status: d.status,
      active: d.status !== 'LOCKED',
      lastActive: d.lastLoginAt,
      lastLoginAt: d.lastLoginAt,
      createdAt: d.createdAt,
    }));
  },

  async getDevice(id, user) {
    const accountId = user.accountId || user.id;
    const device = await posDeviceRepository.findByIdWithAccount(id, accountId);
    if (!device) throw new AppError('Device not found', 404);
    return device;
  },

  async regenerateSetupPin(deviceId, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Account not found', 404);

    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    if (device.accountId !== accountId) {
      throw new AppError('Access denied', 403);
    }

    const setupPin = generateSetupPin();

    console.log({
      action: 'REGENERATE_SETUP_PIN',
      deviceId: device.id,
      oldStatus: device.status,
    });

    console.log({
      action: 'REGENERATE_SETUP_PIN_SUCCESS',
      deviceId: device.id,
      status: device.status,
    });

    await activityLogRepository.create({

      posDeviceId: device.id,
      action: 'REGENERATE_SETUP_PIN',
      module: 'POS_DEVICES',
      details: { deviceId: device.id },
      ipAddress: getClientIp(req),
    });

    return { deviceId: device.id, setupPin };
  },

  async revokeDevice(deviceId, reason, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Account not found', 404);

    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    if (device.accountId !== accountId) {
      throw new AppError('Access denied', 403);
    }

    await prisma.deviceSession.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    console.log({
      action: 'REVOKE_POS_DEVICE',
      deviceId: device.id,
      oldStatus: device.status,
    });

    console.log('[POS STATUS CHANGE]', {
      deviceId: device.id,
      oldStatus: device.status,
      newStatus: 'LOCKED',
      reason: 'MANUAL_REVOKE — admin thu hồi thiết bị',
    });

    await posDeviceRepository.update(deviceId, {
      status: 'LOCKED',
    });

    console.log({
      action: 'REVOKE_POS_DEVICE_SUCCESS',
      deviceId: device.id,
      status: 'LOCKED',
    });

    await activityLogRepository.create({

      posDeviceId: device.id,
      action: 'REVOKE_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { deviceId: device.id, reason: reason || null },
      ipAddress: getClientIp(req),
    });

    return { deviceId: device.id, status: 'LOCKED' };
  },

  async resetDevice(deviceId, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Account not found', 404);

    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    if (device.accountId !== accountId) {
      throw new AppError('Access denied', 403);
    }

    const setupPin = generateSetupPin();

    await prisma.deviceSession.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.staffSession.updateMany({
      where: { deviceId, logoutAt: null },
      data: { logoutAt: new Date() },
    });

    console.log({
      action: 'RESET_PIN',
      deviceId: device.id,
      oldStatus: device.status,
    });

    await posDeviceRepository.update(deviceId, {
      lastLoginAt: null,
    });

    const updated = await posDeviceRepository.findById(deviceId);

    console.log({
      action: 'RESET_PIN_SUCCESS',
      deviceId: device.id,
      status: updated.status,
    });

    await activityLogRepository.create({

      posDeviceId: device.id,
      action: 'RESET_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { deviceId: device.id },
      ipAddress: getClientIp(req),
    });

    return { deviceId: device.id, setupPin };
  },

  async toggleDevice(id, active, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Account not found', 404);

    const device = await posDeviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);
    if (device.accountId !== accountId) {
      throw new AppError('Access denied', 403);
    }

    const status = active ? 'ACTIVE' : 'LOCKED';

    console.log('[POS STATUS CHANGE]', {
      deviceId: id,
      oldStatus: device.status,
      newStatus: status,
      reason: active
        ? 'MANUAL_ENABLE — admin kích hoạt thiết bị'
        : 'MANUAL_DISABLE — admin vô hiệu hóa thiết bị',
    });

    if (!active) {
      await prisma.deviceSession.updateMany({
        where: { deviceId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    console.log('[POS STATUS CHANGE] posDevices.service toggleDevice applied:', { id, status });

    await posDeviceRepository.update(id, { status });

    await activityLogRepository.create({

      posDeviceId: device.id,
      action: active ? 'ENABLE_POS_DEVICE' : 'DISABLE_POS_DEVICE',
      module: 'POS_DEVICES',
      details: { deviceId: device.id, active },
      ipAddress: getClientIp(req),
    });

    return posDeviceRepository.findById(id);
  },

  async updateMode(deviceId, mode, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Account not found', 404);

    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    if (device.accountId !== accountId) {
      throw new AppError('Access denied', 403);
    }

    const template = resolveTemplate(
      device.template === 'CASHIER_KITCHEN' ? 'CASHIER' : device.template,
      mode,
    );

    const updated = await posDeviceRepository.update(deviceId, { template });

    await activityLogRepository.create({

      posDeviceId: device.id,
      action: 'POS_MODE_CHANGED',
      module: 'POS_DEVICES',
      details: { deviceId: device.id, oldTemplate: device.template, newTemplate: template },
      ipAddress: getClientIp(req),
    });

    return updated;
  },

  async deleteDevice(id, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Account not found', 404);

    const device = await posDeviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);
    if (device.deletedAt) throw new AppError('Device already deleted', 404);
    if (device.accountId !== accountId) {
      throw new AppError('Access denied', 403);
    }

    await prisma.deviceSession.updateMany({
      where: { deviceId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await posDeviceRepository.softDelete(id);

    await activityLogRepository.create({

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
    const accountId = user.accountId || user.id;
    if (device.accountId !== accountId) {
      throw new AppError('Access denied', 403);
    }
    return activityLogRepository.findByDevice(deviceId, 100);
  },
};
