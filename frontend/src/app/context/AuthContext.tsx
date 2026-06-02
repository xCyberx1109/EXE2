import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { setToken, getToken, clearToken } from '../api/client';
import { authApi } from '../api/services';
import { getPosToken, setPosToken, clearAllPosStorage } from '../api/posServices';

import type { User, AuthMode, DeviceLoginResponse, DevicePermission, DeviceFeatures, PosDeviceTypeV2, AccountRole } from '../types';
import { normalizeRole } from '../types';
import { deviceAuthApi } from '../api/services';

const STORAGE_KEYS = {
  DEVICE_INFO: 'fnb_device_info',
  BRANCH_INFO: 'fnb_branch_info',
  DEVICE_PERMISSIONS: 'fnb_device_permissions',
  DEVICE_FEATURES: 'fnb_device_features',
  ENABLED_FEATURES: 'fnb_enabled_features',
  FINGERPRINT: 'fnb_device_fingerprint',
} as const;

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  authMode: AuthMode;
  user: User | null;
  deviceInfo: DeviceLoginResponse['device'] | null;
  branchInfo: DeviceLoginResponse['branch'] | null;
  devicePermissions: DevicePermission[];
  deviceFeatures: DeviceFeatures | null;
  enabledFeatures: string[];
  deviceType: PosDeviceTypeV2 | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<User>;
  loginWithDevicePin: (setupPin: string, fingerprint?: string, deviceName?: string) => Promise<DeviceLoginResponse>;
  logout: () => void;
  logoutDevice: () => Promise<void>;
  hasRole: (roles: string | string[]) => boolean;
  getRoleLabel: () => string;
  hasDevicePermission: (permission: DevicePermission) => boolean;
  hasAnyDevicePermission: (permissions: DevicePermission[]) => boolean;
  hasDeviceFeature: (feature: string) => boolean;
  isDeviceMode: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function generateFingerprint(): string {
  let fp = localStorage.getItem(STORAGE_KEYS.FINGERPRINT);
  if (!fp) {
    const nav = window.navigator;
    const screen = window.screen;
    const raw = [
      nav.userAgent,
      nav.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('||');
    fp = btoa(encodeURIComponent(raw)).slice(0, 64);
    localStorage.setItem(STORAGE_KEYS.FINGERPRINT, fp);
  }
  return fp;
}

function restoreFromStorage() {
  try {
    const deviceInfo = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEVICE_INFO) || 'null');
    const branchInfo = JSON.parse(localStorage.getItem(STORAGE_KEYS.BRANCH_INFO) || 'null');
    const devicePermissions = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEVICE_PERMISSIONS) || '[]');
    const deviceFeatures = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEVICE_FEATURES) || 'null');
    const enabledFeatures = JSON.parse(localStorage.getItem(STORAGE_KEYS.ENABLED_FEATURES) || '[]');
    return { deviceInfo, branchInfo, devicePermissions, deviceFeatures, enabledFeatures };
  } catch {
    return { deviceInfo: null, branchInfo: null, devicePermissions: [], deviceFeatures: null, enabledFeatures: [] };
  }
}

function clearAllStorage() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken() || !!getPosToken());
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (getToken()) return 'account';
    if (getPosToken()) return 'device';
    return 'account';
  });
  const [user, setUser] = useState<User | null>(null);

  const restored = isAuthenticated && authMode === 'device' ? restoreFromStorage() : null;
  const [deviceInfo, setDeviceInfo] = useState<DeviceLoginResponse['device'] | null>(restored?.deviceInfo || null);
  const [branchInfo, setBranchInfo] = useState<DeviceLoginResponse['branch'] | null>(restored?.branchInfo || null);
  const [devicePermissions, setDevicePermissions] = useState<DevicePermission[]>(restored?.devicePermissions || []);
  const [deviceFeatures, setDeviceFeatures] = useState<DeviceFeatures | null>(restored?.deviceFeatures || null);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(restored?.enabledFeatures || []);
  const deviceType = deviceInfo?.type as PosDeviceTypeV2 | null;

  const persistDeviceState = useCallback((info: DeviceLoginResponse) => {
    localStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(info.device));
    localStorage.setItem(STORAGE_KEYS.BRANCH_INFO, JSON.stringify(info.branch));
    localStorage.setItem(STORAGE_KEYS.DEVICE_PERMISSIONS, JSON.stringify(info.permissions || []));
    localStorage.setItem(STORAGE_KEYS.DEVICE_FEATURES, JSON.stringify(info.features || null));
    localStorage.setItem(STORAGE_KEYS.ENABLED_FEATURES, JSON.stringify(info.enabledFeatures || []));
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: loggedUser } = await authApi.login(email, password);
    setToken(token);
    setUser({ 
      ...loggedUser, 
      role: normalizeRole(loggedUser.role) as AccountRole,
      permissions: loggedUser.permissions || [],
      permissionsVersion: loggedUser.permissionsVersion ?? 0,
    });
    setIsAuthenticated(true);
    setAuthMode('account');
    clearAllPosStorage();
    clearAllStorage();
    return loggedUser;
  };

  const loginWithDevicePin = async (
    setupPin: string,
    fingerprint?: string, deviceName?: string,
  ) => {
    const fp = fingerprint || generateFingerprint();
    const name = deviceName || `POS-${fp.slice(0, 8)}`;
    const result = await deviceAuthApi.loginWithPin({
      setupPin, fingerprint: fp, deviceName: name,
    });
    setPosToken(result.deviceToken);
    setDeviceInfo(result.device);
    setBranchInfo(result.branch);
    setDevicePermissions(result.permissions || []);
    setDeviceFeatures(result.features || null);
    setEnabledFeatures(result.enabledFeatures || []);
    persistDeviceState(result);
    setIsAuthenticated(true);
    setAuthMode('device');
    clearToken();
    return result;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setDeviceInfo(null);
    setBranchInfo(null);
    setDevicePermissions([]);
    setDeviceFeatures(null);
    setEnabledFeatures([]);
    setIsAuthenticated(false);
    setAuthMode('account');
    clearAllStorage();
  };

  const logoutDevice = useCallback(async () => {
    if (getPosToken()) {
      try {
        await deviceAuthApi.logout();
      } catch {
        // ignore
      }
    }
    clearAllPosStorage();
    clearAllStorage();
    setDeviceInfo(null);
    setBranchInfo(null);
    setDevicePermissions([]);
    setDeviceFeatures(null);
    setEnabledFeatures([]);
    setIsAuthenticated(false);
    setAuthMode('account');
  }, []);

  const hasRole = (roles: string | string[]) => {
    if (!user) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(user.role);
  };

  const getRoleLabel = (): string => {
    if (!user) return '';
    const labels: Record<string, string> = {
      ADMIN: 'Super Admin',
      MANAGER: 'Quản lý',
      CASHIER: 'Thu ngân',
      KITCHEN: 'Bếp',
    };
    return labels[user.role] || user.role;
  };

  const hasDevicePermission = (permission: DevicePermission) => {
    return devicePermissions.includes(permission);
  };

  const hasAnyDevicePermission = (permissions: DevicePermission[]) => {
    return permissions.some(p => devicePermissions.includes(p));
  };

  const hasDeviceFeature = (feature: string) => {
    return enabledFeatures.includes(feature);
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    return user.permissions?.includes(permission) || false;
  };

  // Polling: kiểm tra permission changes mỗi 30s
  useEffect(() => {
    if (!isAuthenticated || authMode !== 'account') return;

    const channel = new BroadcastChannel('fnb-permissions');
    let prevVersion = user?.permissionsVersion;

    const check = async () => {
      try {
        const currentUser = await authApi.getMe();
        const newVersion = currentUser.permissionsVersion ?? 0;
        if (newVersion !== prevVersion) {
          prevVersion = newVersion;
          setUser({
            ...currentUser,
            role: normalizeRole(currentUser.role) as AccountRole,
            permissions: currentUser.permissions || [],
          });
          // Notify other tabs
          channel.postMessage({ type: 'PERMISSIONS_UPDATED', version: newVersion });
        }
      } catch {
        // ignore polling errors
      }
    };

    // Listen for updates from other tabs
    channel.onmessage = (e) => {
      if (e.data?.type === 'PERMISSIONS_UPDATED') {
        check();
      }
    };

    const interval = setInterval(check, 30000);
    return () => { clearInterval(interval); channel.close(); };
  }, [isAuthenticated, authMode]);

  useEffect(() => {
    const init = async () => {
      const userToken = getToken();
      const posToken = getPosToken();

      if (userToken) {
        try {
          const currentUser = await authApi.getMe();
          setUser({ 
            ...currentUser, 
            role: normalizeRole(currentUser.role) as AccountRole,
            permissions: currentUser.permissions || [],
            permissionsVersion: currentUser.permissionsVersion ?? 0,
          });
          setIsAuthenticated(true);
          setAuthMode('account');
        } catch {
          clearToken();
          setIsAuthenticated(false);
        } finally {
          setIsReady(true);
        }
        return;
      }

      if (posToken) {
        try {
          const sessions = await deviceAuthApi.getSessions();
          if (sessions && sessions.length > 0) {
            const stored = restoreFromStorage();
            if (stored.deviceInfo?.id) {
              setDeviceInfo(stored.deviceInfo);
              setBranchInfo(stored.branchInfo);
              setDevicePermissions(stored.devicePermissions);
              setDeviceFeatures(stored.deviceFeatures);
              setEnabledFeatures(stored.enabledFeatures);
            } else {
              setDeviceInfo({ id: '', name: '', type: '' as PosDeviceTypeV2, mode: '' as any, status: 'ACTIVATED' });
            }
            setIsAuthenticated(true);
            setAuthMode('device');
          }
        } catch {
          clearAllPosStorage();
          clearAllStorage();
          setIsAuthenticated(false);
        } finally {
          setIsReady(true);
        }
        return;
      }

      setIsReady(true);
    };
    init();
  }, []);

  return (
    <AuthContext.Provider value={{
      isReady, isAuthenticated, authMode,
      user, deviceInfo, branchInfo,
      devicePermissions, deviceFeatures, enabledFeatures, deviceType,
      setUser, login, loginWithDevicePin,
      logout, logoutDevice,
      hasRole, getRoleLabel, hasDevicePermission, hasAnyDevicePermission, hasDeviceFeature,
      isDeviceMode: authMode === 'device',
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}