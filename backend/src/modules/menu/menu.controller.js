import { menuService } from './menu.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { requestLogger } from '../../utils/logger.js';

// Helper: lấy unified context từ user auth hoặc device auth
function getContext(req) {
  return req.user || req.posDevice || null;
}

// Categories
export const listCategories = asyncHandler(async (req, res) => {
  const data = await menuService.listCategories(getContext(req), req.query.accountId);
  sendSuccess(res, { message: 'Lấy danh sách danh mục thành công', data });
});

export const createCategory = asyncHandler(async (req, res) => {
  const data = await menuService.createCategory(req.body, getContext(req));
  sendSuccess(res, { message: 'Tạo danh mục thành công', data, statusCode: 201 });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const data = await menuService.updateCategory(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Cập nhật danh mục thành công', data });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await menuService.deleteCategory(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Xóa danh mục thành công', data: null });
});

// Menu items
export const listMenuItems = asyncHandler(async (req, res) => {
  const data = await menuService.listMenuItems(req.query, getContext(req));
  sendSuccess(res, { message: 'Lấy danh sách món thành công', data });
});

export const getMenuItem = asyncHandler(async (req, res) => {
  const data = await menuService.getMenuItem(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Lấy món thành công', data });
});

export const createMenuItem = asyncHandler(async (req, res) => {
  requestLogger.log(req.requestId, 'createMenuItem body:', JSON.stringify(req.body, null, 2));
  const data = await menuService.createMenuItem(req.body, getContext(req));
  requestLogger.log(req.requestId, 'createMenuItem success:', data?.id);
  sendSuccess(res, { message: 'Thêm món thành công', data, statusCode: 201 });
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  requestLogger.log(req.requestId, 'updateMenuItem body:', JSON.stringify(req.body, null, 2));
  const data = await menuService.updateMenuItem(req.params.id, req.body, getContext(req));
  requestLogger.log(req.requestId, 'updateMenuItem success:', data?.id);
  sendSuccess(res, { message: 'Cập nhật món thành công', data });
});

export const toggleAvailability = asyncHandler(async (req, res) => {
  const data = await menuService.toggleAvailability(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', data });
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
  await menuService.deleteMenuItem(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Xóa món thành công', data: null });
});

export const getTopSelling = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const data = await menuService.getTopSelling(limit, getContext(req));
  sendSuccess(res, { message: 'Lấy top món bán chạy thành công', data });
});
