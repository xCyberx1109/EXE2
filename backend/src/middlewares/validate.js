import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';

/** Chạy sau express-validator rules */
export const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== VALIDATION ERROR ===');
    console.log('URL:', req.method, req.originalUrl);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Errors:', JSON.stringify(errors.array(), null, 2));
    return next(
      new AppError('Dữ liệu không hợp lệ', 400, errors.array())
    );
  }
  next();
};
