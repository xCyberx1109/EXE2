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
