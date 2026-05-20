import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Xác thực JWT */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Vui lòng đăng nhập', 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, config.jwt.secret);

  const user = await prisma.account.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, fullName: true, role: true, createdAt: true },
  });

  if (!user) {
    throw new AppError('Tài khoản không tồn tại', 401);
  }

  req.user = user;
  next();
});

/** Phân quyền theo role */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập', 401));
  }
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Bạn không có quyền thực hiện thao tác này', 403));
  }
  next();
};

/** Optional auth - gắn user nếu có token */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await prisma.account.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, fullName: true, role: true },
    });
    if (user) req.user = user;
  } catch {
    // bỏ qua token không hợp lệ
  }
  next();
});
