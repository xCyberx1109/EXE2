import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router';
import { FEATURE_PERMISSIONS, type FeatureKey } from '../../shared/permissions/featurePermissions';

interface PermissionGuardProps {
  permission?: string;
  feature?: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  redirect?: string;
}

export function PermissionGuard({
  permission,
  feature,
  children,
  fallback = null,
  redirect,
}: PermissionGuardProps) {
  const { hasPermission, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const perm = permission || (feature ? FEATURE_PERMISSIONS[feature] : null);
  if (!perm || !hasPermission(perm)) {
    if (redirect) {
      return <Navigate to={redirect} replace />;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
