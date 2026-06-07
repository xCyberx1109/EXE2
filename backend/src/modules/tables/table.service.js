import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { assertBranchAccess, buildBranchWhere } from '../../middlewares/branchScope.js';
import { tableRepository } from '../../repositories/table.repository.js';

export const tableService = {
  async list(user) {
    const where = buildBranchWhere(user, { isActive: true });
    const tables = await tableRepository.findMany(where);
    return Array.isArray(tables) ? tables : [];
  },

  async getById(id, user) {
    const table = await tableRepository.findById(id);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');
    return table;
  },

  async create(data, user) {
    const accountId = user.accountId || user.id;
    if (!accountId) throw new AppError('Không xác định được tài khoản', 400);

    const existing = await tableRepository.findByBranchTableCode(accountId, data.tableCode);
    if (existing) throw new AppError('Mã bàn đã tồn tại trong tài khoản này', 409);

    return tableRepository.create({
      data: {
        tableCode: data.tableCode,
        tableName: data.tableName || null,
        capacity: data.capacity,
        status: data.status || 'AVAILABLE',
        branchId: accountId,
      },
    });
  },

  async update(id, data, user) {
    const existing = await tableRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(existing, user, 'bàn');

    if (data.tableCode && data.tableCode !== existing.tableCode) {
      const duplicate = await tableRepository.findByBranchTableCode(existing.branchId, data.tableCode);
      if (duplicate) throw new AppError('Mã bàn đã tồn tại trong tài khoản này', 409);
    }

    const updateData = {};
    if (data.tableCode !== undefined) updateData.tableCode = data.tableCode;
    if (data.tableName !== undefined) updateData.tableName = data.tableName;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.status !== undefined) updateData.status = data.status;

    return tableRepository.update(id, updateData);
  },

  async delete(id, user) {
    const existing = await tableRepository.findById(id);
    if (!existing) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(existing, user, 'bàn');

    const activeOrder = existing.orders?.[0];
    if (activeOrder) {
      throw new AppError('Không thể xóa bàn đang có đơn hàng', 400);
    }

    await tableRepository.softDelete(id);
  },

  async getPosTables(user) {
    const accountId = user?.accountId || user?.id || user?.branch?.id;
    console.log('[getPosTables] accountId:', accountId, 'user:', user?.id || 'device:' + user?.id);

    const where = buildBranchWhere(user, { isActive: true });
    console.log('[getPosTables] query where:', JSON.stringify(where));

    let tables;
    try {
      tables = await tableRepository.findMany(where);
    } catch (err) {
      console.error('[getPosTables] Prisma query failed:', err.message, err.stack);
      return [];
    }

    if (!Array.isArray(tables)) {
      console.error('[getPosTables] Prisma returned non-array:', tables);
      return [];
    }

    return tables.map((t) => {
      const activeOrder = t.orders?.[0] || null;
      const itemCount = activeOrder?.items
        ? activeOrder.items.reduce((s, i) => s + (i.quantity || 0), 0)
        : 0;

      return {
        id: t.id,
        branchId: t.branchId,
        tableCode: t.tableCode,
        tableName: t.tableName,
        capacity: t.capacity,
        status: t.status,
        currentOrderId: activeOrder?.id || null,
        currentOrder: activeOrder
          ? {
              id: activeOrder.id,
              orderNumber: activeOrder.orderNumber,
              status: activeOrder.status,
              itemCount,
              total: Number(activeOrder.total || 0),
            }
          : null,
        orderCount: t._count?.orders || 0,
        isActive: t.isActive,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
  },

  async assignOrder(tableId, orderId, user) {
    const table = await tableRepository.findById(tableId);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    const activeOrder = table.orders?.[0];
    if (table.status === 'OCCUPIED' && activeOrder) {
      throw new AppError('Bàn này đang có khách', 400);
    }

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    await prisma.order.update({
      where: { id: orderId },
      data: { tableId },
    });

    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'OCCUPIED' },
    });

    return tableRepository.findById(tableId);
  },

  async releaseTable(id, user) {
    const table = await tableRepository.findById(id);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    await tableRepository.update(id, { status: 'AVAILABLE' });

    return tableRepository.findById(id);
  },

  async updateStatus(id, status, user) {
    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'CHECKING_OUT', 'DISABLED'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Trạng thái không hợp lệ', 400);
    }

    const table = await tableRepository.findById(id);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    await tableRepository.update(id, { status });
    return tableRepository.findById(id);
  },

  async checkInReservation(id, user) {
    const table = await tableRepository.findById(id);
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');

    if (table.status !== 'RESERVED') {
      throw new AppError('Bàn này không ở trạng thái đặt trước', 400);
    }

    await tableRepository.update(id, { status: 'OCCUPIED' });
    return tableRepository.findById(id);
  },
};
