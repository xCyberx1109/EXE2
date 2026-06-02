import { Navigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import type { AccountRole } from './menuConfig';
import type { ReactNode } from 'react';

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermission?: string;
  fallbackPath?: string;
}

export function PermissionGuard({
  children,
  requiredPermission,
  fallbackPath = '/login',
}: PermissionGuardProps) {
  const { isReady, isAuthenticated, user, hasPermission } = useAuth();

  if (!isReady) return null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
}