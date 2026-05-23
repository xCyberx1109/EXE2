import { body, param } from 'express-validator';

export const createPosDeviceRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Tên thiết bị là bắt buộc'),
  body('type')
    .trim()
    .notEmpty()
    .isIn(['CASHIER', 'TABLET', 'KIOSK'])
    .withMessage('Loại thiết bị không hợp lệ (CASHIER, TABLET, KIOSK)'),
  body('mode')
    .optional()
    .trim()
    .isIn(['CASHIER', 'KITCHEN', 'HYBRID'])
    .withMessage('Chế độ không hợp lệ (CASHIER, KITCHEN, HYBRID)'),
];

export const posLoginRules = [
  body('pin')
    .trim()
    .notEmpty()
    .isLength({ min: 6, max: 6 })
    .withMessage('PIN phải gồm 6 chữ số'),
];

export const posDeviceIdParam = [
  param('id').trim().notEmpty().withMessage('ID thiết bị là bắt buộc'),
];

export const resetPinRules = [
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('ID thiết bị là bắt buộc'),
];

export const toggleDeviceRules = [
  body('active')
    .isBoolean()
    .withMessage('Trạng thái không hợp lệ'),
];

export const updateModeRules = [
  body('mode')
    .trim()
    .notEmpty()
    .isIn(['CASHIER', 'KITCHEN', 'HYBRID'])
    .withMessage('Chế độ không hợp lệ (CASHIER, KITCHEN, HYBRID)'),
];
