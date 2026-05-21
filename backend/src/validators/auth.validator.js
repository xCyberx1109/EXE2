import { body } from 'express-validator';

export const registerRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
  body('fullName').trim().notEmpty().withMessage('Họ tên là bắt buộc'),
  body('role').optional().isIn(['ADMIN', 'STAFF', 'admin', 'staff']),
];

export const loginRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').notEmpty().withMessage('Mật khẩu là bắt buộc'),
];

export const updateMeRules = [
  body('fullName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Họ tên không được để trống'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
];

export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Mật khẩu hiện tại là bắt buộc'),
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới tối thiểu 6 ký tự'),
];
