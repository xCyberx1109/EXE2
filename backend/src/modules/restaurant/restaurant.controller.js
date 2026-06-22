import { restaurantService } from './restaurant.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

function getContext(req) {
  return req.user || req.posDevice || null;
}

export const listTables = asyncHandler(async (req, res) => {
  const data = await restaurantService.listTables(getContext(req));
  sendSuccess(res, { message: 'Lấy danh sách bàn nhà hàng thành công', data: Array.isArray(data) ? data : [] });
});

export const createTable = asyncHandler(async (req, res) => {
  const data = await restaurantService.createTable(req.body, getContext(req));
  sendSuccess(res, { message: 'Tạo bàn thành công', data, statusCode: 201 });
});

export const updateTableLayout = asyncHandler(async (req, res) => {
  const data = await restaurantService.updateLayout(req.body.tables, getContext(req));
  sendSuccess(res, { message: 'Cập nhật sơ đồ bàn thành công', data });
});

export const createOrderForTable = asyncHandler(async (req, res) => {
  const data = await restaurantService.createOrderForTable(req.params.tableId, req.body, getContext(req));
  sendSuccess(res, { message: 'Tạo đơn hàng mới thành công', data, statusCode: 201 });
});

export const openOrderForTable = asyncHandler(async (req, res) => {
  const data = await restaurantService.openOrderForTable(
    req.params.tableId,
    req.body,
    getContext(req)
  );

  console.log('OPEN ORDER RESULT:', data);

  if (!data) {
    throw new Error('openOrderForTable returned null');
  }

  sendSuccess(res, {
    message: 'Mở đơn hàng thành công',
    data,
    statusCode: data.status === 'CONFIRMED' ? 201 : 200,
  });
});

export const getTableOrder = asyncHandler(async (req, res) => {
  const data = await restaurantService.getTableOrder(req.params.tableId, getContext(req));
  sendSuccess(res, { message: 'Lấy thông tin đơn hàng thành công', data });
});

export const addOrderItem = asyncHandler(async (req, res) => {
  const data = await restaurantService.addOrderItem(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Thêm món thành công', data, statusCode: 201 });
});

export const batchAddOrderItems = asyncHandler(async (req, res) => {
  const data = await restaurantService.batchAddOrderItems(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Thêm món hàng loạt thành công', data, statusCode: 200 });
});

export const updateOrderItem = asyncHandler(async (req, res) => {
  const data = await restaurantService.updateOrderItem(req.params.id, req.params.itemId, req.body, getContext(req));
  sendSuccess(res, { message: 'Cập nhật món thành công', data });
});

export const removeOrderItem = asyncHandler(async (req, res) => {
  const data = await restaurantService.removeOrderItem(req.params.id, req.params.itemId, getContext(req));
  sendSuccess(res, { message: 'Xóa món thành công', data });
});

export const transferOrder = asyncHandler(async (req, res) => {
  const data = await restaurantService.transferOrder(req.params.tableId, req.body, getContext(req));
  sendSuccess(res, { message: 'Chuyển bàn thành công', data });
});

export const mergeTables = asyncHandler(async (req, res) => {
  const data = await restaurantService.mergeTables(req.params.tableId, req.body, getContext(req));
  sendSuccess(res, { message: 'Gộp bàn thành công', data });
});

export const splitOrder = asyncHandler(async (req, res) => {
  const data = await restaurantService.splitOrder(req.params.tableId, req.body, getContext(req));
  sendSuccess(res, { message: 'Tách bàn thành công', data });
});

export const payOrder = asyncHandler(async (req, res) => {
  const data = await restaurantService.payOrder(req.params.id, req.body.paymentMethod, getContext(req));
  sendSuccess(res, { message: 'Thanh toán thành công', data });
});

export const updateTable = asyncHandler(async (req, res) => {
  const data = await restaurantService.updateTable(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Cập nhật bàn thành công', data });
});

export const deleteTable = asyncHandler(async (req, res) => {
  await restaurantService.deleteTable(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Xóa bàn thành công', data: null });
});

export const updateGuestCount = asyncHandler(async (req, res) => {
  const data = await restaurantService.updateGuestCount(req.params.tableId, req.body.guestCount, getContext(req));
  sendSuccess(res, { message: 'Cập nhật số khách thành công', data });
});

export const updateOrderNote = asyncHandler(async (req, res) => {
  const data = await restaurantService.updateOrderNote(req.params.id, req.body.note, getContext(req));
  sendSuccess(res, { message: 'Cập nhật ghi chú thành công', data });
});
