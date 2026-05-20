import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';

/** Chạy sau express-validator rules */
export const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new AppError('Dữ liệu không hợp lệ', 400, errors.array())
    );
  }
  next();
};
