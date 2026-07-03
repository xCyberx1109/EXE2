import { body, param } from 'express-validator';

export const idParam = [param('id').trim().notEmpty().withMessage('ID là bắt buộc')];

export const tableIdParam = [param('tableId').trim().notEmpty().withMessage('ID bàn là bắt buộc')];

export const updateLayoutRules = [
  body('tables').isArray({ min: 1 }).withMessage('Danh sách bàn là bắt buộc'),
  body('tables.*.id').trim().notEmpty().withMessage('ID bàn là bắt buộc'),
  body('tables.*.posX').isFloat().withMessage('posX phải là số'),
  body('tables.*.posY').isFloat().withMessage('posY phải là số'),
  body('tables.*.width').optional().isFloat({ min: 1 }).withMessage('width phải là số > 0'),
  body('tables.*.height').optional().isFloat({ min: 1 }).withMessage('height phải là số > 0'),
];

export const playNowRules = [
  body('durationMinutes').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Thời gian chơi phải lớn hơn 0'),
  body('customerName').optional().trim(),
  body('phone').optional().trim(),
];

export const reserveRules = [
  body('customerName').trim().notEmpty().withMessage('Tên khách hàng là bắt buộc'),
  body('phone').optional().trim(),
  body('reservationDate').isISO8601().withMessage('Ngày đặt không hợp lệ'),
  body('note').optional().trim(),
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
  body('tableType').optional().isIn(['BILLIARD', 'POOL', 'SNOOKER', 'VIP']).withMessage('Loại bàn không hợp lệ'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Sức chứa phải lớn hơn 0'),
  body('posX').optional().isFloat().withMessage('posX phải là số'),
  body('posY').optional().isFloat().withMessage('posY phải là số'),
  body('width').optional().isFloat({ min: 1 }).withMessage('width phải là số > 0'),
  body('height').optional().isFloat({ min: 1 }).withMessage('height phải là số > 0'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Phí theo giờ phải là số >= 0'),
];

// ==================== RESTAURANT VALIDATION ====================

export const createOrderRules = [
  body('guestCount').optional().isInt({ min: 1 }).withMessage('Số khách phải lớn hơn 0'),
  body('note').optional().trim(),
];

export const payOrderRules = [
  body('paymentMethod').optional().trim().isIn(['CASH', 'CARD', 'BANKING', 'E_WALLET', 'QR']).withMessage('Phương thức thanh toán không hợp lệ'),
];

export const transferRules = [
  body('targetTableId').trim().notEmpty().withMessage('ID bàn đích là bắt buộc'),
];

export const mergeRules = [
  body('targetTableId').trim().notEmpty().withMessage('ID bàn chính là bắt buộc'),
];

export const splitRules = [
  body('targetTableId').trim().notEmpty().withMessage('ID bàn đích là bắt buộc'),
  body('items').isArray({ min: 1 }).withMessage('Danh sách món cần tách là bắt buộc'),
  body('items.*.itemId').trim().notEmpty().withMessage('ID món cần tách là bắt buộc'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Số lượng phải lớn hơn 0'),
];

export const createRestaurantTableRules = [
  body('tableCode').trim().notEmpty().withMessage('Mã bàn là bắt buộc'),
  body('tableName').optional().trim(),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Sức chứa phải lớn hơn 0'),
  body('posX').optional().isFloat().withMessage('posX phải là số'),
  body('posY').optional().isFloat().withMessage('posY phải là số'),
  body('width').optional().isFloat({ min: 1 }).withMessage('width phải là số > 0'),
  body('height').optional().isFloat({ min: 1 }).withMessage('height phải là số > 0'),
];

export const updateRestaurantTableRules = [
  body('tableCode').optional().trim().notEmpty().withMessage('Mã bàn không được để trống'),
  body('tableName').optional().trim(),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Sức chứa phải lớn hơn 0'),
  body('posX').optional().isFloat().withMessage('posX phải là số'),
  body('posY').optional().isFloat().withMessage('posY phải là số'),
  body('width').optional().isFloat({ min: 1 }).withMessage('width phải là số > 0'),
  body('height').optional().isFloat({ min: 1 }).withMessage('height phải là số > 0'),
];
