import { body, param } from 'express-validator';

export const categoryRules = [
  body('name').trim().notEmpty().withMessage('Tên danh mục là bắt buộc'),
  body('description').optional().trim(),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Thứ tự phải là số không âm'),
  body('active').optional().isBoolean().withMessage('Trạng thái không hợp lệ'),
];

export const categoryUpdateRules = [
  body('name').optional().trim().notEmpty().withMessage('Tên danh mục không được để trống'),
  body('description').optional().trim(),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Thứ tự phải là số không âm'),
  body('active').optional().isBoolean().withMessage('Trạng thái không hợp lệ'),
];

export const categoryIdParam = [param('id').trim().notEmpty().withMessage('ID danh mục là bắt buộc')];
