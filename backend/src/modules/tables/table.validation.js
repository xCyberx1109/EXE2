import { body, param } from 'express-validator';

const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'CHECKING_OUT', 'DISABLED'];

const TABLE_TYPES = ['POOL', 'SNOOKER', 'VIP'];

export const tableRules = [
  body('tableCode').trim().notEmpty().withMessage('Mã bàn là bắt buộc'),
  body('tableName').optional().trim(),
  body('capacity').exists().bail().isInt({ min: 1 }).withMessage('Sức chứa phải lớn hơn 0'),
  body('tableType').optional().isIn(TABLE_TYPES).withMessage('Loại bàn không hợp lệ'),
  body('posX').optional().isFloat().withMessage('posX phải là số'),
  body('posY').optional().isFloat().withMessage('posY phải là số'),
  body('status').optional().isIn(TABLE_STATUSES).withMessage('Trạng thái không hợp lệ'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Phí theo giờ phải là số >= 0'),
];

export const tableUpdateRules = [
  body('tableCode').optional().trim().notEmpty().withMessage('Mã bàn không được để trống'),
  body('tableName').optional().trim(),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Sức chứa phải lớn hơn 0'),
  body('tableType').optional().isIn(TABLE_TYPES).withMessage('Loại bàn không hợp lệ'),
  body('posX').optional().isFloat().withMessage('posX phải là số'),
  body('posY').optional().isFloat().withMessage('posY phải là số'),
  body('status').optional().isIn(TABLE_STATUSES).withMessage('Trạng thái không hợp lệ'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Phí theo giờ phải là số >= 0'),
];

export const tableIdParam = [param('id').trim().notEmpty()];

export const tablePosStatusRules = [
  body('status').isIn(TABLE_STATUSES).withMessage('Trạng thái không hợp lệ'),
];

export const tableLayoutRules = [
  body('tables').isArray({ min: 1 }).withMessage('Danh sách bàn là bắt buộc'),
  body('tables.*.id').trim().notEmpty().withMessage('ID bàn là bắt buộc'),
  body('tables.*.posX').isFloat().withMessage('posX phải là số'),
  body('tables.*.posY').isFloat().withMessage('posY phải là số'),
];
