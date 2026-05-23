import crypto from 'crypto';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { posDeviceRepository } from '../../repositories/posDevice.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';

function generateDeviceCode() {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `POS-${hex}`;
}

async function generateUniquePin() {
  let attempts = 0;
  while (attempts < 10) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await prisma.posDevice.findUnique({ where: { devicePin: pin } });
    if (!existing) return pin;
    attempts++;
  }
  throw new AppError('Không thể tạo PIN, vui lòng thử lại', 500);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

export const posDeviceService = {
  async createDevice(accountId, { name, type }, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Tài khoản không tồn tại', 404);

    const branchId = account.branchId;

    let deviceCode = generateDeviceCode();
    let existingCode = await posDeviceRepository.findDeviceCode(deviceCode);
    while (existingCode) {
      deviceCode = generateDeviceCode();
      existingCode = await posDeviceRepository.findDeviceCode(deviceCode);
    }

    const devicePin = await generateUniquePin();

    const device = await posDeviceRepository.create({
      name,
      type,
      deviceCode,
      devicePin,
      branchId,
      status: 'OFFLINE',
      active: true,
    });

    await activityLogRepository.create({
      branchId,
      accountId,
      posDeviceId: device.id,
      action: 'CREATE_POS_DEVICE',
      module: 'POS',
      details: { deviceCode, name },
      ipAddress: getClientIp(req),
    });

    return {
      id: device.id,
      name: device.name,
      type: device.type,
      deviceCode: device.deviceCode,
      devicePin: device.devicePin,
      branchId: device.branchId,
      status: device.status,
      active: device.active,
      createdAt: device.createdAt,
    };
  },

  async listDevices(user) {
    if (user.role === 'ADMIN') {
      return posDeviceRepository.findAll();
    }
    return posDeviceRepository.findByBranchId(user.branchId);
  },

  async getDevice(id, user) {
    const device = await posDeviceRepository.findByIdWithBranch(id);
    if (!device) throw new AppError('Không tìm thấy thiết bị', 404);

    if (!user.role === 'ADMIN' && device.branchId !== user.branchId) {
      throw new AppError('Bạn không có quyền truy cập thiết bị này', 403);
    }

    return device;
  },

  async resetPin(deviceId, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Tài khoản không tồn tại', 404);

    const device = await posDeviceRepository.findById(deviceId);
    if (!device) throw new AppError('Không tìm thấy thiết bị', 404);

    if (!account.role === 'ADMIN' && device.branchId !== account.branchId) {
      throw new AppError('Bạn không có quyền quản lý thiết bị này', 403);
    }

    const devicePin = await generateUniquePin();

    await posDeviceRepository.update(deviceId, {
      devicePin,
      deviceToken: null,
    });

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId,
      posDeviceId: device.id,
      action: 'RESET_POS_PIN',
      module: 'POS',
      details: { deviceCode: device.deviceCode },
      ipAddress: getClientIp(req),
    });

    return { deviceId: device.id, deviceCode: device.deviceCode, devicePin };
  },

  async toggleDevice(id, active, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Tài khoản không tồn tại', 404);

    const device = await posDeviceRepository.findById(id);
    if (!device) throw new AppError('Không tìm thấy thiết bị', 404);

    if (!account.role === 'ADMIN' && device.branchId !== account.branchId) {
      throw new AppError('Bạn không có quyền quản lý thiết bị này', 403);
    }

    const updateData = { active };
    if (!active) {
      updateData.deviceToken = null;
    }

    await posDeviceRepository.update(id, updateData);

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId,
      posDeviceId: device.id,
      action: active ? 'ENABLE_POS_DEVICE' : 'DISABLE_POS_DEVICE',
      module: 'POS',
      details: { deviceCode: device.deviceCode, active },
      ipAddress: getClientIp(req),
    });

    return posDeviceRepository.findById(id);
  },

  async deleteDevice(id, accountId, req) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppError('Tài khoản không tồn tại', 404);

    const device = await posDeviceRepository.findById(id);
    if (!device) throw new AppError('Không tìm thấy thiết bị', 404);

    if (!account.role === 'ADMIN' && device.branchId !== account.branchId) {
      throw new AppError('Bạn không có quyền quản lý thiết bị này', 403);
    }

    await posDeviceRepository.softDelete(id);

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId,
      posDeviceId: device.id,
      action: 'DELETE_POS_DEVICE',
      module: 'POS',
      details: { deviceCode: device.deviceCode },
      ipAddress: getClientIp(req),
    });
  },
};
