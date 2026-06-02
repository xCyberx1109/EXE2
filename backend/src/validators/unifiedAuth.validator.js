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

export const deviceLoginRules = [
  body('setupPin').isLength({ min: 6, max: 6 }).withMessage('Mã PIN phải có 6 chữ số')
    .isNumeric().withMessage('Mã PIN chỉ gồm chữ số'),
  body('fingerprint').optional().trim().isLength({ min: 1, max: 256 }),
  body('deviceName').optional().trim().isLength({ min: 1, max: 100 }),
];

export const deviceRefreshRules = [
  body('refreshToken').notEmpty().withMessage('Vui lòng cung cấp refresh token'),
];

export const updateMeRules = [
  body('fullName').optional().trim().notEmpty().withMessage('Họ tên không được để trống'),
  body('email').optional().isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
];

export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Vui lòng nhập mật khẩu hiện tại'),
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),
];

export const sessionIdParam = [
  param('sessionId').isString().notEmpty().withMessage('Session ID không hợp lệ'),
];
