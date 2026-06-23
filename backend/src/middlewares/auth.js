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
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

/** Xác thực JWT user hoặc POS Machine */
export const authenticate = asyncHandler(async (req, _res, next) => {
  console.log('=== AUTH START ===');
  console.log('URL:', req.method, req.originalUrl);
  console.log('Authorization:', req.headers.authorization);
  
  const token = extractToken(req);
  if (!token) {
    console.error('[AUTH FAILED] Missing auth context', {
      url: req.originalUrl,
      user: req.user,
      posDevice: req.posDevice,
      authHeader: req.headers.authorization
    });
    throw new AppError('Vui lòng đăng nhập', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
    console.log('[AUTH] Decoded token:', decoded);
  } catch (jwtErr) {
    console.error('[AUTH FAILED] Invalid token', {
      url: req.originalUrl,
      user: req.user,
      posDevice: req.posDevice,
      authHeader: req.headers.authorization,
      error: jwtErr.message
    });
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
    console.log('[AUTH] req.user:', req.user);
    console.log('[AUTH] req.posDevice:', req.posDevice);
    return next();
  }

  // POS Device JWT: { machineId, accountId, type: 'device', template, permissions, ... }
  if (decoded.type === 'device') {
    console.log('[AUTH TYPE]', decoded.type);
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
    console.log('[AUTH] req.user:', req.user);
    console.log('[AUTH] req.posDevice:', req.posDevice);
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
  console.log('[AUTH] req.user:', req.user);
  console.log('[AUTH] req.posDevice:', req.posDevice);
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
        console.log(`[DeviceAuth] JWT decoded: type=${decoded.type}, sub=${decoded.sub}`);
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
    console.error('[DEVICE BLOCKED]', {
      machineId: device.id,
      machine: device,
      status: device?.status
    });
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
  console.log('[RBAC ROUTE]', {
    url: req.originalUrl,
    requiredPermission: permissionCode
  });
  
  console.log('[PERMISSION CHECK]', {
    requiredPermission: permissionCode,
    userPermissions: req.user?.permissions,
    devicePermissions: req.posDevice?.permissions
  });
  
  const context = req.user || req.posDevice;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', {
      url: req.originalUrl,
      user: req.user,
      posDevice: req.posDevice,
      authHeader: req.headers.authorization
    });
    return next(new AppError('Vui lòng đăng nhập', 401));
  }

  const permissions = context.permissions || req.devicePermissions || [];

  console.log(`[RBAC] Checking permission "${permissionCode}" for id ${context.id}`);
  console.log("[RBAC] PERMISSIONS:", JSON.stringify(permissions));

  // Admin bypass via ADMIN_ALL permission (not role-based)
  if (permissions.includes('ADMIN_ALL')) {
    console.log(`[RBAC] ADMIN_ALL override - granting "${permissionCode}"`);
    return next();
  }

  console.log('[RBAC DEBUG]', {
    requiredPermission: permissionCode,
    availablePermissions: permissions,
    exactMatch: permissions.includes(permissionCode),
    possibleMatches: permissions.filter(p =>
      p.includes('ORDER') ||
      permissionCode.includes('ORDER')
    )
  });

  if (!permissions.includes(permissionCode)) {
    console.warn(`[RBAC] DENIED: id ${context.id} missing "${permissionCode}"`);
    return next(new AppError(`Bạn không có quyền: ${permissionCode}`, 403));
  }

  console.log(`[RBAC] GRANTED: "${permissionCode}" for id ${context.id}`);
  next();
};

/** Yêu cầu ít nhất MỘT trong các permission được liệt kê */
export const requireAnyPermission = (permissionCodes) => (req, _res, next) => {
  console.log('[PERMISSION CHECK]', {
    requiredPermission: permissionCodes,
    userPermissions: req.user?.permissions,
    devicePermissions: req.posDevice?.permissions
  });
  
  const context = req.user || req.posDevice;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', {
      url: req.originalUrl,
      user: req.user,
      posDevice: req.posDevice,
      authHeader: req.headers.authorization
    });
    return next(new AppError('Vui lòng đăng nhập', 401));
  }
  
  const permissions = context.permissions || req.devicePermissions || [];

  console.log(`[RBAC] Checking ANY permission [${permissionCodes.join(', ')}] for id ${context.id}`);

  if (permissions.includes('ADMIN_ALL')) {
    console.log(`[RBAC] ADMIN_ALL override - granting any of [${permissionCodes.join(', ')}]`);
    return next();
  }

  const hasAny = permissionCodes.some(code => permissions.includes(code));
  if (!hasAny) {
    console.warn(`[RBAC] DENIED: id ${context.id} missing any of [${permissionCodes.join(', ')}]`);
    return next(new AppError(`Bạn cần ít nhất một quyền: ${permissionCodes.join(' hoặc ')}`, 403));
  }

  console.log(`[RBAC] GRANTED: any of [${permissionCodes.join(', ')}] for id ${context.id}`);
  next();
};

/** Kiểm tra quyền truy cập account - không có ADMIN_ALL bypass (requirement #4) */
export const requireBranchAccess = (req, _res, next) => {
  const context = req.user || req.posDevice;
  if (!context) {
    console.error('[AUTH FAILED] Missing auth context', {
      url: req.originalUrl,
      user: req.user,
      posDevice: req.posDevice,
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
    console.log('[OPTIONAL AUTH] Decoded token:', decoded);
    
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
    console.log('[OPTIONAL AUTH RESULT]', { user: req.user, posDevice: req.posDevice });
  } catch {
    // bỏ qua token không hợp lệ
  }
  next();
});
