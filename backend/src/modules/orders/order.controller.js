import { orderService } from './order.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
/** POS legacy: trả về mảng thuần (không bọc success/data) */
export const listOrdersLegacy = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const orders = await orderService.listActiveOrders(ctx);
  res.json(orders);
});

export const createOrderLegacy = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const result = await orderService.createOrder(req.body, ctx);
  res.status(result.created ? 201 : 200).json(result.data);
});

export const deleteOrderLegacy = asyncHandler(async (req, res) => {
  const ctx = req.user;
  await orderService.deleteOrder(req.params.id, ctx);
  res.status(204).send();
});

/** Kitchen queue - lấy danh sách món cho bếp */
export const listKitchenQueue = asyncHandler(async (req, res) => {
  const ctx = req.user || req;
  const data = await orderService.listKitchenQueue(ctx);
  sendSuccess(res, { message: 'Lấy hàng chờ bếp thành công', data: { orders: data } });
});

/** Cập nhật kitchen status */
export const updateKitchenStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const ctx = req.user || req;
  const data = await orderService.updateKitchenStatus(req.params.id, status, ctx);
  sendSuccess(res, { message: 'Cập nhật trạng thái bếp thành công', data });
});

/** API chuẩn với envelope */
export const listOrders = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const data = await orderService.listActiveOrders(ctx);
  sendSuccess(res, { message: 'Lấy danh sách đơn thành công', data });
});

export const listOrdersByDate = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const data = await orderService.listOrdersByDate({
    date: req.query.date,
    status: req.query.status,
  }, ctx);
  sendSuccess(res, { message: 'Lấy đơn hàng trong ngày thành công', data });
});

export const createOrder = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const result = await orderService.createOrder(req.body, ctx);
  sendSuccess(res, {
    message: result.created ? 'Tạo đơn thành công' : 'Bàn đã có đơn đang mở',
    data: result.data,
    statusCode: result.created ? 201 : 200,
  });
});

export const deleteOrder = asyncHandler(async (req, res) => {
  await orderService.deleteOrder(req.params.id, req.user);
  sendSuccess(res, { message: 'Xóa đơn thành công', data: null });
});

export const getActiveTableOrder = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  const ctx = req.user;
  const data = await orderService.getActiveOrderForTable(tableId, ctx);
  sendSuccess(res, { message: 'Lấy đơn hàng của bàn thành công', data });
});

export const completeTablePayment = asyncHandler(async (req, res) => {
  const { table, paymentMethod } = req.body;
  const ctx = req.user;
  const data = await orderService.completeTableOrders(
    String(table).trim(),
    paymentMethod,
    ctx
  );
  sendSuccess(res, { message: 'Thanh toán thành công', data });
});

/** Order Detail */
export const getOrderDetail = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const data = await orderService.getOrderDetail(req.params.orderId, ctx);
  sendSuccess(res, { message: 'Lấy chi tiết đơn hàng thành công', data });
});

/** Order History */
export const listOrderHistory = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const data = await orderService.listOrderHistory(ctx, {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    status: req.query.status,
    source: req.query.source,
    page: req.query.page,
    limit: req.query.limit,
  });
  sendSuccess(res, { message: 'Lấy lịch sử đơn hàng thành công', data });
});

/** Order Queue POS - module độc lập, không gắn bàn */
export const listOrderQueue = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const data = await orderService.listQueueOrders(ctx, {
    search: req.query.search,
    status: req.query.status,
    paymentStatus: req.query.paymentStatus,
  });
  sendSuccess(res, { message: 'Lấy danh sách Order Queue thành công', data });
});

export const createOrderQueue = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const result = await orderService.createQueueOrder(req.body, ctx);
  sendSuccess(res, {
    message: 'Tạo Order Queue thành công',
    data: result.data,
    statusCode: result.created ? 201 : 200,
  });
});

export const updateOrderQueue = asyncHandler(async (req, res) => {
  console.log("=== UPDATE ORDER QUEUE ===");
  console.log("URL:", req.method, req.originalUrl);
  console.log("Params:", JSON.stringify(req.params));
  console.log("Request body (full payload):", JSON.stringify(req.body, null, 2));
  console.log("Auth context:", req.user ? `user=${req.user.id}` : 'none');
  const ctx = req.user;
  try {
    const data = await orderService.updateQueueOrder(req.params.id, req.body, ctx);
    console.log("UPDATE SUCCESS:", JSON.stringify(data, null, 2));
    sendSuccess(res, { message: 'Cập nhật Order Queue thành công', data });
  } catch (error) {
    console.log("UPDATE FAILED:", {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      field: error.field,
      stack: error.stack?.split('\n').slice(0, 4).join('\n'),
    });
    throw error;
  }
});

export const payOrderQueue = asyncHandler(async (req, res) => {
  console.log("[PAYMENT REQUEST]", JSON.stringify(req.body, null, 2));
  console.log("[ORDER ID]", req.params.id);
  console.log("[PAYMENT METHOD FROM BODY]", req.body.paymentMethod);
  console.log("[TOTAL FROM BODY]", req.body.total);
  console.log("[ITEMS FROM BODY]", JSON.stringify(req.body.items, null, 2));

  const ctx = req.user;
  try {
    const data = await orderService.completeQueuePayment(
      req.params.id,
      req.body.paymentMethod,
      ctx
    );

    if (data && data.inventoryIssues) {
      console.log("[PAYMENT INVENTORY ISSUES]", JSON.stringify(data.inventoryIssues, null, 2));
      return sendSuccess(res, {
        message: 'Kiểm tra tồn kho thất bại',
        data: { inventoryIssues: data.inventoryIssues, orderId: data.orderId },
      });
    }

    console.log("[PAYMENT SUCCESS]", JSON.stringify(data, null, 2));
    sendSuccess(res, { message: 'Thanh toán Order Queue thành công', data });
  } catch (error) {
    console.error("[PAYMENT ERROR]", {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode || error.code,
      stack: error.stack,
      meta: error.meta,
    });
    throw error;
  }
});

export const cancelOrderQueue = asyncHandler(async (req, res) => {
  const ctx = req.user;
  const data = await orderService.cancelQueueOrder(req.params.id, ctx);
  sendSuccess(res, { message: 'Hủy Order Queue thành công', data });
});
