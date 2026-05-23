import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { posDeviceRepository } from '../../repositories/posDevice.repository.js';
import { shiftRepository } from '../../repositories/shift.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

function generatePosToken(deviceId) {
  return jwt.sign({ deviceId }, config.posJwt.secret, { expiresIn: config.posJwt.expiresIn });
}

export const posAuthService = {
  async login({ pin }, req) {
    const device = await posDeviceRepository.findByPin(pin);
    if (!device) {
      throw new AppError('Mã PIN không đúng', 401);
    }

    if (device.deletedAt) {
      throw new AppError('Thiết bị đã bị xóa', 401);
    }

    if (!device.active) {
      throw new AppError('Thiết bị đã bị vô hiệu hóa', 403);
    }

    const token = generatePosToken(device.id);

    await posDeviceRepository.update(device.id, {
      deviceToken: token,
      status: 'ONLINE',
      lastActive: new Date(),
    });

    const openShift = await shiftRepository.findOpenShiftByDevice(device.id);

    let shift = openShift;
    if (!shift) {
      shift = await shiftRepository.create({
        branchId: device.branchId,
        posDeviceId: device.id,
        accountId: null,
        startTime: new Date(),
        status: 'OPEN',
        isOnline: true,
        lastActive: new Date(),
        openingBalance: 0,
        ipAddress: getClientIp(req),
      });
    } else {
      await shiftRepository.update(shift.id, {
        isOnline: true,
        lastActive: new Date(),
      });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: device.branchId },
      select: { id: true, name: true, address: true },
    });

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId: null,
      posDeviceId: device.id,
      action: 'POS_LOGIN',
      module: 'POS',
      details: { deviceCode: device.deviceCode, mode: device.mode },
      ipAddress: getClientIp(req),
    });

    return {
      token,
      device: {
        id: device.id,
        name: device.name,
        deviceCode: device.deviceCode,
        type: device.type,
        mode: device.mode,
        status: 'ONLINE',
        lastActive: new Date(),
      },
      branch,
      shift: {
        id: shift.id,
        startTime: shift.startTime,
        status: shift.status,
      },
    };
  },

  async logout(posDevice, req) {
    const device = await posDeviceRepository.findById(posDevice.id);
    if (!device) throw new AppError('Không tìm thấy thiết bị', 404);

    await posDeviceRepository.update(device.id, {
      status: 'OFFLINE',
      deviceToken: null,
      lastActive: new Date(),
    });

    await shiftRepository.closeOpenShifts(device.id);

    await activityLogRepository.create({
      branchId: device.branchId,
      accountId: null,
      posDeviceId: device.id,
      action: 'POS_LOGOUT',
      module: 'POS',
      details: { deviceCode: device.deviceCode },
      ipAddress: getClientIp(req),
    });
  },

  async ping(posDevice) {
    await posDeviceRepository.update(posDevice.id, {
      status: 'ONLINE',
      lastActive: new Date(),
    });

    const shift = await shiftRepository.findOpenShiftByDevice(posDevice.id);
    if (shift) {
      await shiftRepository.update(shift.id, {
        lastActive: new Date(),
        isOnline: true,
      });
    }

    return { lastActive: new Date() };
  },

  async getProfile(posDevice) {
    const device = await posDeviceRepository.findByIdWithBranch(posDevice.id);
    if (!device) throw new AppError('Không tìm thấy thiết bị', 404);

    const shift = await shiftRepository.findOpenShiftByDevice(posDevice.id);

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const ordersToday = await prisma.order.count({
      where: {
        posDeviceId: posDevice.id,
        createdAt: { gte: todayStart },
      },
    });

    return {
      id: device.id,
      name: device.name,
      deviceCode: device.deviceCode,
      type: device.type,
      mode: device.mode,
      status: device.status,
      active: device.active,
      lastActive: device.lastActive,
      branch: device.branch ? { id: device.branch.id, name: device.branch.name } : null,
      currentShift: shift ? {
        id: shift.id,
        startTime: shift.startTime,
        isOnline: shift.isOnline,
      } : null,
      ordersToday,
    };
  },
};
