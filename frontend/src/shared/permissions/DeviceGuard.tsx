import { Navigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import type { DevicePermission, PosDeviceTypeV2 } from '../../app/types';
import type { ReactNode } from 'react';

interface DeviceGuardProps {
  children: ReactNode;
  allowedTypes?: PosDeviceTypeV2[];
  requiredPermissions?: DevicePermission[];
  fallbackPath?: string;
}

/** @deprecated POS devices are removed. This guard is kept for type compatibility only. */
export function DeviceGuard({
  children,
}: DeviceGuardProps) {
  return <>{children}</>;
}

/** @deprecated POS device module routing no longer applies. */
export function useCanAccessModule(_moduleName: string): boolean {
  return true;
}

/** @deprecated POS device route routing no longer applies. */
export function useCanAccessRoute(_route: string): boolean {
  return true;
}
