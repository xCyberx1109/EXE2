import { body, param } from 'express-validator';

export const openShiftRules = [
  body('openingBalance')
    .isFloat({ min: 0 })
    .withMessage('Opening balance must be a non-negative number'),
  body('note')
    .optional()
    .trim()
    .isString()
    .withMessage('Note must be a string'),
];

export const closeShiftRules = [
  body('closingBalance')
    .isFloat({ min: 0 })
    .withMessage('Closing balance must be a non-negative number'),
  body('actualBalance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Actual balance must be a non-negative number'),
  body('note')
    .optional()
    .trim()
    .isString()
    .withMessage('Note must be a string'),
];

export const shiftIdParam = [
  param('id').trim().notEmpty().withMessage('Shift ID is required'),
];

export const shiftReportRules = [
  param('deviceId').optional().trim().notEmpty(),
  param('accountId').optional().trim().notEmpty(),
];
