import { tableService } from './table.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const listTables = asyncHandler(async (req, res) => {
  const data = await tableService.list(req.user);
  sendSuccess(res, { message: 'Lấy danh sách bàn thành công', data });
});

export const getTable = asyncHandler(async (req, res) => {
  const data = await tableService.getById(req.params.id, req.user);
  sendSuccess(res, { message: 'Lấy thông tin bàn thành công', data });
});

export const createTable = asyncHandler(async (req, res) => {
  const data = await tableService.create(req.body, req.user);
  sendSuccess(res, { message: 'Tạo bàn thành công', data, statusCode: 201 });
});

export const updateTable = asyncHandler(async (req, res) => {
  const data = await tableService.update(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Cập nhật bàn thành công', data });
});

export const deleteTable = asyncHandler(async (req, res) => {
  await tableService.delete(req.params.id, req.user);
  sendSuccess(res, { message: 'Xóa bàn thành công', data: null });
});
