import { body, param, query } from 'express-validator';

export const ingredientRules = [
  body('name').trim().notEmpty().withMessage('Tên nguyên liệu là bắt buộc'),
  body('unit').trim().notEmpty().withMessage('Đơn vị là bắt buộc'),
  body('quantity').optional().isFloat({ min: 0 }),
  body('price').isFloat({ min: 0 }).withMessage('Đơn giá phải >= 0'),
  body('supplier').trim().notEmpty().withMessage('Nhà cung cấp là bắt buộc'),
  body('warningQuantity').optional().isFloat({ min: 0 }).withMessage('Ngưỡng cảnh báo phải >= 0'),
];

export const ingredientUpdateRules = [
  body('name').optional().trim().notEmpty(),
  body('unit').optional().trim().notEmpty(),
  body('quantity').optional().isFloat({ min: 0 }),
  body('price').optional().isFloat({ min: 0 }),
  body('supplier').optional().trim().notEmpty(),
  body('warningQuantity').optional().isFloat({ min: 0 }),
];

export const stockTransactionRules = [
  body('quantity').isFloat({ gt: 0 }).withMessage('Số lượng phải > 0'),
  body('note').optional().trim(),
];

export const ingredientIdParam = [param('id').isString().notEmpty().withMessage('ID nguyên liệu không hợp lệ')];

export const inventoryListQuery = [
  query('search').optional().trim(),
  query('lowStock').optional().isIn(['true', 'false']),
  query('status').optional().isIn(['LOW_STOCK', 'NORMAL']),
  query('includeInactive').optional().isIn(['true', 'false']),
];
