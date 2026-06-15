import { body, param, query } from 'express-validator';

export const idParam = [param('id').trim().notEmpty().withMessage('ID là bắt buộc')];

export const tableIdParam = [param('tableId').trim().notEmpty().withMessage('ID bàn là bắt buộc')];

export const updateLayoutRules = [
  body('tables').isArray({ min: 1 }).withMessage('Danh sách bàn là bắt buộc'),
  body('tables.*.id').trim().notEmpty().withMessage('ID bàn là bắt buộc'),
  body('tables.*.posX').isFloat().withMessage('posX phải là số'),
  body('tables.*.posY').isFloat().withMessage('posY phải là số'),
];

export const playNowRules = [
  body('durationMinutes').isInt({ min: 1 }).withMessage('Thời gian chơi phải lớn hơn 0'),
  body('customerName').optional().trim(),
  body('phone').optional().trim(),
];

export const reserveRules = [
  body('customerName').trim().notEmpty().withMessage('Tên khách hàng là bắt buộc'),
  body('phone').optional().trim(),
  body('reservationTime').isISO8601().withMessage('Thời gian đặt bàn không hợp lệ'),
  body('durationMinutes').optional().isInt({ min: 1 }).withMessage('Thời gian chơi phải lớn hơn 0'),
  body('note').optional().trim(),
];

export const extendSessionRules = [
  body('additionalMinutes').isInt({ min: 1 }).withMessage('Thời gian gia hạn phải lớn hơn 0'),
];

export const addOrderItemRules = [
  body('menuItemId').optional({ values: 'null' }).trim().notEmpty().withMessage('ID món ăn không được rỗng'),
  body('inventoryId').optional({ values: 'null' }).trim().notEmpty().withMessage('ID inventory không được rỗng'),
  body('quantity').isInt({ min: 1 }).withMessage('Số lượng phải lớn hơn 0'),
  body('note').optional().trim(),
  body().custom((value, { req }) => {
    if (!req.body.menuItemId && !req.body.inventoryId) {
      throw new Error('Phải cung cấp menuItemId hoặc inventoryId');
    }
    return true;
  }),
];

export const batchAddOrderItemsRules = [
  body('items').isArray({ min: 1 }).withMessage('Danh sách món là bắt buộc'),
  body('items.*.inventoryId').trim().notEmpty().withMessage('ID inventory không được rỗng'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Số lượng phải lớn hơn 0'),
];

export const updateOrderItemRules = [
  body('quantity').isInt({ min: 1 }).withMessage('Số lượng phải lớn hơn 0'),
  body('note').optional().trim(),
];

export const createTableRules = [
  body('tableCode').trim().notEmpty().withMessage('Mã bàn là bắt buộc'),
  body('tableName').optional().trim(),
  body('tableType').isIn(['POOL', 'SNOOKER', 'VIP']).withMessage('Loại bàn không hợp lệ'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Sức chứa phải lớn hơn 0'),
  body('posX').optional().isFloat().withMessage('posX phải là số'),
  body('posY').optional().isFloat().withMessage('posY phải là số'),
];
