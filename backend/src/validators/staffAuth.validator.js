import { body } from 'express-validator';

export const staffLoginPinRules = [
  body('pinCode')
    .trim()
    .notEmpty()
    .isLength({ min: 4, max: 6 })
    .withMessage('PIN must be 4-6 digits'),
];

export const staffLogoutRules = [
  body('accountId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Account ID must not be empty'),
];

export const staffSwitchRules = [
  body('pinCode')
    .trim()
    .notEmpty()
    .isLength({ min: 4, max: 6 })
    .withMessage('PIN must be 4-6 digits'),
];
