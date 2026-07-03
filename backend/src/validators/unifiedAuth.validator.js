import { body, param } from 'express-validator';

export const registerRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('fullName').trim().notEmpty().withMessage('Vui lòng nhập họ tên'),
];

export const loginRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu'),
];

export const updateMeRules = [
  body('fullName').optional().trim().notEmpty().withMessage('Họ tên không được để trống'),
  body('email').optional().isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
];

export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Vui lòng nhập mật khẩu hiện tại'),
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),
];

export const forgotPasswordRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
];

export const resetPasswordRules = [
  body('token').notEmpty().withMessage('Thiếu token'),
  body('password')
    .isLength({ min: 8 }).withMessage('Mật khẩu phải có ít nhất 8 ký tự')
    .matches(/[A-Z]/).withMessage('Mật khẩu phải có chữ hoa')
    .matches(/[a-z]/).withMessage('Mật khẩu phải có chữ thường')
    .matches(/[0-9]/).withMessage('Mật khẩu phải có số'),
];


