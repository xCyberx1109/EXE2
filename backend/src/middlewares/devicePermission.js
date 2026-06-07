import { AppError } from '../utils/AppError.js';
import { hasPermission, getPermissionsForDeviceType, getEnabledFeaturesForDeviceType } from '../modules/permissions/devicePermissions.js';
import { activityLogRepository } from '../repositories/activityLog.repository.js';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

function logDenied(req, action, details) {
  activityLogRepository.create({
    accountId: req.posDevice?.accountId,
    posDeviceId: req.posDevice?.id,
    action,
    module: 'DEVICE_PERMISSION',
    details: { ...details, path: req.originalUrl, method: req.method },
    ipAddress: getClientIp(req),
  }).catch(() => {});
}

export function requireDevicePermission(...requiredPermissions) {
  return (req, _res, next) => {
    if (req.authType === 'user') {
      return next();
    }

    if (!req.posDevice) {
      return next(new AppError('Yêu cầu đăng nhập thiết bị POS', 401));
    }

    const deviceType = req.posDevice.type;
    const effectivePerms = req.devicePermissions || getPermissionsForDeviceType(deviceType);
    const missing = requiredPermissions.filter((perm) => !effectivePerms.includes(perm));

    if (missing.length > 0) {
      logDenied(req, 'PERMISSION_DENIED', {
        deviceType,
        requiredPermissions: missing,
      });

      return next(
        new AppError(`Thiết bị ${deviceType} không có quyền thực hiện thao tác này`, 403),
      );
    }

    next();
  };
}

export function requireDeviceType(...allowedTypes) {
  return (req, _res, next) => {
    if (req.authType === 'user') {
      return next();
    }

    if (!req.posDevice) {
      return next(new AppError('Yêu cầu đăng nhập thiết bị POS', 401));
    }

    if (!allowedTypes.includes(req.posDevice.type)) {
      logDenied(req, 'DEVICE_TYPE_DENIED', {
        deviceType: req.posDevice.type,
        allowedTypes,
      });

      return next(
        new AppError(`Thiết bị ${req.posDevice.type} không được phép truy cập`, 403),
      );
    }

    next();
  };
}

export function requireDeviceFeature(...requiredFeatures) {
  return (req, _res, next) => {
    if (req.authType === 'user') {
      return next();
    }

    if (!req.posDevice) {
      return next(new AppError('Yêu cầu đăng nhập thiết bị POS', 401));
    }

    const deviceType = req.posDevice.type;
    const enabled = req.enabledFeatures || getEnabledFeaturesForDeviceType(deviceType);
    const missing = requiredFeatures.filter((f) => !enabled.includes(f));

    if (missing.length > 0) {
      logDenied(req, 'FEATURE_DENIED', {
        deviceType,
        requiredFeatures: missing,
      });

      return next(
        new AppError(`Thiết bị ${deviceType} không có tính năng này`, 403),
      );
    }

    next();
  };
}

export function attachDevicePermissions(req, _res, next) {
  if (req.posDevice) {
    req.devicePermissions = getPermissionsForDeviceType(req.posDevice.type);
    req.enabledFeatures = getEnabledFeaturesForDeviceType(req.posDevice.type);
  }
  next();
}
