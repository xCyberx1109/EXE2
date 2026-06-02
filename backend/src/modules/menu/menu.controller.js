import { validationResult } from 'express-validator';
import { menuService } from './menu.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

// Categories
export const listCategories = asyncHandler(async (req, res) => {
  const data = await menuService.listCategories(req.user);
  sendSuccess(res, { message: 'Lấy danh sách danh mục thành công', data });
});

export const createCategory = asyncHandler(async (req, res) => {
  const data = await menuService.createCategory(req.body, req.user);
  sendSuccess(res, { message: 'Tạo danh mục thành công', data, statusCode: 201 });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const data = await menuService.updateCategory(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Cập nhật danh mục thành công', data });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await menuService.deleteCategory(req.params.id, req.user);
  sendSuccess(res, { message: 'Xóa danh mục thành công', data: null });
});

// Menu items
export const listMenuItems = asyncHandler(async (req, res) => {
  const data = await menuService.listMenuItems(req.query, req.user);
  sendSuccess(res, { message: 'Lấy danh sách món thành công', data });
});

export const getMenuItem = asyncHandler(async (req, res) => {
  const data = await menuService.getMenuItem(req.params.id, req.user);
  sendSuccess(res, { message: 'Lấy món thành công', data });
});

export const createMenuItem = asyncHandler(async (req, res) => {
  console.log('=== CREATE MENU ITEM CONTROLLER ===');
  console.log('URL:', req.method, req.originalUrl);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('User:', JSON.stringify(req.user, null, 2));
  console.log('Headers content-type:', req.headers['content-type']);

  // Log express-validator result (sau validate middleware)
  const vr = validationResult(req);
  if (!vr.isEmpty()) {
    console.log('!!! VALIDATION ERRORS FOUND IN CONTROLLER !!!');
    console.log(JSON.stringify(vr.array(), null, 2));
  } else {
    console.log('Express-validator: PASSED (no errors)');
  }

  try {
    const data = await menuService.createMenuItem(req.body, req.user);
    console.log('Create success - menuItemId:', data.id);
    sendSuccess(res, { message: 'Thêm món thành công', data, statusCode: 201 });
  } catch (error) {
    console.error('=== CONTROLLER CATCH ===');
    console.error('Error name:', error.constructor?.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error statusCode:', error.statusCode);
    console.error('Error errors:', error.errors);
    console.error('Error code:', error.code);
    console.error('Error meta:', error.meta);

    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi không xác định',
      details: error.errors || error,
      stack: error.stack,
    });
  }
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const data = await menuService.updateMenuItem(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Cập nhật món thành công', data });
});

export const toggleAvailability = asyncHandler(async (req, res) => {
  const data = await menuService.toggleAvailability(req.params.id, req.user);
  sendSuccess(res, { message: 'Cập nhật trạng thái thành công', data });
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
  await menuService.deleteMenuItem(req.params.id, req.user);
  sendSuccess(res, { message: 'Xóa món thành công', data: null });
});

export const getTopSelling = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const data = await menuService.getTopSelling(limit, req.user);
  sendSuccess(res, { message: 'Lấy top món bán chạy thành công', data });
});
