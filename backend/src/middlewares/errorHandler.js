import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';

/** Global error handler */
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    const details = err.errors ? (Array.isArray(err.errors) ? err.errors.map(e => `[${e.path || e.param || 'field'}]: ${e.msg || e.message}`).join('; ') : JSON.stringify(err.errors)) : null;
    console.error(`[AppError ${err.statusCode}] ${err.message}`, details);
    if (err.statusCode === 400) console.error(err.stack);
    return sendError(res, {
      message: details ? `${err.message}: ${details}` : err.message,
      error: err.errors || { stack: err.stack, message: err.message },
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

  if (err.code === 'P2003') {
    return sendError(res, {
      message: 'Không thể xóa vì dữ liệu đang được tham chiếu bởi các bản ghi khác',
      error: err.meta,
      statusCode: 409,
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[Prisma Validation Error]', err.message);
    console.error(err.stack);
    return sendError(res, {
      message: err.message,
      error: err.message,
      statusCode: 400,
    });
  }

  console.error('[Unhandled Error]', err);

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
