import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { shiftRepository } from '../../repositories/shift.repository.js';
import { staffSessionRepository } from '../../repositories/staffSession.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

export const shiftService = {
  async openShift(posDevice, { openingBalance, note }, req) {
    if (!posDevice.active) throw new AppError('Device is disabled', 403);
    if (!posDevice.activatedAt) throw new AppError('Device not activated', 401);

    const existing = await shiftRepository.findOpenShiftByDevice(posDevice.id);
    if (existing) {
      throw new AppError('An open shift already exists for this device', 400);
    }

    const activeStaff = await staffSessionRepository.findActiveByDevice(posDevice.id);

    const shift = await shiftRepository.create({
      branchId: posDevice.branchId,
      posDeviceId: posDevice.id,
      accountId: activeStaff[0]?.account?.id || null,
      startTime: new Date(),
      status: 'OPEN',
      isOnline: true,
      lastActive: new Date(),
      openingBalance: openingBalance || 0,
      cashSales: 0,
      cardSales: 0,
      otherSales: 0,
      totalOrders: 0,
      note: note || null,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });

    if (activeStaff.length > 0) {
      await staffSessionRepository.update(activeStaff[0].sessionId, {
        shiftId: shift.id,
      });
    }

    await activityLogRepository.create({
      branchId: posDevice.branchId,
      posDeviceId: posDevice.id,
      accountId: activeStaff[0]?.account?.id || null,
      action: 'SHIFT_OPENED',
      module: 'SHIFTS',
      details: {
        shiftId: shift.id,
        openingBalance,
        deviceCode: posDevice.deviceCode,
      },
      ipAddress: getClientIp(req),
    });

    return {
      id: shift.id,
      status: shift.status,
      openingBalance: shift.openingBalance,
      openedAt: shift.startTime,
      cashier: activeStaff[0]?.account || null,
    };
  },

  async closeShift(posDevice, { closingBalance, actualBalance, note }, req) {
    if (!posDevice.active) throw new AppError('Device is disabled', 403);

    const shift = await shiftRepository.findOpenShiftByDevice(posDevice.id);
    if (!shift) {
      throw new AppError('No open shift found for this device', 404);
    }

    if (closingBalance === undefined || closingBalance === null) {
      throw new AppError('Closing balance is required', 400);
    }

    const cashSales = await this.calculateShiftSales(shift.id, 'CASH');
    const cardSales = await this.calculateShiftSales(shift.id, 'CARD');
    const otherSales = await this.calculateShiftSales(shift.id);
    const totalOrders = await prisma.order.count({
      where: { shiftId: shift.id },
    });

    const expectedCashBalance = Number(shift.openingBalance) + Number(cashSales);
    const balanceVariance = Number(closingBalance) - expectedCashBalance;

    await shiftRepository.update(shift.id, {
      status: 'CLOSED',
      endTime: new Date(),
      isOnline: false,
      lastActive: new Date(),
      closingBalance,
      actualBalance: actualBalance || closingBalance,
      cashSales,
      cardSales,
      otherSales: otherSales - cashSales - cardSales,
      totalOrders,
      note: note || null,
    });

    await staffSessionRepository.logoutAllByDevice(posDevice.id);

    await activityLogRepository.create({
      branchId: posDevice.branchId,
      posDeviceId: posDevice.id,
      accountId: shift.accountId,
      action: 'SHIFT_CLOSED',
      module: 'SHIFTS',
      details: {
        shiftId: shift.id,
        openingBalance: shift.openingBalance,
        closingBalance,
        actualBalance: actualBalance || closingBalance,
        expectedCashBalance,
        balanceVariance,
        cashSales,
        cardSales,
        totalOrders,
        deviceCode: posDevice.deviceCode,
      },
      ipAddress: getClientIp(req),
    });

    return {
      id: shift.id,
      status: 'CLOSED',
      openingBalance: shift.openingBalance,
      closingBalance,
      expectedCashBalance,
      balanceVariance,
      cashSales,
      cardSales,
      otherSales,
      totalOrders,
      openedAt: shift.startTime,
      closedAt: new Date(),
      cashier: shift.account
        ? { id: shift.account?.id, fullName: shift.account?.fullName }
        : null,
    };
  },

  async getCurrentShift(posDevice) {
    const shift = await shiftRepository.findOpenShiftByDevice(posDevice.id);
    if (!shift) return null;

    const activeStaff = await staffSessionRepository.findActiveByDevice(posDevice.id);
    const todayOrders = await prisma.order.findMany({
      where: { shiftId: shift.id },
      select: { total: true, paymentStatus: true, paymentMethod: true },
    });

    return {
      id: shift.id,
      status: shift.status,
      openingBalance: shift.openingBalance,
      openedAt: shift.startTime,
      cashSales: shift.cashSales,
      cardSales: shift.cardSales,
      otherSales: shift.otherSales,
      totalOrders: shift.totalOrders,
      currentSales: todayOrders.reduce((sum, o) => sum + Number(o.total), 0),
      staff: activeStaff.map((s) => s.account),
      isOnline: shift.isOnline,
      lastActive: shift.lastActive,
    };
  },

  async getShiftHistory(posDevice, query = {}) {
    const { limit = 20, offset = 0, status } = query;
    const where = { posDeviceId: posDevice.id };

    if (status) where.status = status;

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          account: { select: { id: true, fullName: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { startTime: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.shift.count({ where }),
    ]);

    return { shifts, total, limit: parseInt(limit), offset: parseInt(offset) };
  },

  async getShiftById(shiftId, posDevice) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, posDeviceId: posDevice.id },
      include: {
        account: { select: { id: true, fullName: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!shift) throw new AppError('Shift not found', 404);
    return shift;
  },

  async calculateShiftSales(shiftId, method = null) {
    const where = { shiftId, paymentStatus: 'PAID' };
    if (method) where.paymentMethod = method;

    let totalMethod = 'CASH';
    if (method === 'CARD') totalMethod = 'CARD';
    if (method && method !== 'CASH' && method !== 'CARD') totalMethod = 'OTHER';

    const result = await prisma.order.aggregate({
      where,
      _sum: { total: true },
    });

    return Number(result._sum.total || 0);
  },
};
