import { categoryService } from './category.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const listCategories = asyncHandler(async (req, res) => {
  const data = await categoryService.list(req.query);
  sendSuccess(res, { message: 'Lấy danh sách danh mục thành công', data });
});

export const getCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.getById(req.params.id);
  sendSuccess(res, { message: 'Lấy thông tin danh mục thành công', data });
});

export const getCategoryStats = asyncHandler(async (req, res) => {
  const data = await categoryService.getStats();
  sendSuccess(res, { message: 'Lấy thống kê danh mục thành công', data });
});

export const createCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.create(req.body);
  sendSuccess(res, { message: 'Tạo danh mục thành công', data, statusCode: 201 });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.update(req.params.id, req.body);
  sendSuccess(res, { message: 'Cập nhật danh mục thành công', data });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.delete(req.params.id);
  sendSuccess(res, { message: 'Xóa danh mục thành công', data: null });
});

export const restoreCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.restore(req.params.id);
  sendSuccess(res, { message: 'Khôi phục danh mục thành công', data });
});
