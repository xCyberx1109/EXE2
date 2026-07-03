import { tableService } from './table.service.js';
import { billiardService } from '../billiard/billiard.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

function getContext(req) {
  return req.user || req.employee || null;
}

export const listTables = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const data = await tableService.list(getContext(req), { page, limit });
  sendSuccess(res, { message: 'Lấy danh sách bàn thành công', data });
});

export const getTable = asyncHandler(async (req, res) => {
  const data = await tableService.getById(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Lấy thông tin bàn thành công', data: data || null });
});

export const createTable = asyncHandler(async (req, res) => {
  const data = await tableService.create(req.body, getContext(req));
  sendSuccess(res, { message: 'Tạo bàn thành công', data, statusCode: 201 });
});

export const updateTable = asyncHandler(async (req, res) => {
  const data = await tableService.update(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Cập nhật bàn thành công', data });
});

export const deleteTable = asyncHandler(async (req, res) => {
  await tableService.delete(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Xóa bàn thành công', data: null });
});

export const listPosTables = asyncHandler(async (req, res) => {
  const ctx = req.user;
  console.log('[listPosTables] authType:', req.authType, 'contextId:', ctx?.id, 'accountId:', ctx?.accountId);

  const data = await tableService.getPosTables(ctx);
  if (!Array.isArray(data)) {
    console.error('[listPosTables] service returned non-array:', data);
    return sendSuccess(res, { message: 'Lấy sơ đồ bàn thành công', data: [] });
  }
  sendSuccess(res, { message: 'Lấy sơ đồ bàn thành công', data });
});

export const assignOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const data = await tableService.assignOrder(req.params.id, orderId, req.user);
  sendSuccess(res, { message: 'Gán đơn hàng vào bàn thành công', data });
});

export const releaseTable = asyncHandler(async (req, res) => {
  const data = await tableService.releaseTable(req.params.id, req.user);
  sendSuccess(res, { message: 'Giải phóng bàn thành công', data });
});

export const updateTableLayout = asyncHandler(async (req, res) => {
  const data = await billiardService.updateLayout(req.body.tables, req.user);
  sendSuccess(res, { message: 'Cập nhật sơ đồ bàn thành công', data });
});

export const updateTableStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const data = await tableService.updateStatus(req.params.id, status, req.user);
  sendSuccess(res, { message: 'Cập nhật trạng thái bàn thành công', data });
});

export const checkInReservation = asyncHandler(async (req, res) => {
  const data = await tableService.checkInReservation(req.params.id, req.user);
  sendSuccess(res, { message: 'Check-in bàn đặt trước thành công', data });
});
