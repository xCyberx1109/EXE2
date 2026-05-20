import { inventoryService } from './inventory.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const listIngredients = asyncHandler(async (req, res) => {
  const data = await inventoryService.listIngredients(req.query);
  sendSuccess(res, { message: 'Lấy danh sách nguyên liệu thành công', data });
});

export const getStats = asyncHandler(async (_req, res) => {
  const data = await inventoryService.getStats();
  sendSuccess(res, { message: 'Lấy thống kê kho thành công', data });
});

export const getLowStock = asyncHandler(async (_req, res) => {
  const data = await inventoryService.getLowStock();
  sendSuccess(res, { message: 'Lấy hàng sắp hết thành công', data });
});

export const getIngredient = asyncHandler(async (req, res) => {
  const data = await inventoryService.getIngredient(req.params.id);
  sendSuccess(res, { message: 'Lấy nguyên liệu thành công', data });
});

export const createIngredient = asyncHandler(async (req, res) => {
  const data = await inventoryService.createIngredient(req.body);
  sendSuccess(res, { message: 'Thêm nguyên liệu thành công', data, statusCode: 201 });
});

export const updateIngredient = asyncHandler(async (req, res) => {
  const data = await inventoryService.updateIngredient(req.params.id, req.body);
  sendSuccess(res, { message: 'Cập nhật nguyên liệu thành công', data });
});

export const deleteIngredient = asyncHandler(async (req, res) => {
  await inventoryService.deleteIngredient(req.params.id);
  sendSuccess(res, { message: 'Xóa nguyên liệu thành công', data: null });
});

export const stockIn = asyncHandler(async (req, res) => {
  const data = await inventoryService.stockIn(req.params.id, req.body, req.user?.id);
  sendSuccess(res, { message: 'Nhập kho thành công', data });
});

export const stockOut = asyncHandler(async (req, res) => {
  const data = await inventoryService.stockOut(req.params.id, req.body, req.user?.id);
  sendSuccess(res, { message: 'Xuất kho thành công', data });
});

export const getIngredientTransactions = asyncHandler(async (req, res) => {
  const data = await inventoryService.getTransactionHistory(req.params.id);
  sendSuccess(res, { message: 'Lấy lịch sử kho thành công', data });
});

export const listTransactions = asyncHandler(async (_req, res) => {
  const data = await inventoryService.listAllTransactions();
  sendSuccess(res, { message: 'Lấy lịch sử giao dịch thành công', data });
});
