import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { permissionService } from '../modules/permissions/permission.service.js';

async function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isJwtToken(token) {
  return token.split('.').length === 3;
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

/** Xác thực JWT user (admin/manager) */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw new AppError('Vui lòng đăng nhập', 401);
  }

  const decoded = jwt.verify(token, config.jwt.secret);
  if (decoded.type !== 'user') {
    throw new AppError('Token không hợp lệ cho tài khoản quản trị', 401);
  }

  const user = await prisma.account.findUnique({
    where: { id: decoded.sub || decoded.userId },
    select: { id: true, email: true, fullName: true, role: true, branchId: true },
  });

  if (!user) {
    throw new AppError('Tài khoản không tồn tại', 401);
  }

  // Lấy permissions hiệu dụng realtime
  user.permissions = await permissionService.getEffectivePermissions(user.id);
  user.permissionsVersion = permissionService.getPermissionsVersion(user.id);

  console.log('[authenticate] user:', { id: user.id, email: user.email, role: user.role, branchId: user.branchId, permissions: user.permissions });

  req.user = user;
  req.authType = 'user';
  next();
});

/** Xác thực POS Device token (hỗ trợ JWT device token và raw token) */
export const requireDeviceAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw new AppError('Vui lòng đăng nhập thiết bị POS', 401);
  }

  let device;

  try {
    if (isJwtToken(token)) {
      const decoded = jwt.verify(token, config.jwt.secret);
      if (decoded.type === 'device') {
        device = await prisma.posDevice.findUnique({
          where: { id: decoded.sub, deletedAt: null },
          include: { branch: true },
        });
      }
    }
  } catch {
    // fall through to raw token lookup
  }

  if (!device) {
    // Try raw token lookup
    const tokenHash = await hashToken(token);
    device = await prisma.posDevice.findFirst({
      where: { deviceTokenHash: tokenHash, deletedAt: null },
      include: { branch: true },
    });
  }

  if (!device) {
    throw new AppError('Phiên đăng nhập thiết bị không hợp lệ', 401);
  }

  if (!device.active) {
    throw new AppError('Thiết bị đã bị vô hiệu hóa', 403);
  }

  req.posDevice = device;
  req.branch = device.branch;
  req.authType = 'device';

  const capabilities = await devicePermissionService.getDeviceCapabilities(device);
  req.devicePermissions = capabilities.permissions;
  req.deviceFeatures = capabilities.features;
  req.enabledFeatures = capabilities.enabledFeatures;

  next();
});

/** Phân quyền theo permission — granular, không bypass */
export const requirePermission = (permissionCode) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  if (!req.user.permissions?.includes(permissionCode)) {
    return next(new AppError(`Bạn không có quyền: ${permissionCode}`, 403));
  }
  next();
};

/**
 * Yêu cầu quyền quản lý chi nhánh
 * Kiểm tra quyền truy cập theo branchId
 */
export const requireBranchManager = (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  const canAccessAll = req.user.permissions?.includes('BRANCH_ALL_ACCESS') || req.user.permissions?.includes('CROSS_BRANCH_ACCESS');

  if (req.params.branchId && !canAccessAll) {
    if (req.params.branchId !== req.user.branchId) {
      return next(new AppError('Bạn không có quyền truy cập chi nhánh này', 403));
    }
  }

  if (req.body && req.body.branchId && !canAccessAll) {
    if (req.body.branchId !== req.user.branchId) {
      return next(new AppError('Bạn không có quyền truy cập chi nhánh này', 403));
    }
  }

  // Nếu user có branchId cụ thể, tự động gán vào query
  if (!canAccessAll && req.user.branchId) {
    req.branchScope = { hasAccess: false, branchId: req.user.branchId };
  }

  next();
};

/** Optional auth - gắn user nếu có token (kèm permissions) */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type === 'user') {
      const user = await prisma.account.findUnique({
        where: { id: decoded.sub },
        select: { id: true, email: true, fullName: true, role: true, branchId: true },
      });
      if (user) {
        user.permissions = await permissionService.getEffectivePermissions(user.id);
        user.permissionsVersion = permissionService.getPermissionsVersion(user.id);
        req.user = user;
        req.authType = 'user';
      }
    }
  } catch {
    // bỏ qua token không hợp lệ
  }
  next();
});
