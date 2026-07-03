import prisma from '../../prisma/client.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/AppError.js';
import { permissionService } from './permission.service.js';

export const employeePermissionController = {
  getEmployeePermissions: asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const accountId = req.user.accountId || req.user.id;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, accountId, deletedAt: null },
    });
    if (!employee) throw new AppError('Không tìm thấy nhân viên', 404);

    const permissions = await permissionService.getEmployeePermissions(employeeId);
    sendSuccess(res, { data: permissions });
  }),

  updateEmployeePermissions: asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const accountId = req.user.accountId || req.user.id;
    const { permissionIds } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, accountId, deletedAt: null },
    });
    if (!employee) throw new AppError('Không tìm thấy nhân viên', 404);

    await permissionService.setEmployeePermissions(employeeId, permissionIds || []);
    sendSuccess(res, { message: 'Cập nhật quyền nhân viên thành công' });
  }),

  getEmployeePermissionsList: asyncHandler(async (req, res) => {
    const accountId = req.user.accountId || req.user.id;
    const { employeeIds } = req.query;

    const idList = employeeIds ? employeeIds.split(',') : [];
    const employees = await prisma.employee.findMany({
      where: { accountId, deletedAt: null, ...(idList.length > 0 ? { id: { in: idList } } : {}) },
      include: {
        permissions: {
          where: { allowed: true },
          include: { permission: true },
        },
      },
    });

    const data = employees.map(emp => ({
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      permissions: emp.permissions.map(ep => ep.permission.code),
    }));

    sendSuccess(res, { data });
  }),
};
