import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';

/** Global error handler */
export const errorHandler = (err, req, res, _next) => {
  if (err.name === 'ValidationError' || err.type === 'validation') {
    return sendError(res, {
      message: err.message || 'Dữ liệu không hợp lệ',
      error: err.errors || err.array?.() || null,
      statusCode: 400,
    });
  }

  if (err instanceof AppError) {
    return sendError(res, {
      message: err.message,
      error: err.errors,
      statusCode: err.statusCode,
    });
  }

  if (err.code === 'P2002') {
    return sendError(res, {
      message: 'Dữ liệu đã tồn tại trong hệ thống',
      error: err.meta,
      statusCode: 409,
    });
  }

  if (err.code === 'P2025') {
    return sendError(res, {
      message: 'Không tìm thấy dữ liệu',
      statusCode: 404,
    });
  }

  console.error('[Error]', err);

  return sendError(res, {
    message: process.env.NODE_ENV === 'production' ? 'Lỗi máy chủ' : err.message,
    error: process.env.NODE_ENV === 'development' ? { stack: err.stack } : null,
    statusCode: 500,
  });
};

export const notFoundHandler = (req, res) => {
  return sendError(res, {
    message: `Không tìm thấy route: ${req.method} ${req.originalUrl}`,
    statusCode: 404,
  });
};
