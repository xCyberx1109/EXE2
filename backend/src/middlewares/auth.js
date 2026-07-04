import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { permissionService } from '../modules/permissions/permission.service.js';

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

/** Xác thực JWT user hoặc Employee */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    console.error('[AUTH FAILED] Missing auth context', {
      url: req.originalUrl,
      user: req.user,
      authHeader: req.headers.authorization
    });
    throw new AppError('Vui lòng đăng nhập', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (jwtErr) {
    console.error('[AUTH FAILED] Invalid token', {
      url: req.originalUrl,
      user: req.user,
      authHeader: req.headers.authorization,
      error: jwtErr.message
    });
    throw new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401);
  }

  // Employee JWT
  if (decoded.type === 'employee') {
    const { employeeId, accountId, permissions } = decoded;
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, accountId, deletedAt: null, status: 'ACTIVE' },
    });

    if (!employee) {
      throw new AppError('Nhân viên không hợp lệ hoặc đã bị khóa', 401);
    }

    req.employee = employee;
    req.employee.permissions = permissions || [];
    req.accountId = accountId;
    req.permissions = permissions || [];
    req.authType = 'employee';
    return next();
  }

  // User JWT
  const userId = decoded.sub || decoded.userId;
  if (!userId) {
    throw new AppError('Token không hợp lệ', 401);
  }

  if (decoded.type && decoded.type !== 'user') {
    throw new AppError('Token không hợp lệ cho tài khoản quản trị', 401);
  }

  const user = await prisma.account.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true },
  });

  if (!user) {
    throw new AppError('Tài khoản không tồn tại', 401);
  }

  user.permissions = await permissionService.getEffectivePermissions(user.id);
  user.accountId = decoded.accountId || user.id;

  req.user = user;
  req.authType = 'user';
  next();
});

/** Phân quyền theo permission */
export const requirePermission = (permissionCode) => (req, _res, next) => {
  const context = req.user || req.employee;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', {
      url: req.originalUrl,
      user: req.user,
      employee: req.employee,
      authHeader: req.headers.authorization
    });
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  const permissions = context.permissions || [];

  if (!permissions.includes(permissionCode)) {
    console.warn(`[RBAC] DENIED: id ${context.id} missing "${permissionCode}"`);
    return next(new AppError(`Bạn không có quyền: ${permissionCode}`, 403));
  }

  next();
};

/** Yêu cầu ít nhất MỘT trong các permission được liệt kê */
export const requireAnyPermission = (permissionCodes) => (req, _res, next) => {
  const context = req.user || req.employee;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', {
      url: req.originalUrl,
      user: req.user,
      employee: req.employee,
      authHeader: req.headers.authorization
    });
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  const permissions = context.permissions || [];

  const hasAny = permissionCodes.some(code => permissions.includes(code));
  if (!hasAny) {
    console.warn(`[RBAC] DENIED: id ${context.id} missing any of [${permissionCodes.join(', ')}]`);
    return next(new AppError(`Bạn cần ít nhất một quyền: ${permissionCodes.join(' hoặc ')}`, 403));
  }

  next();
};

/** Kiểm tra quyền truy cập account */
export const requireBranchAccess = (req, _res, next) => {
  const context = req.user || req.employee;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', {
      url: req.originalUrl,
      user: req.user,
      employee: req.employee,
      authHeader: req.headers.authorization
    });
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  const accountId = context.accountId || context.id;

  if (req.params.accountId) {
    if (req.params.accountId !== accountId) {
      return next(new AppError('Bạn không có quyền truy cập tài khoản này', 403));
    }
  }

  if (req.body && req.body.accountId) {
    if (req.body.accountId !== accountId) {
      return next(new AppError('Bạn không có quyền truy cập tài khoản này', 403));
    }
  }

  next();
};

/** Optional auth - gắn user nếu có token */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type === 'user') {
      const user = await prisma.account.findUnique({
        where: { id: decoded.sub },
        select: { id: true, email: true, fullName: true },
      });
      if (user) {
        user.permissions = await permissionService.getEffectivePermissions(user.id);
        user.accountId = user.id;
        req.user = user;
        req.authType = 'user';
      }
    } else if (decoded.type === 'employee') {
      req.employee = { id: decoded.employeeId, accountId: decoded.accountId, permissions: decoded.permissions || [] };
      req.authType = 'employee';
    }
  } catch {
    // bỏ qua token không hợp lệ
  }
  next();
});
