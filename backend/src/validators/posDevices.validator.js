import { body, param } from 'express-validator';

export const createPosDeviceRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Device name is required'),
  body('type')
    .trim()
    .notEmpty()
    .isIn(['CASHIER', 'KITCHEN', 'TABLET', 'KIOSK'])
    .withMessage('Invalid device type (CASHIER, KITCHEN, TABLET, KIOSK)'),
  body('mode')
    .optional()
    .trim()
    .isIn(['CASHIER', 'KITCHEN', 'HYBRID'])
    .withMessage('Invalid mode (CASHIER, KITCHEN, HYBRID)'),
];

export const resetDeviceRules = [
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('Device ID is required'),
];

export const revokeDeviceRules = [
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('Device ID is required'),
  body('reason')
    .optional()
    .trim()
    .isString()
    .withMessage('Reason must be a string'),
];

export const regenerateSetupPinRules = [
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('Device ID is required'),
];

export const deviceIdParam = [
  param('id').trim().notEmpty().withMessage('Device ID is required'),
];

export const toggleDeviceRules = [
  body('active')
    .isBoolean()
    .withMessage('Active must be a boolean'),
];

export const updateModeRules = [
  body('mode')
    .trim()
    .notEmpty()
    .isIn(['CASHIER', 'KITCHEN', 'HYBRID'])
    .withMessage('Invalid mode (CASHIER, KITCHEN, HYBRID)'),
];
