import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';

const JWT_ERROR_MAP = new Map([
  ['JsonWebTokenError', 'Token không hợp lệ'],
  ['TokenExpiredError', 'Phiên đăng nhập đã hết hạn'],
  ['NotBeforeError', 'Token chưa có hiệu lực'],
]);

/** Global error handler */
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    const details = err.errors ? (Array.isArray(err.errors) ? err.errors.map(e => `[${e.path || e.param || 'field'}]: ${e.msg || e.message}`).join('; ') : JSON.stringify(err.errors)) : null;
    console.error(`[AppError ${err.statusCode}] ${err.message}`, details);
    if (err.statusCode === 400) console.error(err.stack);

    const body = {
      message: details ? `${err.message}: ${details}` : err.message,
      error: err.errors || { stack: err.stack, message: err.message },
      statusCode: err.statusCode,
    };
    if (err.field) body.field = err.field;

    return sendError(res, body);
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
    const isDeleteRequest = req.method === 'DELETE';
    console.error('[Prisma Error P2003] Foreign key constraint failure:', {
      code: err.code,
      message: err.message,
      meta: err.meta,
      method: req.method,
      path: req.originalUrl,
    });
    return sendError(res, {
      message: isDeleteRequest
        ? 'Dữ liệu đang được tham chiếu bởi các bản ghi khác'
        : 'Dữ liệu tham chiếu không hợp lệ hoặc không tồn tại',
      error: err.meta,
      statusCode: isDeleteRequest ? 409 : 400,
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[Prisma Validation Error]', err.message);
    console.error(err.stack);
    // Extract the unknown argument name from Prisma's error message
    const unknownArgMatch = err.message.match(/Unknown argument `([^`]+)`/);
    const field = unknownArgMatch ? unknownArgMatch[1] : null;
    const suggestion = err.message.match(/Did you mean `([^`]+)`/);
    const hint = suggestion ? `Did you mean \`${suggestion[1]}\`?` : '';
    return sendError(res, {
      message: field ? `Invalid field \`${field}\` in update data. ${hint}`.trim() : err.message,
      error: err.message,
      field,
      statusCode: 400,
    });
  }

  if (JWT_ERROR_MAP.has(err.name)) {
    return sendError(res, {
      message: JWT_ERROR_MAP.get(err.name),
      statusCode: 401,
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
