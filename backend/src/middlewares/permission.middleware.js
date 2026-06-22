/**
 * Permission-based authorization middleware.
 * Checks permissions from POS session (set by auth middleware).
 * Uses OR logic for requireAnyPermission, AND logic for requireAllPermission.
 * No role-based checks — pure permission matching.
 */

import { AppError } from '../utils/AppError.js';

/**
 * Yêu cầu ít nhất MỘT trong các permission được liệt kê (OR logic)
 */
export function requireAnyPermission(permissions = []) {
  return (req, _res, next) => {
    const userPermissions = req.posSession?.permissions || req.user?.permissions || [];

    const hasPermission = permissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      return next(
        new AppError(
          `Bạn cần ít nhất một quyền: ${permissions.join(' hoặc ')}`,
          403,
        ),
      );
    }

    next();
  };
}

/**
 * Yêu cầu TẤT CẢ các permission được liệt kê (AND logic)
 */
export function requireAllPermission(permissions = []) {
  return (req, _res, next) => {
    const userPermissions = req.posSession?.permissions || req.user?.permissions || [];

    const hasAll = permissions.every(p => userPermissions.includes(p));

    if (!hasAll) {
      return next(
        new AppError(
          `Bạn cần tất cả quyền: ${permissions.join(', ')}`,
          403,
        ),
      );
    }

    next();
  };
}
