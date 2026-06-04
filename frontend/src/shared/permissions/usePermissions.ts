import { useAuth } from '../../app/context/AuthContext';

export function usePermissions() {
  const { user, hasPermission } = useAuth();

  const permissions = user?.permissions || [];

  return {
    hasPermission,
    permissions,
  };
}
