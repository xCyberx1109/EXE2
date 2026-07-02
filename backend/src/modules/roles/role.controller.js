import { roleService } from './role.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

function currentAccountId(req) {
  return req.user.accountId || req.user.id;
}

export const listRoles = asyncHandler(async (req, res) => {
  const data = await roleService.list(currentAccountId(req));
  sendSuccess(res, { message: 'Lấy danh sách vai trò thành công', data });
});

export const getRole = asyncHandler(async (req, res) => {
  const data = await roleService.getById(req.params.id, currentAccountId(req));
  sendSuccess(res, { message: 'Lấy thông tin vai trò thành công', data });
});

export const createRole = asyncHandler(async (req, res) => {
  const data = await roleService.create(currentAccountId(req), req.body);
  sendSuccess(res, { message: 'Tạo vai trò thành công', data, statusCode: 201 });
});

export const updateRole = asyncHandler(async (req, res) => {
  const data = await roleService.update(req.params.id, currentAccountId(req), req.body);
  sendSuccess(res, { message: 'Cập nhật vai trò thành công', data });
});

export const deleteRole = asyncHandler(async (req, res) => {
  await roleService.delete(req.params.id, currentAccountId(req));
  sendSuccess(res, { message: 'Xóa vai trò thành công', data: null });
});

export const updateRolePermissions = asyncHandler(async (req, res) => {
  const data = await roleService.setPermissions(req.params.id, currentAccountId(req), req.body.permissionIds);
  sendSuccess(res, { message: 'Cập nhật quyền vai trò thành công', data });
});
