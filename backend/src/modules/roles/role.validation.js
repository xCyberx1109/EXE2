import { body, param } from 'express-validator';

export const roleRules = [
  body('name').trim().notEmpty().withMessage('Tên vai trò là bắt buộc'),
  body('description').optional().trim(),
];

export const roleUpdateRules = [
  body('name').optional().trim().notEmpty().withMessage('Tên vai trò không được để trống'),
  body('description').optional().trim(),
];

export const roleIdParam = [
  param('id').trim().notEmpty().withMessage('ID vai trò là bắt buộc'),
];

export const rolePermissionsRules = [
  body('permissionIds').isArray().withMessage('permissionIds phải là mảng'),
  body('permissionIds.*').isString().withMessage('permissionIds phải là mảng chuỗi'),
];
