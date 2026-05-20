import { body, param, query } from 'express-validator';

export const createOrderRules = [
  body('table').notEmpty().withMessage('Số bàn là bắt buộc'),
  body('items').isArray({ min: 1 }).withMessage('Đơn hàng phải có ít nhất 1 món'),
  body('items.*.name').optional().trim(),
  body('items.*.quantity').optional().isInt({ min: 1 }),
  body('time').optional().isISO8601(),
];

export const orderIdParam = [param('id').isUUID().withMessage('ID đơn không hợp lệ')];

export const ordersByDateQuery = [
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date phải có dạng YYYY-MM-DD'),
  query('status').optional().isIn(['all', 'PENDING', 'PREPARING', 'COMPLETED', 'CANCELLED', 'pending', 'preparing', 'completed', 'cancelled']),
];
