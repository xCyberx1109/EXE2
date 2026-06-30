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
  sendSuccess(res, { message: 'Cập nhật nguyên liệu thành công', data });
});

export const deleteIngredient = asyncHandler(async (req, res) => {
  const result = await inventoryService.deleteIngredient(req.params.id, getContext(req));
  sendSuccess(res, { message: result.message, data: result.report });
});

export const stockIn = asyncHandler(async (req, res) => {
  const data = await inventoryService.stockIn(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Nhập kho thành công', data });
});

export const stockOut = asyncHandler(async (req, res) => {
  const data = await inventoryService.stockOut(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Xuất kho thành công', data });
});

export const getIngredientTransactions = asyncHandler(async (req, res) => {
  const data = await inventoryService.getTransactionHistory(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Lấy lịch sử kho thành công', data });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const data = await inventoryService.listAllTransactions(getContext(req));
  sendSuccess(res, { message: 'Lấy lịch sử giao dịch thành công', data });
});
