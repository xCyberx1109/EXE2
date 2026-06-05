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

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (jwtErr) {
    throw new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401);
  }
  if (decoded.type !== 'user') {
    throw new AppError('Token không hợp lệ cho tài khoản quản trị', 401);
  }

  const user = await prisma.account.findUnique({
    where: { id: decoded.sub || decoded.userId },
        select: { id: true, email: true, fullName: true },
  });

  if (!user) {
    throw new AppError('Tài khoản không tồn tại', 401);
  }

  // Lấy permissions hiệu dụng realtime
  user.permissions = await permissionService.getEffectivePermissions(user.id);

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
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwt.secret);
      } catch {
        throw new AppError('Phiên đăng nhập thiết bị không hợp lệ hoặc đã hết hạn', 401);
      }
      if (decoded.type === 'device') {
        device = await prisma.posDevice.findUnique({
          where: { id: decoded.sub, deletedAt: null },
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
    });
  }

  if (!device) {
    throw new AppError('Phiên đăng nhập thiết bị không hợp lệ', 401);
  }

  if (!device.active) {
    throw new AppError('Thiết bị đã bị vô hiệu hóa', 403);
  }

  req.posDevice = device;
  req.branch = null;
  req.authType = 'device';

  const capabilities = await devicePermissionService.getDeviceCapabilities(device);
  req.devicePermissions = capabilities.permissions;
  req.deviceFeatures = capabilities.features;
  req.enabledFeatures = capabilities.enabledFeatures;

  next();
});

/** Phân quyền theo permission */
export const requirePermission = (permissionCode) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  console.log(`[RBAC] Checking permission "${permissionCode}" for user ${req.user.id}`);
  console.log("[RBAC] USER PERMISSIONS:", JSON.stringify(req.user.permissions));

  // Admin bypass via ADMIN_ALL permission (not role-based)
  if (req.user.permissions?.includes('ADMIN_ALL')) {
    console.log(`[RBAC] ADMIN_ALL override - granting "${permissionCode}"`);
    return next();
  }

  if (!req.user.permissions?.includes(permissionCode)) {
    console.warn(`[RBAC] DENIED: user ${req.user.id} missing "${permissionCode}"`);
    return next(new AppError(`Bạn không có quyền: ${permissionCode}`, 403));
  }

  console.log(`[RBAC] GRANTED: "${permissionCode}" for user ${req.user.id}`);
  next();
};

/** Kiểm tra quyền truy cập branch */
export const requireBranchAccess = (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  const hasAllBranchAccess = req.user.permissions?.includes('BRANCH_ALL_ACCESS');

  if (req.params.branchId && !hasAllBranchAccess) {
    if (req.params.branchId !== req.user.branchId) {
      return next(new AppError('Bạn không có quyền truy cập branch này', 403));
    }
  }

  if (req.body && req.body.branchId && !hasAllBranchAccess) {
    if (req.body.branchId !== req.user.branchId) {
      return next(new AppError('Bạn không có quyền truy cập branch này', 403));
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
        req.user = user;
        req.authType = 'user';
      }
    }
  } catch {
    // bỏ qua token không hợp lệ
  }
  next();
});
