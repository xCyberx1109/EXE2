import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { permissionService } from '../modules/permissions/permission.service.js';
import { devicePermissionService } from '../modules/permissions/devicePermission.service.js';

async function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isJwtToken(token) {
  return token.split('.').length === 3;
}

function extractToken(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

/** Xác thực JWT user hoặc POS Machine */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    console.error('[AUTH FAILED] Missing token', { url: req.originalUrl });
    throw new AppError('Vui lòng đăng nhập', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (jwtErr) {
    console.error('[AUTH FAILED] Invalid token', { url: req.originalUrl, error: jwtErr.message });
    throw new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401);
  }

  // POS Machine JWT: { machineId, accountId, type: 'pos_machine', permissions, template, ... }
  if (decoded.type === 'pos_machine') {
    const { machineId, accountId, template, permissions } = decoded;

    req.posDevice = {
      id: machineId,
      accountId,
      template,
      permissions,
      type: 'pos_machine'
    };

    // Backward compatibility: also set req.user
    req.user = {
      id: accountId,
      accountId,
      machineId,
      source: 'POS_MACHINE',
      permissions
    };

    req.authType = 'pos_machine';
    return next();
  }

  // POS Device JWT: { machineId, accountId, type: 'device', template, permissions, ... }
  if (decoded.type === 'device') {
    const { machineId, accountId, template, permissions } = decoded;

    req.device = {
      id: machineId,
      accountId,
      template,
      permissions: permissions || [],
    };

    // Backward compatibility for requirePermission / requireAnyPermission
    req.posDevice = {
      id: machineId,
      accountId,
      template,
      permissions: permissions || [],
      type: 'device',
    };

    req.user = {
      id: accountId,
      accountId,
      machineId,
      source: 'POS_DEVICE',
      permissions: permissions || [],
    };

    req.authType = 'device';
    return next();
  }

  // User JWT: unified { sub, type: 'user' } or legacy { userId, accountId }
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

/** Xác thực POS Device token (hỗ trợ JWT device token và raw token) */
export const requireDeviceAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    console.warn('[DeviceAuth] No token provided - endpoint requires POS device auth');
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
      if (decoded.type === 'device' || decoded.type === 'pos_machine') {
        const id = decoded.sub || decoded.machineId;
        device = await prisma.pos_machines.findUnique({
          where: { id, deletedAt: null },
        });
      } else {
        console.warn(`[DeviceAuth] Token type is "${decoded.type}", expected "device" or "pos_machine". User tokens are not accepted here.`);
      }
    }
  } catch {
    // fall through to raw token lookup
  }

  if (!device) {
    // Try raw token lookup via DeviceSession
    const tokenHash = await hashToken(token);
    const session = await prisma.deviceSession.findFirst({
      where: { tokenHash, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' },
    });
    if (session) {
      device = await prisma.pos_machines.findUnique({
        where: { id: session.deviceId, deletedAt: null },
      });
    }
  }

  if (!device) {
    console.warn(`[DeviceAuth] No device found for token`);
    throw new AppError('Phiên đăng nhập thiết bị không hợp lệ', 401);
  }

  if (device.status === 'LOCKED') {
    console.warn('[DEVICE BLOCKED]', { machineId: device.id });
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

/** Chặn POS Machine */
export const requireNotPosMachine = (req, _res, next) => {
  if (req.authType === 'pos_machine' || req.authType === 'device') {
    return next(new AppError('Máy POS không được phép quản lý bàn.', 403));
  }
  next();
};

/** Phân quyền theo permission */
export const requirePermission = (permissionCode) => (req, _res, next) => {
  const context = req.user || req.posDevice;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', { url: req.originalUrl });
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  const permissions = context.permissions || req.devicePermissions || [];

  if (!permissions.includes(permissionCode)) {
    console.warn(`[RBAC] DENIED: id ${context.id} missing "${permissionCode}"`);
    return next(new AppError(`Bạn không có quyền: ${permissionCode}`, 403));
  }

  next();
};

/** Yêu cầu ít nhất MỘT trong các permission được liệt kê */
export const requireAnyPermission = (permissionCodes) => (req, _res, next) => {
  const context = req.user || req.posDevice;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', { url: req.originalUrl });
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  const permissions = context.permissions || req.devicePermissions || [];

  const hasAny = permissionCodes.some(code => permissions.includes(code));
  if (!hasAny) {
    console.warn(`[RBAC] DENIED: id ${context.id} missing any of [${permissionCodes.join(', ')}]`);
    return next(new AppError(`Bạn cần ít nhất một quyền: ${permissionCodes.join(' hoặc ')}`, 403));
  }

  next();
};

/** Kiểm tra quyền truy cập account - không có ADMIN_ALL bypass (requirement #4) */
export const requireBranchAccess = (req, _res, next) => {
  const context = req.user || req.posDevice;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', { url: req.originalUrl });
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
    } else if (decoded.type === 'pos_machine') {
      const { machineId, accountId, template, permissions } = decoded;
      req.posDevice = {
        id: machineId,
        accountId,
        template,
        permissions,
        type: 'pos_machine'
      };
      req.user = {
        id: accountId,
        accountId,
        machineId,
        source: 'POS_MACHINE',
        permissions
      };
      req.authType = 'pos_machine';
    } else if (decoded.type === 'device') {
      const { machineId, accountId, template, permissions } = decoded;
      req.device = {
        id: machineId,
        accountId,
        template,
        permissions: permissions || [],
      };
      req.posDevice = {
        id: machineId,
        accountId,
        template,
        permissions: permissions || [],
        type: 'device',
      };
      req.user = {
        id: accountId,
        accountId,
        machineId,
        source: 'POS_DEVICE',
        permissions: permissions || [],
      };
      req.authType = 'device';
    }
  } catch {
    // bỏ qua token không hợp lệ
  }
  next();
});
