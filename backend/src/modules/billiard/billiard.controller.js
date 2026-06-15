import { billiardService } from './billiard.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

function getContext(req) {
  return req.user || req.posDevice || null;
}

export const listBilliardTables = asyncHandler(async (req, res) => {
  const data = await billiardService.listTables(getContext(req));
  sendSuccess(res, { message: 'Lấy danh sách bàn billiard thành công', data: Array.isArray(data) ? data : [] });
});

export const updateTableLayout = asyncHandler(async (req, res) => {
  const data = await billiardService.updateLayout(req.body.tables, getContext(req));
  sendSuccess(res, { message: 'Cập nhật sơ đồ bàn thành công', data });
});

export const playNow = asyncHandler(async (req, res) => {
  const data = await billiardService.playNow(req.params.tableId, req.body, getContext(req));
  sendSuccess(res, { message: 'Bắt đầu chơi thành công', data, statusCode: 201 });
});

export const reserveTable = asyncHandler(async (req, res) => {
  const data = await billiardService.reserveTable(req.params.tableId, req.body, getContext(req));
  sendSuccess(res, { message: 'Đặt bàn thành công', data, statusCode: 201 });
});

export const checkInReservation = asyncHandler(async (req, res) => {
  const data = await billiardService.checkInReservation(req.params.tableId, getContext(req));
  sendSuccess(res, { message: 'Check-in thành công', data });
});

export const cancelReservation = asyncHandler(async (req, res) => {
  const data = await billiardService.cancelReservation(req.params.tableId, getContext(req));
  sendSuccess(res, { message: 'Hủy đặt bàn thành công', data });
});

export const getCurrentSession = asyncHandler(async (req, res) => {
  const data = await billiardService.getCurrentSession(req.params.tableId, getContext(req));
  sendSuccess(res, { message: 'Lấy thông tin phiên chơi thành công', data });
});

export const extendSession = asyncHandler(async (req, res) => {
  const data = await billiardService.extendSession(req.params.id, req.body.additionalMinutes, getContext(req));
  sendSuccess(res, { message: 'Gia hạn phiên chơi thành công', data });
});

export const finishSession = asyncHandler(async (req, res) => {
  const data = await billiardService.finishSession(req.params.tableId, getContext(req));
  sendSuccess(res, { message: 'Kết thúc phiên chơi thành công', data });
});

export const getSessionOrder = asyncHandler(async (req, res) => {
  const data = await billiardService.getSessionOrder(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Lấy đơn hàng của phiên chơi thành công', data });
});

export const addOrderItem = asyncHandler(async (req, res) => {
  const data = await billiardService.addOrderItem(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Thêm món thành công', data, statusCode: 201 });
});

export const batchAddOrderItems = asyncHandler(async (req, res) => {
  const data = await billiardService.batchAddOrderItems(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Thêm món hàng loạt thành công', data, statusCode: 200 });
});

export const updateOrderItem = asyncHandler(async (req, res) => {
  const data = await billiardService.updateOrderItem(req.params.id, req.params.itemId, req.body, getContext(req));
  sendSuccess(res, { message: 'Cập nhật món thành công', data });
});

export const removeOrderItem = asyncHandler(async (req, res) => {
  const data = await billiardService.removeOrderItem(req.params.id, req.params.itemId, getContext(req));
  sendSuccess(res, { message: 'Xóa món thành công', data });
});

export const getTableOrderSummary = asyncHandler(async (req, res) => {
  const data = await billiardService.getTableOrderSummary(req.params.tableId, getContext(req));
  sendSuccess(res, { message: 'Lấy thông tin đơn hàng thành công', data });
});

export const payOrder = asyncHandler(async (req, res) => {
  const data = await billiardService.payOrder(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Thanh toán thành công', data });
});

export const createBilliardTable = asyncHandler(async (req, res) => {
  const data = await billiardService.createTable(req.body, getContext(req));
  sendSuccess(res, { message: 'Tạo bàn billiard thành công', data, statusCode: 201 });
});
