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
];

export const posLoginRules = [
  body('deviceCode')
    .trim()
    .notEmpty()
    .withMessage('Mã thiết bị là bắt buộc'),
  body('pin')
    .trim()
    .notEmpty()
    .isLength({ min: 6, max: 6 })
    .withMessage('PIN phải gồm 6 chữ số'),
];

export const posDeviceIdParam = [
  param('id').isUUID().withMessage('ID thiết bị không hợp lệ'),
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
