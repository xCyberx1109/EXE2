import { categoryService } from './category.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

function getContext(req) {
  return req.user || req.posDevice || null;
}

export const listCategories = asyncHandler(async (req, res) => {
  const data = await categoryService.list(getContext(req), req.query.accountId);
  sendSuccess(res, { message: 'Lấy danh sách danh mục thành công', data });
});

export const getCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.getById(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Lấy thông tin danh mục thành công', data });
});

export const createCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.create(req.body, getContext(req));
  sendSuccess(res, { message: 'Tạo danh mục thành công', data, statusCode: 201 });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.update(req.params.id, req.body, getContext(req));
  sendSuccess(res, { message: 'Cập nhật danh mục thành công', data });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.delete(req.params.id, getContext(req));
  sendSuccess(res, { message: 'Xóa danh mục thành công', data: null });
});
