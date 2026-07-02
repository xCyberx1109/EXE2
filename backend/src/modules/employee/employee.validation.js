import { body, param, query } from 'express-validator';

export const createEmployeeRules = [
  body('employeeCode')
    .trim()
    .notEmpty()
    .withMessage('Mã nhân viên là bắt buộc'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Họ tên là bắt buộc'),
  body('pinCode')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Mã PIN phải có 6 chữ số'),
  body('phone')
    .optional()
    .trim(),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email không hợp lệ'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
    .withMessage('Trạng thái không hợp lệ'),
  body('roleId')
    .optional({ values: 'falsy' })
    .isString(),
  body('assignedMachineIds')
    .optional()
    .isArray()
    .withMessage('Danh sách máy POS không hợp lệ'),
  body('assignedMachineIds.*')
    .optional()
    .isString()
    .notEmpty(),
];

export const updateEmployeeRules = [
  body('employeeCode')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Mã nhân viên không được để trống'),
  body('fullName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Họ tên không được để trống'),
  body('pinCode')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Mã PIN phải có 6 chữ số'),
  body('phone')
    .optional()
    .trim(),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email không hợp lệ'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
    .withMessage('Trạng thái không hợp lệ'),
  body('roleId')
    .optional({ values: 'falsy' })
    .isString(),
  body('assignedMachineIds')
    .optional()
    .isArray()
    .withMessage('Danh sách máy POS không hợp lệ'),
  body('assignedMachineIds.*')
    .optional()
    .isString()
    .notEmpty(),
];

export const employeeIdParam = [
  param('id').trim().notEmpty().withMessage('ID nhân viên là bắt buộc'),
];

export const employeeQueryParams = [
  query('search').optional().trim(),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']).withMessage('Trạng thái không hợp lệ'),
];
