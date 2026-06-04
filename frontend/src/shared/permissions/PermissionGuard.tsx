import { Navigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import type { ReactNode } from 'react';

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermissions?: string[];
  fallbackPath?: string;
}

export function PermissionGuard({
  children,
  requiredPermissions,
  fallbackPath = '/login',
}: PermissionGuardProps) {
  const { isReady, isAuthenticated, user, hasPermission } = useAuth();

  if (!isReady) return null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAll = requiredPermissions.every((p) => hasPermission(p));
    if (!hasAll) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
}