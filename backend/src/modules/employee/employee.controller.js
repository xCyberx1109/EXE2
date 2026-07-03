import prisma from '../../prisma/client.js';
import { employeeService } from './employee.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/AppError.js';
import { getTemplateNames } from '../../utils/permissionTemplates.js';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';

function getAccountId(req) {
  return req.user.accountId || req.user.id;
}

export const listEmployees = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  const { page, limit, search, status } = req.query;
  const data = await employeeService.list(accountId, { search, status, page, limit });
  sendSuccess(res, { message: 'Danh sách nhân viên', data });
});

export const getEmployee = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  const data = await employeeService.getById(req.params.id, accountId);
  sendSuccess(res, { message: 'Thông tin nhân viên', data });
});

export const createEmployee = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  const result = await employeeService.create(accountId, req.body, req);
  sendSuccess(res, { message: 'Thêm nhân viên thành công', data: result, statusCode: 201 });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  const data = await employeeService.update(req.params.id, accountId, req.body, req);
  sendSuccess(res, { message: 'Cập nhật nhân viên thành công', data });
});

export const resetEmployeePin = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  const data = await employeeService.resetPin(req.params.id, accountId);
  sendSuccess(res, { message: 'Đặt lại mã PIN thành công', data });
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  await employeeService.delete(req.params.id, accountId, req);
  sendSuccess(res, { message: 'Xóa nhân viên thành công', data: null });
});

export const getEmployeeLogs = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  const data = await employeeService.getLogs(req.params.id, accountId, req.query);
  sendSuccess(res, { message: 'Lịch sử hoạt động của nhân viên', data });
});

export const getEmployeePermissions = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  const emp = await prisma.employee.findFirst({
    where: { id: req.params.id, accountId, deletedAt: null },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });
  if (!emp) return sendSuccess(res, { data: { permissions: [], permissionIds: [] } });
  sendSuccess(res, {
    data: {
      permissions: emp.permissions.map(ep => ep.permission.code),
      permissionIds: emp.permissions.map(ep => ep.permission.id),
    },
  });
});

export const updateEmployeePermissions = asyncHandler(async (req, res) => {
  const accountId = getAccountId(req);
  const { permissionIds } = req.body;
  const emp = await prisma.employee.findFirst({
    where: { id: req.params.id, accountId, deletedAt: null },
  });
  if (!emp) throw new AppError('Không tìm thấy nhân viên', 404);

  await prisma.employeePermission.deleteMany({ where: { employeeId: emp.id } });
  if (permissionIds && permissionIds.length > 0) {
    await prisma.employeePermission.createMany({
      data: permissionIds.map(pid => ({ employeeId: emp.id, permissionId: pid })),
    });
  }
  sendSuccess(res, { message: 'Cập nhật quyền thành công' });
});

export const getPermissionTemplates = asyncHandler(async (_req, res) => {
  const templates = getTemplateNames();
  const allPermissions = await prisma.permission.findMany({
    where: { deletedAt: null },
    orderBy: [{ module: 'asc' }, { code: 'asc' }],
  });
  sendSuccess(res, { data: { templates, allPermissions } });
});

export const loginByPin = asyncHandler(async (req, res) => {
  const { pinCode } = req.body;
  if (!pinCode || !/^\d{6}$/.test(pinCode)) {
    throw new AppError('Mã PIN phải có 6 chữ số', 400);
  }

  const { employee, permissions } = await employeeService.loginByPin(pinCode);
  await employeeService.updateLastLogin(employee.id);

  const token = jwt.sign(
    { type: 'employee', employeeId: employee.id, accountId: employee.accountId, permissions },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );

  sendSuccess(res, { data: { employee, permissions, token } });
});
