import { body, param, query } from 'express-validator';

export const ingredientRules = [
  body('name').trim().notEmpty().withMessage('Tên nguyên liệu là bắt buộc'),
  body('unit').trim().notEmpty().withMessage('Đơn vị là bắt buộc'),
  body('quantity').optional().isFloat({ min: 0 }),
  body('minQuantity').isFloat({ min: 0 }).withMessage('Mức tối thiểu phải >= 0'),
  body('price').isFloat({ min: 0 }).withMessage('Đơn giá phải >= 0'),
  body('supplier').trim().notEmpty().withMessage('Nhà cung cấp là bắt buộc'),
];

export const stockTransactionRules = [
  body('quantity').isFloat({ gt: 0 }).withMessage('Số lượng phải > 0'),
  body('note').optional().trim(),
];

export const ingredientIdParam = [param('id').isUUID().withMessage('ID nguyên liệu không hợp lệ')];

export const inventoryListQuery = [
  query('search').optional().trim(),
  query('lowStock').optional().isIn(['true', 'false']),
];
