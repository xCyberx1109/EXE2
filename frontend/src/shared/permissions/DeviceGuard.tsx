import { Navigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import type { DevicePermission, PosDeviceTypeV2 } from '../../app/types';
import { DEVICE_FEATURES } from './devicePermissions';
import type { ReactNode } from 'react';

interface DeviceGuardProps {
  children: ReactNode;
  allowedTypes?: PosDeviceTypeV2[];
  requiredPermissions?: DevicePermission[];
  fallbackPath?: string;
}

export function DeviceGuard({
  children,
  allowedTypes,
  requiredPermissions,
  fallbackPath = '/login',
}: DeviceGuardProps) {
  const { isReady, isAuthenticated, isDeviceMode, deviceType, hasDevicePermission } = useAuth();

  if (!isReady) return null;

  if (!isAuthenticated || !isDeviceMode) {
    return <Navigate to="/login" replace />;
  }

  if (allowedTypes && deviceType && !allowedTypes.includes(deviceType)) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAll = requiredPermissions.every((p) => hasDevicePermission(p));
    if (!hasAll) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
}

export function useCanAccessModule(moduleName: string): boolean {
  const { deviceType, deviceFeatures } = useAuth();
  if (!deviceType || !deviceFeatures) return false;
  if (deviceFeatures.hide.includes('all-interactive')) return false;
  if (deviceFeatures.hide.includes(moduleName)) return false;
  return deviceFeatures.modules.includes(moduleName);
}

export function useCanAccessRoute(route: string): boolean {
  const { deviceType, deviceFeatures } = useAuth();
  if (!deviceType || !deviceFeatures) return false;
  return deviceFeatures.routes.includes(route);
}
