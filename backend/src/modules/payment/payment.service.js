import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { getPaymentCallback } from './payment.callbacks.js';

export const paymentFlowService = {
  async initiatePayment(orderId, { paymentMethod = 'CASH', amount } = {}, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, session: true, items: true },
    });
    if (!order) throw new AppError('Khong tim thay don hang', 404);
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Don hang nay thuoc tai khoan khac', 403);
      }
    }
    if (order.paymentStatus === 'PAID') {
      throw new AppError('Don hang da duoc thanh toan', 409);
    }

    const total = amount !== undefined ? Number(amount) : Number(order.total);

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, paymentStatus: true, status: true },
      });
      if (!currentOrder) throw new AppError('Khong tim thay don hang', 404);
      if (currentOrder.paymentStatus === 'PAID') {
        throw new AppError('Don hang da duoc thanh toan', 409);
      }

      if (currentOrder.status !== 'PENDING_PAYMENT') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'PENDING_PAYMENT' },
        });
      }

      const bankAccounts = await prisma.branchBankAccount.findMany({
        where: { branchId: order.accountId },
        orderBy: { isDefault: 'desc' },
      });

      return {
        id: orderId,
        orderNumber: order.orderNumber,
        amount: total,
        paymentContent: `TT${order.orderNumber}`,
        bankAccounts: bankAccounts.map((ba) => ({
          bankCode: ba.bankCode,
          bankName: ba.bankName,
          accountNumber: ba.accountNumber,
          accountHolder: ba.accountHolder,
        })),
      };
    });
  },

  async confirmPayment(orderId, { paymentMethod = 'CASH', amount } = {}, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, items: true },
    });
    if (!order) throw new AppError('Khong tim thay don hang', 404);
    if (order.status !== 'PENDING_PAYMENT') {
      throw new AppError('Don hang khong o trang thai cho thanh toan', 400);
    }
    if (order.paymentStatus === 'PAID') {
      throw new AppError('Don hang da duoc thanh toan', 409);
    }
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Don hang nay thuoc tai khoan khac', 403);
      }
    }
    if (order.table) {
      const { assertBranchAccess } = await import('../../middlewares/branchScope.js');
      assertBranchAccess(order.table, user, 'ban');
    }

    const prismaMethod = paymentMethod === 'QR' || paymentMethod === 'BANK_TRANSFER' ? 'BANKING' : paymentMethod;
    const userId = user?.accountId || user?.id || order.createdBy;
    const source = order.source || 'ORDER_QUEUE_POS';
    const payAmount = amount !== undefined ? Number(amount) : Number(order.total);

    return prisma.$transaction(async (tx) => {
      const guarded = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PENDING_PAYMENT',
          paymentStatus: { not: 'PAID' },
        },
        data: {
          paymentStatus: 'PAID',
          paymentMethod: prismaMethod,
          inventoryDeducted: true,
          total: payAmount,
        },
      });

      if (guarded.count !== 1) {
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, paymentStatus: true, status: true },
        });
        if (!currentOrder) throw new AppError('Khong tim thay don hang', 404);
        if (currentOrder.paymentStatus === 'PAID') {
          throw new AppError('Don hang da duoc thanh toan', 409);
        }
        throw new AppError('Don hang khong o trang thai cho thanh toan', 400);
      }

      await tx.payment.create({
        data: {
          orderId,
          amount: payAmount,
          method: prismaMethod,
          status: 'PAID',
        },
      });

      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
      });

      const callback = getPaymentCallback(source);
      if (callback && updatedOrder) {
        await callback(tx, { ...order, ...updatedOrder }, prismaMethod, userId);
      }

      return { id: orderId, paymentStatus: 'PAID', source };
    });
  },

  async cancelPayment(orderId, user) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });
    if (!order) throw new AppError('Khong tim thay don hang', 404);
    if (order.status !== 'PENDING_PAYMENT') {
      throw new AppError('Don hang khong o trang thai cho thanh toan', 400);
    }
    if (user) {
      const accountId = user.accountId || user.id;
      if (accountId && order.accountId !== accountId) {
        throw new AppError('Don hang nay thuoc tai khoan khac', 403);
      }
    }
    if (order.table) {
      const { assertBranchAccess } = await import('../../middlewares/branchScope.js');
      assertBranchAccess(order.table, user, 'ban');
    }

    return prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', deletedAt: new Date() },
      });

      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      return { id: orderId, status: 'CANCELLED' };
    });
  },
};
