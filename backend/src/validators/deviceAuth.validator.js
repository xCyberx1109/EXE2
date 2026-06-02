import { body } from 'express-validator';

export const deviceLoginRules = [
  body('deviceCode')
    .trim()
    .notEmpty()
    .withMessage('Device code is required'),
  body('setupPin')
    .trim()
    .notEmpty()
    .isLength({ min: 6, max: 6 })
    .withMessage('Setup PIN must be 6 digits'),
];

export const refreshTokenRules = [
  body('deviceCode')
    .trim()
    .notEmpty()
    .withMessage('Device code is required'),
];

export const deviceLogoutRules = [
  body('deviceCode')
    .trim()
    .notEmpty()
    .withMessage('Device code is required'),
];
