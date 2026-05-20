import { orderService } from './order.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/** POS legacy: trả về mảng thuần (không bọc success/data) */
export const listOrdersLegacy = asyncHandler(async (_req, res) => {
  const orders = await orderService.listActiveOrders();
  res.json(orders);
});

export const createOrderLegacy = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user?.id);
  res.status(201).json(order);
});

export const deleteOrderLegacy = asyncHandler(async (req, res) => {
  await orderService.deleteOrder(req.params.id);
  res.status(204).send();
});

/** API chuẩn với envelope */
export const listOrders = asyncHandler(async (_req, res) => {
  const data = await orderService.listActiveOrders();
  sendSuccess(res, { message: 'Lấy danh sách đơn thành công', data });
});

export const listOrdersByDate = asyncHandler(async (req, res) => {
  const data = await orderService.listOrdersByDate({
    date: req.query.date,
    status: req.query.status,
  });
  sendSuccess(res, { message: 'Lấy đơn hàng trong ngày thành công', data });
});

export const createOrder = asyncHandler(async (req, res) => {
  const data = await orderService.createOrder(req.body, req.user?.id);
  sendSuccess(res, { message: 'Tạo đơn thành công', data, statusCode: 201 });
});

export const deleteOrder = asyncHandler(async (req, res) => {
  await orderService.deleteOrder(req.params.id);
  sendSuccess(res, { message: 'Xóa đơn thành công', data: null });
});

export const completeTablePayment = asyncHandler(async (req, res) => {
  const { table, paymentMethod } = req.body;
  const data = await orderService.completeTableOrders(
    parseInt(table, 10),
    paymentMethod,
    req.user?.id
  );
  sendSuccess(res, { message: 'Thanh toán thành công', data });
});
