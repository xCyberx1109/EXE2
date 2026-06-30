import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router';

interface PermissionGuardProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
  redirect?: string;
}

export function PermissionGuard({
  permission,
  children,
  fallback = null,
  redirect,
}: PermissionGuardProps) {
  const { hasPermission, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ✅ FIX: handle empty permission safely
  if (!permission) {
    return <>{children}</>;
  }

  // ❌ nếu backend sai format thì vẫn fail
  const allowed = hasPermission(permission);

  if (!allowed) {
    if (redirect) {
      return <Navigate to={redirect} replace />;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

function extractPermissionCodes(permissions: unknown): string[] {
  if (!permissions || !Array.isArray(permissions)) return [];
  return permissions.map((p: any) => (typeof p === 'string' ? p : (p as { code: string }).code));
}

export function usePermissions() {
  const { hasPermission, user } = useAuth();
  return {
    hasPermission,
    permissions: extractPermissionCodes(user?.permissions),
  };
}
