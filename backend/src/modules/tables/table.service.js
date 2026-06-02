import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { assertBranchAccess, buildBranchWhere, branchDataForCreate } from '../../middlewares/branchScope.js';

export const tableService = {
  async list(user) {
    const where = buildBranchWhere(user, { isActive: true });
    return prisma.table.findMany({
      where,
      orderBy: [{ tableCode: 'asc' }],
    });
  },

  async getById(id, user) {
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(table, user, 'bàn');
    return table;
  },

  async create(data, user) {
    const branchId = user.branchId;
    if (!branchId) throw new AppError('Không xác định được chi nhánh', 400);

    const existing = await prisma.table.findUnique({
      where: { branchId_tableCode: { branchId, tableCode: data.tableCode } },
    });
    if (existing) throw new AppError('Mã bàn đã tồn tại trong chi nhánh này', 409);

    return prisma.table.create({
      data: {
        tableCode: data.tableCode,
        tableName: data.tableName || null,
        capacity: data.capacity,
        status: data.status || 'AVAILABLE',
        branchId,
      },
    });
  },

  async update(id, data, user) {
    const existing = await prisma.table.findUnique({ where: { id } });
    if (!existing) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(existing, user, 'bàn');

    if (data.tableCode && data.tableCode !== existing.tableCode) {
      const duplicate = await prisma.table.findUnique({
        where: { branchId_tableCode: { branchId: existing.branchId, tableCode: data.tableCode } },
      });
      if (duplicate) throw new AppError('Mã bàn đã tồn tại trong chi nhánh này', 409);
    }

    const updateData = {};
    if (data.tableCode !== undefined) updateData.tableCode = data.tableCode;
    if (data.tableName !== undefined) updateData.tableName = data.tableName;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.table.update({ where: { id }, data: updateData });
  },

  async delete(id, user) {
    const existing = await prisma.table.findUnique({ where: { id } });
    if (!existing) throw new AppError('Không tìm thấy bàn', 404);
    assertBranchAccess(existing, user, 'bàn');

    await prisma.table.update({ where: { id }, data: { isActive: false } });
  },
};
