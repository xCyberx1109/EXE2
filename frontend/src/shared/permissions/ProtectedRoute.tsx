import { Navigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import type { DevicePermission, PosDeviceTypeV2 } from '../../app/types';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

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
  requiredPermissions,
  requiredRBACPermissions,
  requiredFeatures,
  moduleName,
  fallbackPath = '/pos-v2/dashboard',
}: ProtectedRouteProps) {
  const {
    isReady, isAuthenticated, isDeviceMode, authMode,
    deviceType, hasDevicePermission, hasDeviceFeature,
    deviceFeatures, user, hasPermission,
  } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang kết nối server...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Account-level checks (Account-based Permissions)
  if (authMode === 'account' && user) {
    if (requiredRBACPermissions && requiredRBACPermissions.length > 0) {
      const hasAll = requiredRBACPermissions.every((p) => hasPermission(p));
      if (!hasAll) {
        return <Navigate to="/app/profile" replace />;
      }
    }
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
        ? !deviceFeatures.hide.includes('all-interactive') &&
          !deviceFeatures.hide.includes(moduleName) &&
          deviceFeatures.modules.includes(moduleName)
        : false;
      if (!canAccess) {
        return <Navigate to={fallbackPath} replace />;
      }
    }
  }

  return <>{children}</>;
}