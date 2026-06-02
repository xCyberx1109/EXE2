import { useAuth } from '../../app/context/AuthContext';
import { APP_MENU, type AppMenuItem } from './menuConfig';
import { FEATURE_PERMISSIONS, type FeatureKey } from './featurePermissions';

export function usePermissions() {
  const { user, hasPermission } = useAuth();

  const role = user?.role || 'STAFF';

  const hasFeaturePermission = (feature: FeatureKey): boolean => {
    const permission = FEATURE_PERMISSIONS[feature];
    return hasPermission(permission);
  };

  return {
    role,
    isAdmin: hasPermission('BRANCH_ALL_ACCESS'),
    isManager: hasPermission('BRANCH_VIEW'),
    hasPermission,
    hasFeaturePermission,
    permissions: user?.permissions || [],
  };
}

export function useRoleMenu(): AppMenuItem[] {
  const { hasPermission } = useAuth();
  return APP_MENU.filter(item => !item.permission || hasPermission(item.permission));
}
