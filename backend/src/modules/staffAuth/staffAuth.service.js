import bcrypt from 'bcrypt';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { staffSessionRepository } from '../../repositories/staffSession.repository.js';
import { shiftRepository } from '../../repositories/shift.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const loginAttempts = new Map();

function checkRateLimit(pinCode) {
  const key = `staff-login:${pinCode}`;
  const record = loginAttempts.get(key);
  if (record && record.count >= MAX_LOGIN_ATTEMPTS) {
    if (Date.now() - record.firstAttempt < LOCKOUT_WINDOW_MS) {
      throw new AppError('Too many login attempts. Try again in 15 minutes.', 429);
    }
    loginAttempts.delete(key);
  }
}

function recordAttempt(pinCode, success) {
  const key = `staff-login:${pinCode}`;
  if (success) {
    loginAttempts.delete(key);
    return;
  }
  const record = loginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
  record.count++;
  loginAttempts.set(key, record);
}

export const staffAuthService = {
  async loginWithPin(posDevice, { pinCode }, req) {
    if (!posDevice.active) throw new AppError('Device is disabled', 403);
    if (!posDevice.activatedAt) throw new AppError('Device not activated', 401);

    checkRateLimit(pinCode);

    const account = await prisma.account.findFirst({
      where: {
        branchId: posDevice.branchId,
        pinCode,
        active: true,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });

    if (!account) {
      recordAttempt(pinCode, false);
      throw new AppError('Invalid PIN code', 401);
    }

    recordAttempt(pinCode, true);

    const existing = await staffSessionRepository.findActiveByAccount(account.id, posDevice.id);
    if (existing) {
      const shift = existing.shiftId
        ? await shiftRepository.findById(existing.shiftId)
        : null;

      return {
        sessionId: existing.id,
        account: {
          id: account.id,
          fullName: account.fullName,
          role: account.role,
        },
        shift: shift
          ? { id: shift.id, status: shift.status, openedAt: shift.startTime }
          : null,
        loginAt: existing.loginAt,
      };
    }

    const openShift = await shiftRepository.findOpenShiftByDevice(posDevice.id);

    const session = await staffSessionRepository.create({
      accountId: account.id,
      deviceId: posDevice.id,
      shiftId: openShift?.id || null,
      loginAt: new Date(),
      lastActivityAt: new Date(),
    });

    await prisma.posDevice.update({
      where: { id: posDevice.id },
      data: { lastLoginAt: new Date() },
    });

    await activityLogRepository.create({
      branchId: posDevice.branchId,
      accountId: account.id,
      posDeviceId: posDevice.id,
      action: 'STAFF_LOGIN_PIN',
      module: 'STAFF_AUTH',
      details: { fullName: account.fullName, role: account.role, deviceId: posDevice.id },
      ipAddress: getClientIp(req),
    });

    return {
      sessionId: session.id,
      account: {
        id: account.id,
        fullName: account.fullName,
        role: account.role,
      },
      shift: openShift
        ? { id: openShift.id, status: openShift.status, openedAt: openShift.startTime }
        : null,
      loginAt: session.loginAt,
    };
  },

  async logout(posDevice, accountId, req) {
    if (accountId) {
      await staffSessionRepository.logoutAllByAccount(accountId, posDevice.id);
    } else {
      await staffSessionRepository.logoutAllByDevice(posDevice.id);
    }

    await activityLogRepository.create({
      branchId: posDevice.branchId,
      posDeviceId: posDevice.id,
      action: 'STAFF_LOGOUT',
      module: 'STAFF_AUTH',
      details: { deviceId: posDevice.id, accountId },
      ipAddress: getClientIp(req),
    });
  },

  async switchStaff(posDevice, { pinCode }, req) {
    await staffSessionRepository.logoutAllByDevice(posDevice.id);

    return this.loginWithPin(posDevice, { pinCode }, req);
  },

  async getActiveStaffOnDevice(posDevice) {
    const sessions = await staffSessionRepository.findActiveByDevice(posDevice.id);
    return sessions.map((s) => ({
      sessionId: s.id,
      account: s.account,
      loginAt: s.loginAt,
      lastActivityAt: s.lastActivityAt,
    }));
  },
};
