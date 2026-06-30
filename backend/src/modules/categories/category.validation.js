import { body, param, query } from 'express-validator';

export const categoryRules = [
  body('name').trim().notEmpty().withMessage('Tên danh mục là bắt buộc'),
  body('slug').optional().trim(),
  body('description').optional().trim(),
  body('active').optional().isBoolean().withMessage('Trạng thái không hợp lệ'),
];

export const categoryUpdateRules = [
  body('name').optional().trim().notEmpty().withMessage('Tên danh mục không được để trống'),
  body('slug').optional().trim(),
  body('description').optional().trim(),
  body('active').optional().isBoolean().withMessage('Trạng thái không hợp lệ'),
];

export const categoryIdParam = [
  param('id').trim().notEmpty().withMessage('ID danh mục là bắt buộc'),
];

export const categoryQueryParams = [
  query('page').optional().isInt({ min: 1 }).withMessage('Số trang phải >= 1'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Số lượng phải từ 1-1000'),
  query('search').optional().trim(),
  query('sort').optional().isIn(['createdAt', 'name']).withMessage('Sắp xếp không hợp lệ'),
  query('active').optional().isBoolean().withMessage('Trạng thái không hợp lệ'),
  query('includeDeleted').optional().isBoolean().withMessage('includeDeleted không hợp lệ'),
  query('deleted').optional().isBoolean().withMessage('deleted không hợp lệ'),
];
