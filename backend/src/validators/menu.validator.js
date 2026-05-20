import { body, param, query } from 'express-validator';

export const categoryRules = [
  body('name').trim().notEmpty().withMessage('Tên danh mục là bắt buộc'),
  body('description').optional().trim(),
];

export const menuItemRules = [
  body('name').trim().notEmpty().withMessage('Tên món là bắt buộc'),
  body('categoryId').optional().isUUID().withMessage('categoryId không hợp lệ'),
  body('category').optional().trim(),
  body('price').isFloat({ min: 0 }).withMessage('Giá bán phải >= 0'),
  body('cost').isFloat({ min: 0 }).withMessage('Giá vốn phải >= 0'),
  body('description').optional().trim(),
  body('imageUrl').optional().isURL().withMessage('imageUrl phải là URL hợp lệ'),
  body('available').optional().isBoolean(),
];

export const menuItemIdParam = [param('id').isUUID().withMessage('ID món không hợp lệ')];

export const menuSearchQuery = [
  query('search').optional().trim(),
  query('category').optional().trim(),
  query('categoryId').optional().isUUID(),
  query('available').optional().isIn(['true', 'false']),
];
