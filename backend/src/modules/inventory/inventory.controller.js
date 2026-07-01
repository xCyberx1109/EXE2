import { inventoryService } from './inventory.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

function getContext(req) {
  return req.user || req.posDevice || null;
}

export const listIngredients = asyncHandler(async (req, res) => {
  const { search, lowStock, status, page, limit } = req.query;
  const data = await inventoryService.listIngredients({ search, lowStock, status, page, limit }, getContext(req));
  sendSuccess(res, { message: 'Lấy danh sách nguyên liệu thành công', data });
});

export const getStats = asyncHandler(async (req, res) => {
  const data = await inventoryService.getStats(getContext(req));
  sendSuccess(res, { message: 'Lấy thống kê kho thành công', data });
});

export const getLowStock = asyncHandler(async (req, res) => {
  const data = await inventoryService.getLowStock(getContext(req));
  sendSuccess(res, { message: 'Lấy hàng sắp hết thành công', data });
});

export const getIngredient = asyncHandler(async (req, res) => {
  const data = await inventoryService.getIngredient(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Lấy nguyên liệu thành công', data });
});

export const createIngredient = asyncHandler(async (req, res) => {
  const data = await inventoryService.createIngredient(req.body, getContext(req));
  sendSuccess(res, { message: 'Thêm nguyên liệu thành công', data, statusCode: 201 });
});

export const updateIngredient = asyncHandler(async (req, res) => {
  const data = await inventoryService.updateIngredient(req.params.id, req.body, getContext(req));
  const message = data?.pending
    ? 'Đã lưu thông tin, riêng thay đổi số lượng đang chờ quản lý phê duyệt (vượt ngưỡng giá trị)'
    : 'Cập nhật nguyên liệu thành công';
  sendSuccess(res, { message, data });
});

export const deleteIngredient = asyncHandler(async (req, res) => {
  const result = await inventoryService.deleteIngredient(req.params.id, getContext(req));
  sendSuccess(res, { message: result.message, data: result.report });
});

export const stockIn = asyncHandler(async (req, res) => {
  const data = await inventoryService.stockIn(req.params.id, req.body, getContext(req));
  const message = data?.pending
    ? 'Đã gửi yêu cầu nhập kho, đang chờ quản lý phê duyệt (vượt ngưỡng giá trị)'
    : 'Nhập kho thành công';
  sendSuccess(res, { message, data });
});

export const stockOut = asyncHandler(async (req, res) => {
  const data = await inventoryService.stockOut(req.params.id, req.body, getContext(req));
  const message = data?.pending
    ? 'Đã gửi yêu cầu xuất kho, đang chờ quản lý phê duyệt (vượt ngưỡng giá trị)'
    : 'Xuất kho thành công';
  sendSuccess(res, { message, data });
});

export const getIngredientTransactions = asyncHandler(async (req, res) => {
  const data = await inventoryService.getTransactionHistory(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Lấy lịch sử kho thành công', data });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const data = await inventoryService.listAllTransactions(getContext(req));
  sendSuccess(res, { message: 'Lấy lịch sử giao dịch thành công', data });
});

export const getThreshold = asyncHandler(async (req, res) => {
  const data = await inventoryService.getThresholdSetting(getContext(req));
  sendSuccess(res, { message: 'Lấy ngưỡng phê duyệt thành công', data });
});

export const updateThreshold = asyncHandler(async (req, res) => {
  const data = await inventoryService.updateThresholdSetting(req.body.threshold, getContext(req));
  sendSuccess(res, { message: 'Cập nhật ngưỡng phê duyệt thành công', data });
});

export const listAdjustmentRequests = asyncHandler(async (req, res) => {
  const data = await inventoryService.listAdjustmentRequests({ status: req.query.status }, getContext(req));
  sendSuccess(res, { message: 'Lấy danh sách yêu cầu chờ duyệt thành công', data });
});

export const approveAdjustmentRequest = asyncHandler(async (req, res) => {
  const data = await inventoryService.approveAdjustmentRequest(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Đã duyệt yêu cầu điều chỉnh tồn kho', data });
});

export const rejectAdjustmentRequest = asyncHandler(async (req, res) => {
  const data = await inventoryService.rejectAdjustmentRequest(req.params.id, req.body.reason, getContext(req));
  sendSuccess(res, { message: 'Đã từ chối yêu cầu điều chỉnh tồn kho', data });
});

export const listIngredientBatches = asyncHandler(async (req, res) => {
  const data = await inventoryService.listBatchesForIngredient(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Lấy danh sách lô hàng thành công', data });
});

export const listExpiringBatches = asyncHandler(async (req, res) => {
  const data = await inventoryService.listExpiringBatches(req.query.days, getContext(req));
  sendSuccess(res, { message: 'Lấy danh sách lô sắp hết hạn thành công', data });
});
