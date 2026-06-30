import { employeeService } from './employee.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

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
