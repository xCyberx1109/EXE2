import { Navigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRBACPermissions?: string[];
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  requiredRBACPermissions,
  fallbackPath = '/app',
}: ProtectedRouteProps) {
  const {
    isReady, isAuthenticated, hasPermission,
  } = useAuth();

  if (!isReady) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRBACPermissions && requiredRBACPermissions.length > 0) {
    const hasAll = requiredRBACPermissions.every((p) => hasPermission(p));
    if (!hasAll) {
      return <Navigate to="/app" replace />;
    }
  }

  return <>{children}</>;
}