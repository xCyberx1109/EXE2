import { Navigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import type { DevicePermission, PosDeviceTypeV2, DeviceFeatures } from '../../app/types';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedTypes?: PosDeviceTypeV2[];
  requiredPermissions?: DevicePermission[];
  requiredRBACPermissions?: string[];
  requiredFeatures?: string[];
  moduleName?: string;
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  allowedTypes,
  allowedRoles,
  requiredPermissions,
  requiredRBACPermissions,
  requiredFeatures,
  moduleName,
  fallbackPath = '/app',
}: ProtectedRouteProps) {
  const {
    isReady, isAuthenticated, isDeviceMode, isPosMachineMode, authMode,
    deviceType, hasDevicePermission, hasDeviceFeature,
    deviceFeatures, user, hasPermission,
  } = useAuth();

  if (!isReady) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Account-level checks (permission-based RBAC)
  if (authMode === 'account' && user) {
    if (requiredRBACPermissions && requiredRBACPermissions.length > 0) {
      const hasAll = requiredRBACPermissions.every((p) => hasPermission(p));
      if (!hasAll) {
        return <Navigate to="/app" replace />;
      }
    }
  }

  // POS Machine — pass through (template/module-based routing ensures correct access)
  if (isPosMachineMode) {
    return <>{children}</>;
  }

  // Device-level checks
  if (isDeviceMode) {
    if (allowedTypes && deviceType && !allowedTypes.includes(deviceType)) {
      return <Navigate to={fallbackPath} replace />;
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAll = requiredPermissions.every((p) => hasDevicePermission(p));
      if (!hasAll) {
        return <Navigate to={fallbackPath} replace />;
      }
    }

    if (requiredFeatures && requiredFeatures.length > 0) {
      const hasAll = requiredFeatures.every((f) => hasDeviceFeature(f));
      if (!hasAll) {
        return <Navigate to={fallbackPath} replace />;
      }
    }

    if (moduleName) {
      const canAccess = deviceFeatures
        ? !(deviceFeatures.hide ?? []).includes('all-interactive') &&
          !(deviceFeatures.hide ?? []).includes(moduleName) &&
          (deviceFeatures.modules ?? []).includes(moduleName)
        : false;
      if (!canAccess) {
        return <Navigate to={fallbackPath} replace />;
      }
    }
  }

  return <>{children}</>;
}