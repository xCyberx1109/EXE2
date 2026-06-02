import { orderService } from './order.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { requireDevicePermission } from '../../middlewares/devicePermission.js';

/** POS legacy: trả về mảng thuần (không bọc success/data) */
export const listOrdersLegacy = asyncHandler(async (req, res) => {
  const orders = await orderService.listActiveOrders(req.user);
  res.json(orders);
});

export const createOrderLegacy = asyncHandler(async (req, res) => {
  const ctx = req.user || req.posDevice;
  const order = await orderService.createOrder(req.body, ctx);
  res.status(201).json(order);
});

export const deleteOrderLegacy = asyncHandler(async (req, res) => {
  await orderService.deleteOrder(req.params.id, req.user);
  res.status(204).send();
});

/** Kitchen queue - lấy danh sách món cho bếp */
export const listKitchenQueue = asyncHandler(async (req, res) => {
  const ctx = req.user || req.posDevice || req;
  const data = await orderService.listKitchenQueue(ctx);
  sendSuccess(res, { message: 'Lấy hàng chờ bếp thành công', data: { orders: data } });
});

/** Cập nhật kitchen status */
export const updateKitchenStatus = [
  requireDevicePermission('kitchen:update_status'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const ctx = req.user || req.posDevice || req;
    const data = await orderService.updateKitchenStatus(req.params.id, status, ctx);
    sendSuccess(res, { message: 'Cập nhật trạng thái bếp thành công', data });
  }),
];

/** API chuẩn với envelope */
export const listOrders = asyncHandler(async (req, res) => {
  const data = await orderService.listActiveOrders(req.user);
  sendSuccess(res, { message: 'Lấy danh sách đơn thành công', data });
});

export const listOrdersByDate = asyncHandler(async (req, res) => {
  const data = await orderService.listOrdersByDate({
    date: req.query.date,
    status: req.query.status,
  }, req.user);
  sendSuccess(res, { message: 'Lấy đơn hàng trong ngày thành công', data });
});

export const createOrder = asyncHandler(async (req, res) => {
  const ctx = req.user || req.posDevice;
  const data = await orderService.createOrder(req.body, ctx);
  sendSuccess(res, { message: 'Tạo đơn thành công', data, statusCode: 201 });
});

export const deleteOrder = asyncHandler(async (req, res) => {
  await orderService.deleteOrder(req.params.id, req.user);
  sendSuccess(res, { message: 'Xóa đơn thành công', data: null });
});

export const completeTablePayment = asyncHandler(async (req, res) => {
  const { table, paymentMethod } = req.body;
  const data = await orderService.completeTableOrders(
    parseInt(table, 10),
    paymentMethod,
    req.user
  );
  sendSuccess(res, { message: 'Thanh toán thành công', data });
});
