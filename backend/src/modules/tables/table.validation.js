import { body, param } from 'express-validator';

export const tableRules = [
  body('tableCode').trim().notEmpty().withMessage('Mã bàn là bắt buộc'),
  body('tableName').optional().trim(),
  body('capacity').exists().bail().isInt({ min: 1 }).withMessage('Sức chứa phải lớn hơn 0'),
  body('status').optional().isIn(['AVAILABLE', 'OCCUPIED', 'DISABLED']).withMessage('Trạng thái không hợp lệ'),
];

export const tableUpdateRules = [
  body('tableCode').optional().trim().notEmpty().withMessage('Mã bàn không được để trống'),
  body('tableName').optional().trim(),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Sức chứa phải lớn hơn 0'),
  body('status').optional().isIn(['AVAILABLE', 'OCCUPIED', 'DISABLED']).withMessage('Trạng thái không hợp lệ'),
];

export const tableIdParam = [param('id').trim().notEmpty()];
