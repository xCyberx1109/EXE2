import { body, param } from 'express-validator';

export const createPosDeviceRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Device name is required'),
  body('template')
    .trim()
    .notEmpty()
    .isIn(['CASHIER', 'KITCHEN', 'CASHIER_KITCHEN', 'BILLIARD', 'RESTAURANT', 'CUSTOM'])
    .withMessage('Invalid template (CASHIER, KITCHEN, CASHIER_KITCHEN, BILLIARD, RESTAURANT, CUSTOM)'),
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
